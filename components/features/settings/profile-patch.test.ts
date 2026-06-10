import { describe, it, expect } from "vitest";
import { buildProfilePatch, type ProfileFormState } from "./profile-patch";

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
