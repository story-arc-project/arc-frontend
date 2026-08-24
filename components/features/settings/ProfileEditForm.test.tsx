import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Profile } from "@/types/auth";

const updateProfile = vi.fn();
const refetch = vi.fn();

vi.mock("@/lib/api/auth-api", () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ refetch }),
}));

import { ProfileEditForm } from "./ProfileEditForm";

// globals:false 라 자동 cleanup 이 없다(.claude/rules/testing.md).
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  updateProfile.mockReset().mockResolvedValue(undefined);
  refetch.mockReset().mockResolvedValue(undefined);
});

/**
 * FRT-260 — 옵션 목록이 개편되면 서버에는 남았지만 화면에는 그릴 수 없는 값이 생긴다.
 * PATCH /auth/profile 은 필드가 실리면 값 전체를 교체하므로, 그 값을 다시 합쳐 보내지
 * 않으면 무관한 칩 하나를 토글하는 것만으로 영구 삭제된다.
 */
const LEGACY_WORRY = "개편전-고민";
const LEGACY_INTEREST = "개편전-관심사";

const profile: Profile = {
  name: "홍길동",
  birth: "2000-01-01",
  phone: "01012345678",
  affiliation: "student",
  school: "한양대학교",
  department: "컴퓨터소프트웨어학부",
  worry: ["진로/방향성", LEGACY_WORRY],
  interest: ["개발/엔지니어링", LEGACY_INTEREST],
};

function saveButton() {
  return screen.getByRole("button", { name: "저장" });
}

/**
 * FRT-312 — 고민·관심사 칩이 선택 상태를 색으로만 보여줘 스크린리더로는
 * 어떤 항목을 골랐는지 알 수 없었다. 공용 Chip 이 aria-pressed 를 내보내므로
 * 이 화면에서 실제로 "선택됨/선택 안 됨"이 읽히는지 확인한다.
 */
describe("ProfileEditForm — 칩 선택 상태가 스크린리더에 읽힌다(FRT-312)", () => {
  it("저장된 고민·관심사는 선택됨, 나머지는 선택 안 됨으로 노출된다", () => {
    render(<ProfileEditForm profile={profile} />);
    expect(screen.getByRole("button", { name: "진로/방향성", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취업/인턴", pressed: false })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "개발/엔지니어링", pressed: true })
    ).toBeInTheDocument();
  });

  it("칩을 다시 누르면 선택 안 됨으로 바뀐다", async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm profile={profile} />);

    await user.click(screen.getByRole("button", { name: "진로/방향성", pressed: true }));

    expect(screen.getByRole("button", { name: "진로/방향성", pressed: false })).toBeInTheDocument();
  });
});

describe("ProfileEditForm — 옵션 목록 밖 값 보존(FRT-260)", () => {
  it("옵션 밖 값은 화면에 칩으로 뜨지 않는다 — 사용자는 그 값의 존재를 알 수 없다", () => {
    render(<ProfileEditForm profile={profile} />);
    expect(screen.queryByText(LEGACY_WORRY)).toBeNull();
    expect(screen.queryByText(LEGACY_INTEREST)).toBeNull();
    // 전제 확인: 옵션 안 값은 실제로 렌더된다(위 단언이 공허하지 않다는 증거).
    expect(screen.getByText("진로/방향성")).toBeTruthy();
  });

  it("고민 칩 하나를 토글해 저장하면 화면에 없던 값도 함께 실려 나간다", async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm profile={profile} />);

    await user.click(screen.getByText("취업/인턴"));
    await user.click(saveButton());

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    const patch = updateProfile.mock.calls[0][0];
    expect(patch.worry).toContain(LEGACY_WORRY);
    expect(patch.worry).toEqual(
      expect.arrayContaining(["진로/방향성", "취업/인턴", LEGACY_WORRY])
    );
  });

  it("고민만 바꾸면 관심사는 아예 실리지 않는다 — 건드리지 않은 필드는 교체 대상이 아니다", async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm profile={profile} />);

    await user.click(screen.getByText("취업/인턴"));
    await user.click(saveButton());

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile.mock.calls[0][0].interest).toBeUndefined();
  });

  it("관심사 칩을 토글해 저장하면 관심사 쪽 레거시 값도 보존된다", async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm profile={profile} />);

    await user.click(screen.getByText("디자인/UX"));
    await user.click(saveButton());

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile.mock.calls[0][0].interest).toContain(LEGACY_INTEREST);
  });

  it("보이는 칩을 전부 해제해도 레거시 값은 살아남는다", async () => {
    const user = userEvent.setup();
    render(<ProfileEditForm profile={profile} />);

    await user.click(screen.getByText("진로/방향성")); // 유일하게 선택돼 있던 칩 해제
    await user.click(saveButton());

    await waitFor(() => expect(updateProfile).toHaveBeenCalledTimes(1));
    expect(updateProfile.mock.calls[0][0].worry).toEqual([LEGACY_WORRY]);
  });

  it("레거시 값이 있어도 아무것도 만지지 않으면 저장 버튼이 켜지지 않는다", () => {
    render(<ProfileEditForm profile={profile} />);
    expect(saveButton().hasAttribute("disabled")).toBe(true);
  });
});
