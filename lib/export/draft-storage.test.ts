import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  clearRaw,
  draftTierWarning,
  readRaw,
  writeRaw,
  __resetMemoryDrafts,
  MEMORY_DRAFT_LIMIT,
} from "./draft-storage";

const KEY = "arc:test-draft:1";

// jsdom 의 localStorage/sessionStorage 는 프록시라 **인스턴스에 건 spy 가 통째로 무시된다**
// (`vi.spyOn(window.localStorage, "setItem")` 은 조용히 아무것도 막지 않는다). 가로챌 수 있는
// 자리는 `Storage.prototype` 하나뿐인데 두 스토리지가 그 프로토타입을 공유하므로, 어느 쪽을
// 막을지는 호출 시점의 `this` 로 가른다.
const realSetItem = Storage.prototype.setItem;
const realGetItem = Storage.prototype.getItem;
const realRemoveItem = Storage.prototype.removeItem;

const blockedWrites = new Set<Storage>();
const blockedReads = new Set<Storage>();
const blockedRemovals = new Set<Storage>();

/** 이 스토리지의 쓰기를 막는다 — 용량 초과·프라이빗 모드가 실제로 이렇게 던진다. */
function breakWrites(storage: Storage) {
  blockedWrites.add(storage);
}

/** 막았던 쓰기를 되살린다 — 사용자가 공간을 비운 상황. */
function healWrites(storage: Storage) {
  blockedWrites.delete(storage);
}

function breakReads(storage: Storage) {
  blockedReads.add(storage);
}

function breakRemovals(storage: Storage) {
  blockedRemovals.add(storage);
}

function denied(): never {
  throw new DOMException("storage unavailable", "QuotaExceededError");
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  __resetMemoryDrafts();
  blockedWrites.clear();
  blockedReads.clear();
  blockedRemovals.clear();

  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    k: string,
    v: string,
  ) {
    if (blockedWrites.has(this)) denied();
    return realSetItem.call(this, k, v);
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, k: string) {
    if (blockedReads.has(this)) denied();
    return realGetItem.call(this, k);
  });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, k: string) {
    if (blockedRemovals.has(this)) denied();
    return realRemoveItem.call(this, k);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writeRaw — 위 계층이 막히면 아래로 내려간다", () => {
  it("정상이면 localStorage 에 쓰고 'local' 을 알린다", () => {
    expect(writeRaw(KEY, "값")).toBe("local");
    expect(window.localStorage.getItem(KEY)).toBe("값");
  });

  it("localStorage 가 막히면 sessionStorage 로 내려간다", () => {
    breakWrites(window.localStorage);

    expect(writeRaw(KEY, "값")).toBe("session");
    expect(window.sessionStorage.getItem(KEY)).toBe("값");
  });

  it("둘 다 막히면 메모리에 들고 있는다", () => {
    breakWrites(window.localStorage);
    breakWrites(window.sessionStorage);

    expect(writeRaw(KEY, "값")).toBe("memory");
    // 어느 스토리지에도 남지 않았지만 읽기는 성립한다.
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(readRaw(KEY)).toBe("값");
  });
});

/**
 * 이 파일의 핵심 불변식이다. 계층이 여럿인데 낡은 값이 위 계층에 남으면, 읽기는 **항상**
 * 위부터 보므로 새 편집을 덮어쓴 옛 편집을 복원하게 된다 — 저장 실패를 구제하려다 저장
 * 성공분을 잃는 정반대 결과가 된다.
 */
describe("draft 는 언제나 한 계층에만 산다", () => {
  it("session 으로 내려갈 때 localStorage 의 옛 값을 지운다", () => {
    expect(writeRaw(KEY, "옛 편집")).toBe("local");

    breakWrites(window.localStorage);
    expect(writeRaw(KEY, "새 편집")).toBe("session");

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(readRaw(KEY)).toBe("새 편집");
  });

  it("메모리로 내려갈 때 두 스토리지의 옛 값을 모두 지운다", () => {
    window.localStorage.setItem(KEY, "옛 local");
    window.sessionStorage.setItem(KEY, "옛 session");

    breakWrites(window.localStorage);
    breakWrites(window.sessionStorage);
    expect(writeRaw(KEY, "새 편집")).toBe("memory");

    expect(readRaw(KEY)).toBe("새 편집");
  });

  /**
   * 한 계층 규칙은 "위 계층을 비운다"에 기대는데, 그 **삭제 자체가 막힐 수 있다**(쓰기 계열
   * 전체를 차단하는 환경). 그러면 위에 옛 값이 남고 읽기는 위부터 보므로, 방금 아래에 쓴 새
   * 편집 대신 옛 편집이 복원된다 — 이 파일이 막으려는 바로 그 유실이 되돌아온다.
   */
  it("비우지 못한 계층의 옛 값은 읽기에서 건너뛴다", () => {
    expect(writeRaw(KEY, "옛 편집")).toBe("local");

    // 이 환경은 쓰기도 삭제도 막는다 — 옛 값이 local 에 그대로 남는다.
    breakWrites(window.localStorage);
    breakRemovals(window.localStorage);
    expect(writeRaw(KEY, "새 편집")).toBe("session");

    // local 에는 여전히 옛 값이 물리적으로 남아 있다.
    expect(window.localStorage.getItem(KEY)).toBe("옛 편집");
    // 그래도 사용자가 되찾는 것은 새 편집이어야 한다.
    expect(readRaw(KEY)).toBe("새 편집");
  });

  it("다시 localStorage 가 살아나면 아래 계층의 잔재를 지운다", () => {
    breakWrites(window.localStorage);
    expect(writeRaw(KEY, "임시 보관분")).toBe("session");

    healWrites(window.localStorage);
    expect(writeRaw(KEY, "복구 후 편집")).toBe("local");

    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    expect(readRaw(KEY)).toBe("복구 후 편집");
  });
});

describe("readRaw — 위 계층부터 본다", () => {
  it("아무 데도 없으면 null", () => {
    expect(readRaw(KEY)).toBeNull();
  });

  it("local 이 있으면 session 보다 먼저다", () => {
    window.localStorage.setItem(KEY, "local 값");
    window.sessionStorage.setItem(KEY, "session 값");

    expect(readRaw(KEY)).toBe("local 값");
  });

  it("local 이 없으면 session 을 본다", () => {
    window.sessionStorage.setItem(KEY, "session 값");

    expect(readRaw(KEY)).toBe("session 값");
  });

  it("스토리지 읽기 자체가 던져도 아래 계층으로 이어간다", () => {
    window.sessionStorage.setItem(KEY, "session 값");
    breakReads(window.localStorage);

    expect(readRaw(KEY)).toBe("session 값");
  });
});

describe("clearRaw — 세 계층을 모두 지운다", () => {
  it("한 계층만 지우면 지운 줄 알았던 draft 가 아래에서 되살아난다", () => {
    window.localStorage.setItem(KEY, "local 값");
    window.sessionStorage.setItem(KEY, "session 값");
    breakWrites(window.localStorage);
    breakWrites(window.sessionStorage);
    writeRaw("other", "메모리 점유");
    healWrites(window.localStorage);
    healWrites(window.sessionStorage);

    clearRaw(KEY);

    expect(readRaw(KEY)).toBeNull();
  });

  it("메모리 계층도 지운다", () => {
    breakWrites(window.localStorage);
    breakWrites(window.sessionStorage);
    writeRaw(KEY, "메모리 값");
    healWrites(window.localStorage);
    healWrites(window.sessionStorage);

    clearRaw(KEY);

    expect(readRaw(KEY)).toBeNull();
  });

  it("스토리지 삭제가 던져도 나머지 계층 정리를 계속한다", () => {
    breakWrites(window.localStorage);
    breakWrites(window.sessionStorage);
    writeRaw(KEY, "메모리 값");
    healWrites(window.localStorage);
    healWrites(window.sessionStorage);
    breakRemovals(window.localStorage);

    expect(() => clearRaw(KEY)).not.toThrow();
    expect(readRaw(KEY)).toBeNull();
  });
});

describe("메모리 계층은 무한히 자라지 않는다", () => {
  it(`상한(${MEMORY_DRAFT_LIMIT})을 넘으면 가장 오래된 것부터 버린다`, () => {
    breakWrites(window.localStorage);
    breakWrites(window.sessionStorage);

    const keys = Array.from({ length: MEMORY_DRAFT_LIMIT + 1 }, (_, i) => `doc:${i}`);
    keys.forEach((k) => writeRaw(k, `본문 ${k}`));
    healWrites(window.localStorage);
    healWrites(window.sessionStorage);

    expect(readRaw(keys[0])).toBeNull();
    keys.slice(1).forEach((k) => {
      expect(readRaw(k)).toBe(`본문 ${k}`);
    });
  });

  it("같은 문서를 다시 쓰면 자리를 새로 차지하지 않는다", () => {
    breakWrites(window.localStorage);
    breakWrites(window.sessionStorage);

    writeRaw("doc:0", "첫 편집");
    for (let i = 1; i < MEMORY_DRAFT_LIMIT; i += 1) writeRaw(`doc:${i}`, `본문 ${i}`);
    // 상한을 꽉 채운 상태에서 기존 문서를 갱신한다 — 새 자리를 차지한다면 doc:0 이 밀려난다.
    writeRaw("doc:0", "두 번째 편집");
    healWrites(window.localStorage);
    healWrites(window.sessionStorage);

    expect(readRaw("doc:0")).toBe("두 번째 편집");
  });
});

/**
 * 경고 문구는 **사용자가 취할 행동**을 가른다. 계층마다 잃는 조건이 다르므로 한 문장으로
 * 뭉치면 "지금 뭘 해야 하는지"가 사라진다.
 */
describe("draftTierWarning — 얼마나 못 버티는지를 알린다", () => {
  it("local 은 정상 경로라 경고하지 않는다", () => {
    expect(draftTierWarning("local")).toBeNull();
  });

  it("session 은 탭을 닫으면 잃는다고 알린다", () => {
    expect(draftTierWarning("session")).toContain("탭");
  });

  it("memory 는 새로고침으로도 잃는다고 알린다 — session 보다 강한 경고다", () => {
    const warning = draftTierWarning("memory");
    expect(warning).toContain("새로고침");
    expect(warning).not.toBe(draftTierWarning("session"));
  });

  it("null 은 아무 데도 못 담았다는 뜻이라 반드시 경고한다", () => {
    expect(draftTierWarning(null)).toBeTruthy();
  });
});
