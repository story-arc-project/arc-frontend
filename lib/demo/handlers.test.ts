import { describe, expect, it } from "vitest";

import { createResume, getResumeList } from "./handlers";

/**
 * 데모 레쥬메 생성 회귀 가드.
 *
 * 실제 서버처럼 createResume 은 id 를 돌려주지 않는다. 그래도 생성 직후 목록을 다시
 * 부르면 새 항목이 보여야 한다 — 모달이 "만들고 있어요" 안내 후 목록만 갱신하기 때문에,
 * 목록이 시드에 고정돼 있으면 데모의 생성 성공 경로가 눈에 띄게 깨진다.
 */
describe("demo createResume", () => {
  it("생성 후 목록 최상단에 새 항목이 추가된다", async () => {
    const before = await getResumeList();

    await createResume({ language: "ko" });

    const after = await getResumeList();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0].version_id).not.toBe(before[0]?.version_id);
    expect(after[0].created_at).not.toBe("");
    expect(after.slice(1)).toEqual(before);
  });
});
