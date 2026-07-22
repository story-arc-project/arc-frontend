import { api, ApiError } from "./client";
import type { ApiSuccessResponse } from "@/types/api";
import type { AnalysisStatus } from "@/types/analysis";
import type {
  PersonalInfoLink,
  ResumeLanguage,
  ResumeListItem,
  ResumeVersion,
} from "@/types/resume";
import { isDemoMode } from "@/lib/demo/state";
import * as demo from "@/lib/demo/handlers";

// ─── Defensive parsing helpers ─────────────────────────────────────

/**
 * 백엔드 status("pending"|"queued"|"success"|"failed") → 프런트 enum.
 * analysis-api 의 mapStatus 와 값 매핑은 동일하다(queued→processing, success→completed,
 * 이미 프런트형인 processing 은 그대로 통과). 단 목록 배지는 "미표시"가 유효 상태이므로
 * 알 수 없는/부재 값은 mapStatus 처럼 "pending" 으로 뭉개지 않고 undefined 로 둔다.
 */
function mapResumeStatus(value: unknown): AnalysisStatus | undefined {
  switch (value) {
    case "queued":
      return "processing";
    case "success":
      return "completed";
    case "failed":
      return "failed";
    case "processing":
      return "processing";
    case "pending":
      return "pending";
    default:
      return undefined; // 필드 부재(구 백엔드)·미지 값 → 상태 미표시
  }
}

/**
 * 생성 응답에서 id 를 추출한다(계약 §2.4: POST → { id, title }).
 * 아직 계약 미이행 백엔드는 id 를 주지 않으므로 부재 시 null → 목록 새로고침으로 폴백.
 */
function extractResumeId(res: unknown): { id: string | null; title?: string } {
  if (res === null || typeof res !== "object") return { id: null };
  const root = res as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const id =
    (typeof data.id === "string" && data.id) ||
    (typeof data.resume_id === "string" && data.resume_id) ||
    "";
  const title = typeof data.title === "string" ? data.title : undefined;
  return { id: id || null, title };
}

// ─── Resume endpoints ──────────────────────────────────────────────

// 계약(§2.4)상 POST 는 { id, title } 을 돌려준다. id 가 오면 생성 직후 상세로 이동할 수
// 있고(호출부 판단), 아직 계약 미이행 백엔드처럼 id 가 없으면 null → 목록 새로고침으로 폴백한다.
export async function createResume(
  params: {
    language: ResumeLanguage;
    title?: string;
    /**
     * 레쥬메에 넣을 경험 id (FRT-109). 계약(BAC-45)상 `experience_ids` 는 Optional 이고
     * **부재 = 사용자의 전체 경험**(현행 동작), 빈 배열 = 400 이다. 그래서 미지정을 []
     * 로 뭉개면 안 되고 키 자체를 빼야 한다 — 0개 선택 차단은 호출부(모달)의 책임이다.
     *
     * ⚠️ 백엔드가 아직 이 필드를 받지 않는다(dev 기준 `ResumePostRequest` = language·title).
     * pydantic 기본값이 extra="ignore" 라 보내도 422 가 아니라 200 으로 조용히 무시되므로,
     * 노출 게이팅은 플래그(lib/export/flags.ts)가 호출부에서 수행한다. 이 함수는 flag-agnostic.
     */
    experienceIds?: string[];
  },
  options?: { signal?: AbortSignal },
): Promise<{ id: string | null; title?: string }> {
  if (isDemoMode()) {
    await demo.createResume(params);
    return { id: null };
  }
  const body: Record<string, unknown> = { language: params.language };
  if (params.title !== undefined) body.title = params.title;
  if (params.experienceIds !== undefined) body.experience_ids = params.experienceIds;
  const res = await api.post<ApiSuccessResponse<unknown>>(
    "/export/resume",
    body,
    options,
  );
  return extractResumeId(res);
}

export async function getResume(versionId: string): Promise<ResumeVersion> {
  if (isDemoMode()) return demo.getResume(versionId);
  const res = await api.get<ApiSuccessResponse<unknown>>(
    `/export/resume/${versionId}`,
  );
  return normalizeResumeVersion(unwrapResumeVersion(res.data));
}

/**
 * 백엔드 실값과 프런트 내부 shape 이 어긋나는 지점을 파싱 경계에서 흡수한다.
 *
 * 인적사항.링크 — ai_analyst/src/ai/resume.py 의 `_SYS_KO` 스키마는 링크를 **문자열 배열**로
 * 내는데(EN 의 other_links 도 동일), 프런트는 { label, url } 객체 배열을 기대한다. 정규화가
 * 없으면 PreviewPersonalInfo 의 `l?.url?.trim()` 필터에 전부 걸려 링크가 통째로 사라진다.
 * 소비처(프리뷰·편집기)를 건드리지 않도록 객체 shape 을 정본으로 두고 문자열만 승격한다.
 * 이미 객체로 오는 백엔드도 그대로 통과시킨다(형제 언랩과 같은 dual-compat).
 */
function normalizeResumeVersion(resume: ResumeVersion): ResumeVersion {
  const personal = resume.인적사항;
  if (personal === null || typeof personal !== "object") return resume;
  return { ...resume, 인적사항: { ...personal, 링크: normalizeLinks(personal.링크) } };
}

function normalizeLinks(raw: unknown): PersonalInfoLink[] {
  if (!Array.isArray(raw)) return [];
  const links: PersonalInfoLink[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const url = item.trim();
      // 공백뿐인 문자열은 링크가 아니다 — 편집기에 빈 행으로 남기지 않는다.
      if (url !== "") links.push({ label: null, url });
      continue;
    }
    if (item !== null && typeof item === "object") links.push(item as PersonalInfoLink);
  }
  return links;
}

/**
 * 백엔드 GET /export/resume/{id} 는 본문을 data.result 한 겹에 감싸 돌려준다
 * (data = { id, title, language, status, created_at, updated_at, result }).
 * ResumeVersion 은 본문(인적사항/학력/경력…) 타입이므로 result 를 벗겨 반환한다.
 * 백엔드가 §3 result 규약 통일로 나중에 data 자체를 본문으로 평탄화해도 안 깨지도록
 * result 부재 시 data 그대로 폴백한다(dual-compat).
 */
function unwrapResumeVersion(data: unknown): ResumeVersion {
  if (data !== null && typeof data === "object") {
    const root = data as Record<string, unknown>;
    // 배열은 본문 레코드가 아니다. result:[] 를 큐잉/플레이스홀더 센티넬로 쓰는 백엔드가
    // 있으면 스프레드가 {} 로 뭉개져 meta 없는 껍데기를 ResumeVersion 으로 반환 → 상세
    // 페이지가 resume.meta.language 에서 크래시한다(이 함수가 막으려던 바로 그 실패).
    // 형제 언랩/가드(assertRenderableSchema·unwrapKeywordBody·unwrapList)와 동일하게 배열을 제외한다.
    if (
      root.result !== null &&
      typeof root.result === "object" &&
      !Array.isArray(root.result)
    ) {
      const content = root.result as ResumeVersion;
      // 래퍼의 id 를 본문 version_id 로 보존(본문에 없을 수 있음).
      if (content.version_id === undefined && typeof root.id === "string") {
        return { ...content, version_id: root.id };
      }
      return content;
    }
    // result 부재 = ① 백엔드가 §3 통일로 data 를 본문으로 평탄화(dual-compat) 또는
    // ② 아직 생성이 안 끝났거나 실패한 레쥬메 래퍼(result:null). 전자는 본문 마커
    // (meta)를 갖고 후자는 갖지 않는다. meta 없는 래퍼를 ResumeVersion 으로 반환하면
    // 상세 페이지가 resume.meta.language 에서 크래시하므로, 본문일 때만 폴백하고
    // 아니면 throw → 호출부(상세 페이지)가 제어된 로딩/에러 상태를 보여준다.
    if (
      root.meta !== null &&
      typeof root.meta === "object" &&
      !Array.isArray(root.meta)
    ) {
      return root as unknown as ResumeVersion;
    }
  }
  throw new Error("resume result not ready");
}

// 서버 응답: data = { count, contents: [{ id, created_at, updated_at }] }
export async function getResumeList(): Promise<ResumeListItem[]> {
  if (isDemoMode()) return demo.getResumeList();
  const res = await api.get<ApiSuccessResponse<unknown>>("/export/resume");
  const contents = readContents(res.data);

  return contents
    .map((item) => toListItem(item))
    .filter((item): item is ResumeListItem => item !== null);
}

// 래퍼가 벗겨진 배열로 오는 경우까지 받아둔다.
function readContents(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data === null || typeof data !== "object") return [];
  const contents = (data as Record<string, unknown>).contents;
  return Array.isArray(contents) ? contents : [];
}

function toListItem(raw: unknown): ResumeListItem | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" ? r.id : "";
  if (id === "") return null;

  const createdAt = typeof r.created_at === "string" ? r.created_at : "";
  const language = r.language === "ko" || r.language === "en" ? r.language : undefined;

  return {
    version_id: id,
    created_at: createdAt,
    updated_at: typeof r.updated_at === "string" ? r.updated_at : createdAt,
    title: typeof r.title === "string" && r.title ? r.title : undefined,
    language,
    status: mapResumeStatus(r.status),
  };
}

// Server-side PATCH / DELETE are pending. Callers can catch this error and
// fall back to localStorage draft flow.
export class ResumeMutationUnsupportedError extends Error {
  constructor(readonly status: number) {
    super("resume mutation not supported yet");
    this.name = "ResumeMutationUnsupportedError";
  }
}

function isUnsupportedStatus(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.status === 501 || err.status === 405);
}

export async function updateResume(
  versionId: string,
  data: ResumeVersion,
): Promise<ResumeVersion> {
  if (isDemoMode()) return demo.updateResume(versionId, data);
  try {
    const res = await api.patch<ApiSuccessResponse<ResumeVersion>>(
      `/export/resume/${versionId}`,
      data,
    );
    return res.data;
  } catch (err) {
    if (isUnsupportedStatus(err)) {
      throw new ResumeMutationUnsupportedError(err.status);
    }
    throw err;
  }
}

export async function deleteResume(versionId: string): Promise<void> {
  if (isDemoMode()) return demo.deleteResume(versionId);
  try {
    await api.delete<void>(`/export/resume/${versionId}`);
  } catch (err) {
    if (isUnsupportedStatus(err)) {
      throw new ResumeMutationUnsupportedError(err.status);
    }
    throw err;
  }
}
