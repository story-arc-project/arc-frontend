// 데모 모드 API 핸들러.
// 실제 lib/api/*-api.ts 함수와 동일한 시그니처로 시드/스토어 데이터를 반환한다.
//
// 분석(analysis) 영역은 lib/api/mocks/analysis.ts 가 이미 완전한 mock 을 제공하므로
// analysis-api.ts 에서 USE_MOCK || isDemoMode() 분기를 사용하고, 여기서는 다루지 않는다.

import type {
  Experience,
  ExperienceListData,
  ExperienceSavePayload,
  ExperienceUpdatePayload,
} from "@/types/experience";
import type { LibraryDTO, LibraryUpsertPayload } from "@/lib/utils/library-mapper";
import type { PresetDTO, PresetUpsertPayload } from "@/lib/utils/preset-mapper";
import type { ResumeLanguage, ResumeListItem, ResumeVersion } from "@/types/resume";
import type { CoverLetterListItem, CoverLetterResult } from "@/types/cover-letter";
import type { AuthUser } from "@/types/auth";
import type { Portfolio } from "@/types/portfolio";

import { experienceStore, libraryStore, presetStore, resumeStore, portfolioStore, coverLetterStore } from "./store";
import { DEMO_RESUME_VERSION_ID } from "./seed";
import { DEMO_PORTFOLIO_ID } from "./portfolio-seed";

// 짧은 인공 지연으로 실제 API 호출처럼 보이게 한다.
function delay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// ─── Experience ─────────────────────────────────────────────

export async function getExperiences(): Promise<ExperienceListData> {
  const list = experienceStore.list();
  return delay({ count: list.length, contents: list });
}

export async function getExperience(id: string): Promise<Experience> {
  const exp = experienceStore.get(id);
  if (!exp) throw new Error("not found");
  return delay(exp);
}

export async function createExperience(payload: ExperienceSavePayload): Promise<string> {
  const id = experienceStore.create(payload);
  return delay(id);
}

export async function updateExperience(id: string, payload: ExperienceUpdatePayload): Promise<void> {
  experienceStore.update(id, payload);
  await delay(undefined);
}

export async function updateExperienceImportance(id: string, importance: number | null): Promise<void> {
  experienceStore.update(id, { importance });
  await delay(undefined);
}

export async function deleteExperience(id: string): Promise<void> {
  experienceStore.delete(id);
  await delay(undefined);
}

export async function duplicateExperience(id: string): Promise<string> {
  const newId = experienceStore.duplicate(id);
  return delay(newId);
}

// ─── Library ────────────────────────────────────────────────

export async function getLibraries(): Promise<LibraryDTO[]> {
  return delay(libraryStore.list());
}

export async function createLibrary(payload: LibraryUpsertPayload): Promise<string> {
  const id = libraryStore.create(payload);
  return delay(id);
}

export async function updateLibrary(id: string, payload: LibraryUpsertPayload): Promise<void> {
  libraryStore.update(id, payload);
  await delay(undefined);
}

export async function deleteLibrary(id: string): Promise<void> {
  libraryStore.delete(id);
  await delay(undefined);
}

export async function getLibraryExperiences(id: string): Promise<ExperienceListData> {
  const list = libraryStore.experiencesIn(id);
  return delay({ count: list.length, contents: list });
}

export async function addExperienceToLibrary(libraryId: string, experienceId: string): Promise<void> {
  libraryStore.addExperience(libraryId, experienceId);
  await delay(undefined);
}

export async function removeExperienceFromLibrary(libraryId: string, experienceId: string): Promise<void> {
  libraryStore.removeExperience(libraryId, experienceId);
  await delay(undefined);
}

// ─── Preset ─────────────────────────────────────────────────

export async function getPresets(): Promise<PresetDTO[]> {
  return delay(presetStore.list());
}

export async function getPreset(id: string): Promise<PresetDTO> {
  const found = presetStore.get(id);
  if (!found) throw new Error("not found");
  return delay(found);
}

export async function createPreset(payload: PresetUpsertPayload): Promise<PresetDTO> {
  return delay(presetStore.create(payload));
}

export async function updatePreset(id: string, payload: PresetUpsertPayload): Promise<PresetDTO> {
  return delay(presetStore.update(id, payload));
}

export async function deletePreset(id: string): Promise<void> {
  presetStore.delete(id);
  await delay(undefined);
}

export async function duplicatePreset(id: string): Promise<string> {
  return delay(presetStore.duplicate(id));
}

// ─── Auth ───────────────────────────────────────────────────

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  // 데모 방문자를 인증된 사용자로 캐시하면 안 된다.
  // 그럴 경우 데모 종료 후 /signup·/login 으로 이동했을 때
  // useRedirectIfAuthenticated() 가 곧장 /dashboard 로 보내버려
  // 회원가입 흐름이 차단된다 (Codex P1).
  return delay(null);
}

export async function logoutUser(): Promise<void> {
  // 데모에서는 로그아웃이 의미가 없다.
  await delay(undefined);
}

export async function updateProfile(): Promise<void> {
  // 데모는 비인증(fetchCurrentUser→null)이라 설정 페이지에 도달하지 않는다.
  // auth-api 의 isDemoMode 분기 대칭을 위해 no-op 으로 둔다.
  await delay(undefined);
}

export async function deleteAccountWithPassword(): Promise<void> {
  // 데모에서는 실제 삭제가 없다.
  await delay(undefined);
}

export async function deleteAccountWithSocial(): Promise<void> {
  await delay(undefined);
}

// ─── Resume (Export) ────────────────────────────────────────

export async function createResume(params: {
  language: ResumeLanguage;
  experienceIds?: string[];
}): Promise<void> {
  void params; // 데모는 언어·경험 선택 무관하게 동일 시드를 쓴다
  // 실제 서버처럼 id 를 돌려주지 않되, 목록에는 새 항목이 남아야 한다.
  resumeStore.create();
  await delay(undefined, 600);
}

export async function getResume(versionId: string): Promise<ResumeVersion> {
  return delay(resumeStore.get(versionId));
}

export async function getResumeList(): Promise<ResumeListItem[]> {
  return delay(resumeStore.list());
}

export async function updateResume(versionId: string, data: ResumeVersion): Promise<ResumeVersion> {
  // 데모에서는 저장이 성공한다 — 성공했다고 말했으면 **저장한 내용이 남아야 한다**:
  // 되돌려주기만 하면 상세 화면이 임시 저장을 지우고 성공을 표시한 뒤, 목록에 갔다
  // 다시 열 때 시드가 편집을 조용히 덮는다(FRT-151, 커버레터와 같은 결함이었다).
  return delay(resumeStore.update(versionId, data));
}

export async function deleteResume(versionId: string): Promise<void> {
  // 목록 화면은 삭제 성공 시 로컬 state 에서만 행을 지운다 — 스토어에 남겨두면 목록을
  // 다시 부르는 순간 삭제한 레쥬메가 되살아난다.
  resumeStore.remove(versionId);
  await delay(undefined);
}

// ─── Portfolio (Export, demo-only) ──────────────────────────

export async function createPortfolio(): Promise<Portfolio> {
  // 실제 생성이 아니라 600ms 가짜 지연 후 미리 만든 시드를 반환한다 (레쥬메 데모와 동일).
  return delay(portfolioStore.get(), 600);
}

export async function getPortfolio(id: string): Promise<Portfolio | null> {
  // 공개 포트폴리오는 id 경계를 강제한다 — 알 수 없는 id 는 fail-closed(null).
  if (id !== DEMO_PORTFOLIO_ID) return delay(null);
  return delay(portfolioStore.get());
}

export const DEMO_RESUME_ID = DEMO_RESUME_VERSION_ID;

// ─── Cover letter (Export, FRT-140) ─────────────────────────

export async function createCoverLetter(params: {
  targetCompany?: string;
  targetJob?: string;
  questions: { question: string }[];
}): Promise<{ id: string | null }> {
  // 데모는 입력과 무관하게 같은 시드 본문을 쓴다. 다만 목록에 남는 제목만은 입력을 반영해
  // "내가 방금 만든 것"이 어느 행인지 알아볼 수 있게 한다.
  const label = [params.targetCompany?.trim(), params.targetJob?.trim()]
    .filter(Boolean)
    .join(" · ");
  coverLetterStore.create(label || undefined);
  // 실제 서버처럼 생성은 비동기다 — id 를 돌려주지 않고 목록에서 확인하게 한다.
  await delay(undefined, 900);
  return { id: null };
}

export async function getCoverLetter(id: string): Promise<CoverLetterResult> {
  return delay(coverLetterStore.get(id));
}

export async function getCoverLetterList(): Promise<CoverLetterListItem[]> {
  return delay(coverLetterStore.list());
}

export async function updateCoverLetter(
  id: string,
  data: CoverLetterResult,
): Promise<CoverLetterResult> {
  // 데모에서는 저장이 성공한다 — 서버 미구현 폴백(임시 저장 안내)은 실제 API 경로의 몫이다.
  // 성공했다고 말했으면 **저장한 내용이 남아야 한다**: 되돌려주기만 하면 상세 화면이 임시
  // 저장을 지우고 성공을 표시한 뒤, 다시 열 때 시드가 편집을 조용히 덮는다(codex P2).
  return delay(coverLetterStore.update(id, data));
}

export async function deleteCoverLetter(id: string): Promise<void> {
  coverLetterStore.remove(id);
  await delay(undefined);
}
