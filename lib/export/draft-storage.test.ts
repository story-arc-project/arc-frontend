import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  clearRaw,
  draftTierWarning,
  readRaw,
  writeRaw,
  __resetMemoryDrafts,
  MEMORY_DRAFT_BUDGET_CHARS,
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
/** 키를 가려서 막는다 — "본문은 받아 줬는데 묘비는 못 받은" 자리를 재현한다. */
const blockedKeyWrites = new Map<Storage, (key: string) => boolean>();

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

function healRemovals(storage: Storage) {
  blockedRemovals.delete(storage);
}

function breakWritesFor(storage: Storage, match: (key: string) => boolean) {
  blockedKeyWrites.set(storage, match);
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
  blockedKeyWrites.clear();

  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    k: string,
    v: string,
  ) {
    if (blockedWrites.has(this) || blockedKeyWrites.get(this)?.(k)) denied();
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

/**
 * 계층을 건너뛰게 하는 표시가 **모듈 스코프에만** 살면 새로고침에 죽는다. 그런데 지우지
 * 못한 옛 값은 localStorage 에 그대로 살아남고 sessionStorage 의 새 편집도 살아남는다 —
 * 리로드 후 읽기가 다시 위부터 보면서 옛 값을 집어, 이 파일이 막으려는 유실이 되돌아온다.
 *
 * 리로드는 "모듈 상태만 초기화되고 웹 스토리지 내용은 남는 것"으로 흉내 낸다.
 */
describe("표시는 새로고침을 견뎌야 한다", () => {
  function simulateReload() {
    __resetMemoryDrafts();
  }

  it("비우지 못한 옛 값은 리로드 뒤에도 새 편집을 덮지 않는다", () => {
    expect(writeRaw(KEY, "옛 편집")).toBe("local");

    breakWrites(window.localStorage);
    breakRemovals(window.localStorage);
    expect(writeRaw(KEY, "새 편집")).toBe("session");

    simulateReload();

    // local 에는 여전히 옛 값이, session 에는 새 편집이 남아 있다.
    expect(window.localStorage.getItem(KEY)).toBe("옛 편집");
    expect(readRaw(KEY)).toBe("새 편집");
  });

  /**
   * 스토리지는 **프로퍼티 접근만으로도** 던진다(정책으로 차단된 브라우저). 그때는 지울 수도
   * 없는데, "지웠다"고 보면 표시가 남지 않는다 — 나중에 접근이 **풀리면** 옛 값이 그대로
   * 되살아나 새 편집을 덮는다. 못 지운 것과 못 들여다본 것은 결과가 같다.
   */
  function breakAccess(prop: "localStorage" | "sessionStorage"): () => void {
    let target: object = window;
    let desc = Object.getOwnPropertyDescriptor(window, prop);
    while (!desc) {
      target = Object.getPrototypeOf(target) as object;
      if (target === null) break;
      desc = Object.getOwnPropertyDescriptor(target, prop);
    }
    Object.defineProperty(window, prop, {
      configurable: true,
      get() {
        throw new DOMException("storage blocked", "SecurityError");
      },
    });
    return () => {
      delete (window as unknown as Record<string, unknown>)[prop];
      if (desc) Object.defineProperty(target, prop, desc);
    };
  }

  it("접근조차 못 한 계층의 옛 값은, 접근이 풀린 뒤에도 새 편집을 덮지 않는다", () => {
    expect(writeRaw(KEY, "옛 편집")).toBe("local");

    // 정책이 바뀌어 localStorage 를 아예 못 만지게 됐다.
    const restore = breakAccess("localStorage");
    try {
      expect(writeRaw(KEY, "새 편집")).toBe("session");
    } finally {
      // 사용자가 설정을 되돌렸다 — 접근이 살아난다.
      restore();
    }

    simulateReload();

    expect(window.localStorage.getItem(KEY)).toBe("옛 편집");
    expect(readRaw(KEY)).toBe("새 편집");
  });

  it("접근을 못 한 채 지운 draft 는 접근이 풀려도 되살아나지 않는다", () => {
    expect(writeRaw(KEY, "저장 끝난 draft")).toBe("local");

    const restore = breakAccess("localStorage");
    try {
      clearRaw(KEY);
    } finally {
      restore();
    }

    simulateReload();

    expect(readRaw(KEY)).toBeNull();
  });


  /**
   * 표시를 **남기지 못했는데도** "session 에 담았다"고 답하면, 그 경고("탭을 닫으면 사라진다")는
   * 새로고침은 견딘다고 약속하는 셈이다. 그런데 표시가 모듈 스코프에만 있으면 리로드에 죽고
   * 위 계층의 옛 값이 그대로 새 편집을 덮는다 — 지킬 수 없는 약속이다. 지킬 수 있는 만큼만
   * 약속하도록 한 계층 더 내려간다.
   */
  it("묘비를 못 남긴 계층은 안전한 집이 아니다 — 한 계층 더 내려가 사실대로 경고한다", () => {
    expect(writeRaw(KEY, "옛 편집")).toBe("local");

    // 이 환경은 local 의 쓰기도 삭제도 막는다 — 옛 값이 local 에 남는다.
    breakWrites(window.localStorage);
    breakRemovals(window.localStorage);
    // session 은 본문은 받아 주지만 묘비 한 줄은 못 받는다.
    breakWritesFor(window.sessionStorage, (k) => k.startsWith("arc:draft-stale:"));

    expect(writeRaw(KEY, "새 편집")).toBe("memory");
    expect(readRaw(KEY)).toBe("새 편집");
  });

  /**
   * 값을 못 읽어 지문을 못 뜬 묘비는 그 자리를 **통째로** 가린다. 그런 묘비를 모든 탭이
   * 공유하는 localStorage 에 적으면, 다른 탭이 지금 쓰고 있는 멀쩡한 session draft 까지
   * 싸잡아 가려 **살아 있는 작업을 잃는다.**
   *
   * 그래서 통째로 가리는 session 묘비는 sessionStorage 밖으로 나가지 않는다. 대가는 있다 —
   * session 접근이 막힌 채 지우면 표시가 이번 로드에만 살아, 접근이 회복된 뒤 리로드하면
   * 지운 draft 가 복원 후보로 다시 뜬다. 둘은 동시에 만족할 수 없다(탭을 가려내려면 탭 스코프
   * 저장이 필요한데, 바로 그게 막힌 상황을 다루는 코드다). **되살아난 배너는 성가심이고, 남의
   * 탭 draft 를 가리는 것은 유실이다** — 유실을 피하는 쪽을 택한다.
   */
  it("지문을 못 뜬 session 표시는 다른 탭의 draft 를 가리지 않는다", () => {
    // 탭 A: sessionStorage 를 아예 못 만지는 채로 지운다.
    const restore = breakAccess("sessionStorage");
    try {
      clearRaw(KEY);
    } finally {
      restore();
    }

    // 탭 B: 자기 sessionStorage 에 지금 쓰고 있는 편집이 있다.
    __resetMemoryDrafts();
    window.sessionStorage.setItem(KEY, "탭 B 의 편집");

    expect(readRaw(KEY)).toBe("탭 B 의 편집");
  });

  /**
   * 묘비가 "이 **자리**를 건너뛰라"고만 말하면 그 자리의 **미래 값까지 영영** 가린다.
   * 탭 A 가 남긴 표시는 탭 A 의 sessionStorage 에 있어 탭 B 가 지울 수 없으므로, 탭 B 가
   * 공유 계층에 새로 쓴 멀쩡한 값이 탭 A 에서 영원히 안 읽힌다 — 묘비는 자리가 아니라
   * **자기가 죽이는 값**을 가리켜야 한다.
   */
  it("한 탭이 남긴 표시가 다른 탭이 새로 쓴 값까지 가리지 않는다", () => {
    expect(writeRaw(KEY, "탭 A 가 본 옛 편집")).toBe("local");

    // 탭 A: local 을 못 지운 채 session 으로 내려간다 — 표시는 A 의 sessionStorage 에 남는다.
    breakWrites(window.localStorage);
    breakRemovals(window.localStorage);
    expect(writeRaw(KEY, "탭 A 의 편집")).toBe("session");

    // 탭 B 가 회복해 공유 계층에 새 값을 쓴다. B 는 A 의 sessionStorage 를 지울 수 없다.
    healWrites(window.localStorage);
    healRemovals(window.localStorage);
    window.localStorage.setItem(KEY, "탭 B 의 새 편집");

    simulateReload();

    expect(readRaw(KEY)).toBe("탭 B 의 새 편집");
  });

  it("리로드 뒤 위 계층이 살아나 새로 쓰면 다시 그 값을 읽는다", () => {
    expect(writeRaw(KEY, "옛 편집")).toBe("local");
    breakWrites(window.localStorage);
    breakRemovals(window.localStorage);
    expect(writeRaw(KEY, "새 편집")).toBe("session");
    simulateReload();

    // 사용자가 공간을 비웠다 — 이제 위 계층에 다시 쓸 수 있다.
    healWrites(window.localStorage);
    expect(writeRaw(KEY, "복구 후 편집")).toBe("local");

    // 표시가 남아 위 계층을 영영 건너뛰면, 방금 쓴 값을 도로 못 읽는다.
    expect(readRaw(KEY)).toBe("복구 후 편집");
  });

  /**
   * 묘비는 두 스토리지에 **동시에** 남을 수 있다 — 지우기가 막힌 자리에 옛 묘비가 남은 채
   * 새 묘비가 다른 자리에 적히면 그렇다. 그때 먼저 찾은 하나만 보고 판정하면, 옛 묘비와
   * 지문이 안 맞는다는 이유로 **이미 지운 draft 를 되살려** 돌려준다.
   */
  it("다른 스토리지에 남은 옛 표시 때문에 지운 draft 가 되살아나지 않는다", () => {
    // local 에 옛 편집을 쓰고, 지우기가 막힌 채 지운다 → 본문도 옛 묘비도 local 에 남는다.
    writeRaw(KEY, "옛 편집");
    breakRemovals(window.localStorage);
    clearRaw(KEY);

    // 새 탭/새로고침: 모듈 상태는 죽고 local 만 살아남는다.
    __resetMemoryDrafts();

    // 새 편집을 덮어쓴다 — 지우기가 막혀 있어 옛 묘비는 local 에 그대로 남는다.
    writeRaw(KEY, "새 편집");

    // 이번엔 묘비를 local 에 못 적는다 → 새 묘비는 session 으로 간다.
    breakWritesFor(window.localStorage, (k) => k.startsWith("arc:draft-stale:"));
    clearRaw(KEY);

    // 새로고침 — local 에는 옛 묘비, session 에는 새 편집을 가리키는 묘비가 공존한다.
    __resetMemoryDrafts();

    expect(readRaw(KEY)).toBeNull();
  });


  /**
   * 묘비를 **못 남긴** 계층이 안전한 집이 아니듯, 묘비를 **못 거둔** 계층도 안전한 집이 아니다.
   * 새로 쓴 값을 가리는 묘비가 남아 있으면 이번 로드에서만 보이고(`freshEntries`) 새로고침에
   * 사라진다 — 그런데 "local 에 담았다"고 답하면 경고조차 안 나간다. 그 자리는 건너뛴다.
   */
  it("묘비를 못 거둔 계층도 안전한 집이 아니다 — 한 계층 내려가 사실대로 경고한다", () => {
    // local 접근이 막힌 채 쓴다 → session 에 담기고, 지문 못 뜬 local 묘비가 session 에 남는다.
    const restore = breakAccess("localStorage");
    try {
      expect(writeRaw(KEY, "옛 편집")).toBe("session");
    } finally {
      restore();
    }

    // local 접근이 돌아왔다. 그런데 session 지우기가 막혀 그 묘비를 거둘 수 없다.
    breakRemovals(window.sessionStorage);
    expect(writeRaw(KEY, "새 편집")).toBe("session");

    simulateReload();

    expect(readRaw(KEY)).toBe("새 편집");
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


  /**
   * session 값은 **탭마다 따로**다. 그 묘비를 모든 탭이 공유하는 localStorage 에 적으면, 한 탭의
   * 지우기가 다른 탭의 멀쩡한 session draft 까지 읽기에서 건너뛰게 만든다 — 남의 편집을 지운다.
   *
   * 다른 탭은 "sessionStorage 와 모듈 상태가 그 탭만의 것"이라는 점으로 흉내 낸다.
   */
  it("한 탭의 지우기가 다른 탭의 session draft 를 가리지 않는다", () => {
    // 탭 A: 지우려는데 이 탭의 session 삭제가 막혔다.
    window.sessionStorage.setItem(KEY, "탭 A 의 편집");
    breakRemovals(window.sessionStorage);
    clearRaw(KEY);

    // 탭 B 로 옮겨 간다 — sessionStorage 도 모듈 상태도 이 탭만의 것이다.
    healRemovals(window.sessionStorage);
    window.sessionStorage.clear();
    __resetMemoryDrafts();
    window.sessionStorage.setItem(KEY, "탭 B 의 새 편집");

    expect(readRaw(KEY)).toBe("탭 B 의 새 편집");
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

describe("메모리 계층 — 방문만으로 편집을 잃지 않는다", () => {
  /** 두 웹 스토리지를 모두 막아 메모리 계층으로 떨어뜨린다. */
  function forceMemoryTier() {
    breakWrites(window.localStorage);
    breakWrites(window.sessionStorage);
  }

  function releaseStorages() {
    healWrites(window.localStorage);
    healWrites(window.sessionStorage);
  }

  /**
   * 예전에는 문서 **개수**(3)로 끊어서, 같은 세션에서 네 번째 문서를 여는 것만으로 첫
   * 문서의 편집이 조용히 사라졌다. 이 계층은 편집을 안 잃으려고 있는 것인데 *방문만으로*
   * 잃는 셈이었고, `memory` 경고는 "새로고침하면 사라진다"고만 말해 예상할 수도 없었다.
   */
  it("문서를 여러 개 거쳐도 앞 문서의 편집이 남아 있다", () => {
    forceMemoryTier();

    const keys = Array.from({ length: 8 }, (_, i) => `doc:${i}`);
    keys.forEach((k) => writeRaw(k, `본문 ${k}`));
    releaseStorages();

    keys.forEach((k) => {
      expect(readRaw(k)).toBe(`본문 ${k}`);
    });
  });

  // 둘은 들어가고 셋은 못 들어가는 크기. 실패 출력이 본문으로 뒤덮이지 않도록 값 자체를
  // 비교하지 않고 "남았는가"만 본다.
  const BIG = "가".repeat(Math.floor(MEMORY_DRAFT_BUDGET_CHARS * 0.4));

  it("총량을 넘기면 가장 오래 손대지 않은 것부터 버린다", () => {
    forceMemoryTier();

    writeRaw("doc:0", BIG);
    writeRaw("doc:1", BIG);
    writeRaw("doc:2", BIG);
    releaseStorages();

    expect(readRaw("doc:0")).toBeNull();
    expect(readRaw("doc:2")).not.toBeNull();
  });

  it("다시 손댄 문서는 뒤로 밀려 먼저 버려지지 않는다", () => {
    forceMemoryTier();

    writeRaw("doc:0", BIG);
    writeRaw("doc:1", BIG);
    // doc:0 을 다시 고친다 — 이제 가장 오래 손대지 않은 것은 doc:1 이다.
    writeRaw("doc:0", BIG);
    writeRaw("doc:2", BIG);
    releaseStorages();

    expect(readRaw("doc:0")).not.toBeNull();
    expect(readRaw("doc:1")).toBeNull();
  });

  /**
   * 상한을 넘겼다고 방금 쓴 것까지 버리면 `"memory"` 를 돌려주고도 정작 안 들고 있는 셈이
   * 되어, 그 반환값으로 띄우는 경고("새로고침하면 사라집니다")가 거짓이 된다.
   */
  it("혼자 상한을 넘기는 문서라도 방금 쓴 것은 들고 있는다", () => {
    forceMemoryTier();

    const huge = "가".repeat(MEMORY_DRAFT_BUDGET_CHARS + 10);
    expect(writeRaw("doc:huge", huge)).toBe("memory");
    releaseStorages();

    expect(readRaw("doc:huge")?.length).toBe(huge.length);
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
