import { describe, it, expect, beforeEach, vi } from "vitest";

import { isStoredDraft, readDraft, writeDraft } from "./resume-draft";
import type { ResumeVersion } from "@/types/resume";

function resume(링크: unknown): ResumeVersion {
  return {
    meta: {
      language: "ko",
      format: "korean_resume",
      generated_at: "2026-07-20",
      source_chars: 100,
    },
    인적사항: {
      이름: "홍길동",
      영문명: null,
      생년월일: null,
      이메일: null,
      전화번호: null,
      주소: null,
      링크: 링크 as never,
    },
    학력: [],
    경력: [],
    자격증: [],
    어학: [],
    대외활동: [],
    프로젝트: [],
    수상: [],
    기술및역량: { 기술스택: [], 툴: [], 소프트스킬: [] },
    동아리_학회: [],
    연계성: [],
    자기소개_요약: null,
    파싱경고: [],
  };
}

beforeEach(() => {
  window.localStorage.clear();
  // draft 는 이제 아래 계층으로도 떨어진다 — 여기를 안 비우면 앞 테스트의 draft 가
  // 다음 테스트의 readDraft 에 잡힌다.
  window.sessionStorage.clear();
});

// localStorage 가 막힌 환경(프라이빗 모드·용량 초과)에서도 편집은 살아야 한다(FRT-261).
// 계층 자체는 draft-storage 가 검증한다 — 여기서 보는 것은 아래 계층으로 떨어진 draft 도
// **정규화를 태워 돌아오는가**다(링크 정규화가 이 파일의 오래된 계약이다).
describe("localStorage 가 막혀도 편집을 잃지 않는다", () => {
  it("아래 계층으로 담기고, 읽을 때 정규화를 거친다", () => {
    const realSetItem = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, k: string, v: string) {
        if (this === window.localStorage) {
          throw new DOMException("quota exceeded", "QuotaExceededError");
        }
        return realSetItem.call(this, k, v);
      });

    expect(writeDraft("v-fallback", resume("https://example.com"))).toBe("session");
    spy.mockRestore();

    expect(readDraft("v-fallback")?.data.meta.language).toBe("ko");
  });
});

/**
 * 임시 저장은 레쥬메 본문이 들어오는 **또 하나의 경계**다. getResume 만 정규화하면,
 * 이 변경 이전에 저장된(문자열 링크가 그대로 들어 있는) draft 를 복원할 때 정규화를
 * 우회해 링크가 화면에서 사라지는 증상이 되살아난다.
 */
describe("readDraft — 링크 정규화 (codex P2)", () => {
  it("문자열 링크가 든 구 draft 를 복원해도 객체로 정규화한다", () => {
    window.localStorage.setItem(
      "arc:resume-draft:v1",
      JSON.stringify({
        data: resume(["https://github.com/me"]),
        updated_at: "2026-07-21T00:00:00.000Z",
      }),
    );

    const draft = readDraft("v1");
    expect(draft?.data.인적사항.링크).toEqual([
      { label: null, url: "https://github.com/me" },
    ]);
  });

  it("정상 객체 draft 는 그대로 통과시킨다", () => {
    writeDraft("v2", resume([{ label: "GitHub", url: "https://github.com/me" }]));

    const draft = readDraft("v2");
    expect(draft?.data.인적사항.링크).toEqual([
      { label: "GitHub", url: "https://github.com/me" },
    ]);
  });

  it("저장된 값이 없으면 null 을 그대로 돌려준다", () => {
    expect(readDraft("missing")).toBeNull();
  });
});

/**
 * `true` 는 호출부에서 `clearDraft` 로 이어진다 — 저장소의 draft 가 "내가 담은 그 본문"일 때만
 * 참이어야 다른 탭이 같은 키에 남긴 더 새 편집을 치우지 않는다.
 */
describe("isStoredDraft — 저장소의 draft 가 이 본문인가", () => {
  it("같은 본문을 담았으면 참이다(정규화를 거치지 않고 원문 그대로 비교한다)", () => {
    const data = resume([]);
    writeDraft("v1", data);
    expect(isStoredDraft("v1", data)).toBe(true);
  });

  it("다른 본문이 담겨 있거나, 아무것도 없거나, 깨진 값이면 거짓이다", () => {
    const mine = resume([]);
    expect(isStoredDraft("v1", mine)).toBe(false);

    writeDraft("v1", { ...mine, 자기소개_요약: "다른 탭" });
    expect(isStoredDraft("v1", mine)).toBe(false);

    window.localStorage.setItem("arc:resume-draft:v1", "{broken");
    expect(isStoredDraft("v1", mine)).toBe(false);
  });
});
