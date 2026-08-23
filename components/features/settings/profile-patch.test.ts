import { describe, it, expect } from "vitest";
import {
  buildProfilePatch,
  partitionByOptions,
  type ProfileFormState,
} from "./profile-patch";

const base: ProfileFormState = {
  name: "홍길동",
  birth: "2000-01-01",
  phone: "01012345678",
  affiliation: "student",
  school: "한양대학교",
  department: "컴퓨터소프트웨어학부",
  worry: ["진로/방향성"],
  interest: ["개발/엔지니어링"],
};

describe("buildProfilePatch", () => {
  it("변경이 없으면 빈 객체를 반환한다", () => {
    expect(buildProfilePatch(base, { ...base })).toEqual({});
  });

  it("바뀐 스칼라 필드만 포함한다", () => {
    const patch = buildProfilePatch(base, { ...base, name: "김철수" });
    expect(patch).toEqual({ name: "김철수" });
  });

  it("phone 변경 시 숫자 문자열을 그대로 보낸다", () => {
    const patch = buildProfilePatch(base, { ...base, phone: "01099998888" });
    expect(patch).toEqual({ phone: "01099998888" });
  });

  it("worry/interest는 집합이 달라질 때만 포함한다", () => {
    // 순서만 다르면 동일 집합 → 미포함
    const reordered = buildProfilePatch(base, {
      ...base,
      interest: ["개발/엔지니어링"],
    });
    expect(reordered).toEqual({});

    const changed = buildProfilePatch(base, {
      ...base,
      worry: ["진로/방향성", "취업/인턴"],
    });
    expect(changed).toEqual({ worry: ["진로/방향성", "취업/인턴"] });
  });

  it("affiliation이 student로 유지될 때 school만 바뀌면 school만 보낸다", () => {
    const patch = buildProfilePatch(base, { ...base, school: "서울대학교" });
    expect(patch).toEqual({ school: "서울대학교" });
  });

  it("affiliation이 student로 새로 바뀌면 affiliation+school+department를 함께 보낸다", () => {
    const initial: ProfileFormState = { ...base, affiliation: "employed", school: "", department: "" };
    const current: ProfileFormState = {
      ...initial,
      affiliation: "student",
      school: "고려대학교",
      department: "경영학과",
    };
    const patch = buildProfilePatch(initial, current);
    expect(patch).toEqual({
      affiliation: "student",
      school: "고려대학교",
      department: "경영학과",
    });
  });

  it("affiliation이 student가 아닌 값으로 바뀌면 school/department는 보내지 않는다(교차검증 보호)", () => {
    const current: ProfileFormState = { ...base, affiliation: "employed" };
    const patch = buildProfilePatch(base, current);
    expect(patch).toEqual({ affiliation: "employed" });
  });

  it("affiliation이 비어있으면(미선택) 보내지 않는다", () => {
    const initial: ProfileFormState = { ...base, affiliation: "student" };
    const current: ProfileFormState = { ...initial, affiliation: "" };
    const patch = buildProfilePatch(initial, current);
    expect(patch).toEqual({});
  });
});

/* ── FRT-260: 옵션 목록 밖 값 보존 ────────────────────────────
 * PATCH /auth/profile 은 필드가 실리면 값 전체를 교체한다(backend auth.py:
 * `if body.worry is not None: user_profile.worry = body.worry`).
 * 화면은 현재 옵션 목록만 렌더하므로, 걸러진 값을 저장 시 다시 합치지 않으면
 * 사용자가 본 적도 없는 값이 무관한 칩 하나를 토글하는 순간 영구 삭제된다.
 */
describe("partitionByOptions", () => {
  const OPTIONS = ["진로/방향성", "취업/인턴"] as const;

  it("옵션 목록에 있는 값과 없는 값을 갈라 담는다", () => {
    const { known, unknown } = partitionByOptions(
      ["진로/방향성", "개편전-고민", "취업/인턴"],
      OPTIONS
    );
    expect(known).toEqual(["진로/방향성", "취업/인턴"]);
    expect(unknown).toEqual(["개편전-고민"]);
  });

  it("전부 옵션 안 값이면 unknown 은 비어 있다", () => {
    const { known, unknown } = partitionByOptions(["취업/인턴"], OPTIONS);
    expect(known).toEqual(["취업/인턴"]);
    expect(unknown).toEqual([]);
  });

  it("빈 배열을 넣으면 양쪽 다 비어 있다", () => {
    const { known, unknown } = partitionByOptions([], OPTIONS);
    expect(known).toEqual([]);
    expect(unknown).toEqual([]);
  });
});

describe("buildProfilePatch — 옵션 밖 값 보존(FRT-260)", () => {
  const preserved = { worry: ["개편전-고민"], interest: ["개편전-관심사"] };

  it("worry 가 바뀌면 화면에 없는 레거시 값을 합쳐 보낸다", () => {
    const patch = buildProfilePatch(
      base,
      { ...base, worry: ["진로/방향성", "취업/인턴"] },
      preserved
    );
    expect(patch.worry).toEqual([
      "진로/방향성",
      "취업/인턴",
      "개편전-고민",
    ]);
  });

  it("interest 가 바뀌면 화면에 없는 레거시 값을 합쳐 보낸다", () => {
    const patch = buildProfilePatch(
      base,
      { ...base, interest: ["디자인/UX"] },
      preserved
    );
    expect(patch.interest).toEqual(["디자인/UX", "개편전-관심사"]);
  });

  it("화면에서 칩을 전부 해제해도 레거시 값은 남는다", () => {
    const patch = buildProfilePatch(base, { ...base, worry: [] }, preserved);
    expect(patch.worry).toEqual(["개편전-고민"]);
  });

  it("worry 만 바뀌면 interest 는 실리지 않는다 — 레거시 값이 있어도 dirty 가 되지 않는다", () => {
    const patch = buildProfilePatch(
      base,
      { ...base, worry: ["취업/인턴"] },
      preserved
    );
    expect(patch.interest).toBeUndefined();
    expect(Object.keys(patch)).toEqual(["worry"]);
  });

  it("아무것도 바뀌지 않으면 레거시 값이 있어도 빈 객체다", () => {
    expect(buildProfilePatch(base, { ...base }, preserved)).toEqual({});
  });

  it("preserved 를 생략하면 기존 동작 그대로다", () => {
    const patch = buildProfilePatch(base, { ...base, worry: [] });
    expect(patch).toEqual({ worry: [] });
  });

  it("레거시 값이 화면 값과 겹쳐도 중복으로 싣지 않는다", () => {
    const patch = buildProfilePatch(
      base,
      { ...base, worry: ["진로/방향성", "취업/인턴"] },
      { worry: ["취업/인턴"], interest: [] }
    );
    expect(patch.worry).toEqual(["진로/방향성", "취업/인턴"]);
  });
});
