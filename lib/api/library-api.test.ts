import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

// 데모 분기가 켜지면 실제 호출 경로를 우회해 이 테스트가 아무것도 검증하지 않게 된다.
vi.mock("@/lib/demo/state", () => ({ isDemoMode: () => false }));

import { api } from "./client";
import { deleteLibrary, updateLibrary } from "./library-api";

const mockPut = vi.mocked(api.put);
const mockPatch = vi.mocked(api.patch);
const mockDelete = vi.mocked(api.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── 부분 수정의 메서드 ────────────────────────────────────────────────
//
// 서버의 정본은 `PATCH /libraries/{id}` 다. 한때 프론트가 `PUT` 으로 불러 405 가
// 났고(FRT-142), 백엔드가 같은 핸들러에 `@put` 데코레이터를 덧붙여 급한 불을 껐다
// (arc-backend `4385961`, BAC-32). 즉 지금 PUT 이 동작하는 것은 우리를 위해 남겨진
// **별칭** 덕분이고, 그 별칭이 정리되는 순간 이름·색상 변경이 다시 405 로 죽는다.
// 핸들러가 `exclude_unset=True` 로 부분 병합하는 것도 PATCH 의미론이다.
// 이 테스트는 그 별칭에 다시 기대게 되는 회귀를 막는다.
describe("updateLibrary — 서버 계약 메서드", () => {
  it("이름 변경을 PATCH 로 보낸다", async () => {
    await updateLibrary("lib-1", { name: "새 이름" });

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch.mock.calls[0][0]).toBe("/libraries/lib-1");
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ name: "새 이름" });
  });

  it("색상 변경을 PATCH 로 보낸다", async () => {
    await updateLibrary("lib-1", { color: "#FF0000" });

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch.mock.calls[0][0]).toBe("/libraries/lib-1");
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ color: "#FF0000" });
  });

  it("PUT 은 쓰지 않는다 — 서버에 남은 별칭이지 계약이 아니다", async () => {
    await updateLibrary("lib-1", { name: "새 이름" });

    expect(mockPut).not.toHaveBeenCalled();
  });
});

describe("deleteLibrary", () => {
  it("DELETE 로 보낸다", async () => {
    await deleteLibrary("lib-1");

    expect(mockDelete).toHaveBeenCalledWith("/libraries/lib-1");
  });
});
