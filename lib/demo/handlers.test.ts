import { describe, expect, it } from "vitest";

import {
  createResume,
  deleteResume,
  getResume,
  getResumeList,
  updateResume,
} from "./handlers";

/**
 * 방금 만든 버전의 id 를 얻는다 — createResume 은 실제 서버처럼 id 를 돌려주지 않는다.
 *
 * 데모 스토어는 모듈 스코프 상태라 테스트끼리 새어나간다. 각 케이스가 **자기가 만든 id 만**
 * 건드리도록 새 버전을 만들어 쓴다(시드 id 를 편집·삭제하면 다른 케이스가 깨진다).
 */
async function createAndGetId(): Promise<string> {
  await createResume({ language: "ko" });
  const list = await getResumeList();
  return list[0].version_id;
}

/**
 * 데모 이력서 생성 회귀 가드.
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

/**
 * 데모 이력서 저장 회귀 가드 (FRT-151).
 *
 * 데모는 버전을 여러 개 만들어도 본문은 시드 하나를 공유한다. 그래도 **저장이 성공했다고
 * 말했으면 그 편집은 남아야 한다** — 되돌려주기만 하면 상세 화면이 성공 토스트를 띄우고
 * 임시 저장까지 지운 뒤, 목록에 갔다 다시 열 때 시드가 편집을 조용히 덮는다.
 */
describe("demo updateResume", () => {
  it("저장한 편집이 목록에 갔다 다시 열어도 남아 있다", async () => {
    const versionId = await createAndGetId();
    const seed = await getResume(versionId);

    await updateResume(versionId, { ...seed, 자기소개_요약: "데모에서 고친 요약" });

    const reopened = await getResume(versionId);
    expect(reopened.자기소개_요약).toBe("데모에서 고친 요약");
  });

  it("편집은 그 버전에만 남는다 — 손대지 않은 버전은 시드를 본다", async () => {
    const edited = await createAndGetId();
    const untouched = await createAndGetId();
    const seed = await getResume(untouched);

    await updateResume(edited, { ...seed, 자기소개_요약: "편집한 버전만 바뀐다" });

    const other = await getResume(untouched);
    expect(other.자기소개_요약).toBe(seed.자기소개_요약);
    expect(other.자기소개_요약).not.toBe("편집한 버전만 바뀐다");
  });
});

/**
 * 데모 이력서 삭제 회귀 가드 (FRT-151).
 *
 * 목록 화면은 삭제 성공 시 로컬 state 에서만 행을 지운다. 스토어에 남겨두면 목록을 다시
 * 부르는 순간(생성·재진입) 삭제한 이력서가 되살아난다.
 */
describe("demo deleteResume", () => {
  it("삭제한 이력서는 목록을 다시 불러도 부활하지 않는다", async () => {
    const versionId = await createAndGetId();
    const before = await getResumeList();
    expect(before.some((r) => r.version_id === versionId)).toBe(true);

    await deleteResume(versionId);

    const after = await getResumeList();
    expect(after.some((r) => r.version_id === versionId)).toBe(false);
    expect(after).toHaveLength(before.length - 1);
  });
});
