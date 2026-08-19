/**
 * 임시 저장의 **보관 계층**만 담당한다(문자열 in/out — 무엇을 저장하는지는 모른다).
 *
 * 서버 저장(PATCH)이 아직 없어(BAC-62 미착수) 자소서·레쥬메 편집은 로컬 임시 저장이 유일한
 * 보관처다. 그런데 `localStorage.setItem` 은 용량 초과·프라이빗 모드에서 던진다 — 그 순간
 * 편집을 담아 둘 곳이 사라지고, 사용자는 아무 신호 없이 쓴 글을 잃는다(FRT-261).
 *
 * 그래서 한 계층이 막히면 아래로 내려간다. 아래로 갈수록 오래 못 버틴다:
 *
 *   local   — 브라우저를 닫아도 남는다(정상 경로)
 *   session — 탭이 살아 있는 동안. 새로고침은 견딘다
 *   memory  — 이 페이지 로드 동안만. 새로고침이면 사라진다
 *
 * 호출부는 반환된 `DraftTier` 로 **사용자에게 무엇을 경고할지**를 정한다. 계층이 내려갔다는
 * 사실 자체가 사용자가 알아야 할 정보다 — 조용히 성공한 척하면 안 된다.
 */

export type DraftTier = "local" | "session" | "memory";

/**
 * 메모리 계층이 들고 있을 **총량**(문자 수 기준).
 *
 * 처음에는 문서 **개수**로 끊었는데, 그러면 "문서를 하나 더 열었다"는 이유만으로 앞 문서의
 * 편집이 조용히 사라진다 — 편집을 안 잃으려고 만든 계층에서 *방문만으로* 잃는 셈이고,
 * `memory` 경고는 "새로고침하면 사라진다"고만 말하므로 사용자는 그 유실을 예상할 수도 없다.
 * 걱정했던 것은 개수가 아니라 메모리가 끝없이 부는 것이므로 크기로 끊는다. 자소서 본문
 * 수천 자 기준으로 수십 개가 들어가는 여유라, 한 세션의 정상적인 문서 순회로는 닿지 않는다.
 */
export const MEMORY_DRAFT_BUDGET_CHARS = 2_000_000;

/**
 * 삽입 순서를 유지하는 Map. 쓸 때마다 끝으로 옮기므로 첫 키가 곧 **가장 오래 손대지 않은**
 * 문서다 — 총량을 넘겼을 때 지금 고치는 중인 문서가 먼저 버려지면 안 된다.
 */
const memoryDrafts = new Map<string, string>();

function memoryDraftChars(): number {
  let total = 0;
  for (const [k, v] of memoryDrafts) total += k.length + v.length;
  return total;
}

/**
 * 비우는 데 **실패한** 계층(`"<tier>:<key>"`).
 *
 * 아래 계층으로 내려갈 때 위 계층의 옛 값을 지우는데, 그 삭제 자체가 막힐 수 있다(쓰기 계열
 * 전체를 차단하는 환경). 그대로 두면 위에 낡은 값이 남고 읽기는 위부터 보므로, 방금 아래에
 * 쓴 새 편집 대신 **옛 편집이 복원된다** — 이 파일이 막으려는 바로 그 실패다. 지우지 못했으면
 * 없는 셈 치고 건너뛴다.
 */
const staleEntries = new Set<string>();

/**
 * 이번 로드에서 **직접 써서** 최신임을 아는 자리. `staleEntries` 와 아래의 묘비보다 우선한다.
 *
 * 묘비를 못 지우는 환경이 있는데, 그 자리에 방금 새 값을 썼다면 표시가 남았다는 이유로
 * 건너뛰어선 안 된다 — 건너뛰면 방금 저장한 편집을 도로 못 읽는다(구제하려다 잃는 쪽).
 */
const freshEntries = new Set<string>();

function stampOf(tier: WebStorageTier, key: string): string {
  return `${tier}:${key}`;
}

/**
 * 지우지 못한 계층을 가리키는 **묘비**. draft 를 받아 준 계층에 함께 적는다.
 *
 * 모듈 스코프 Set 은 새로고침에 죽는데 localStorage 의 옛 값은 살아남는다. 표시만 사라지면
 * 리로드 직후 읽기가 다시 위부터 보면서 옛 값을 집어, 막으려던 유실이 그대로 되돌아온다.
 * 그래서 표시도 draft 와 **같은 수명**을 갖게 한다.
 */
const STALE_MARKER_PREFIX = "arc:draft-stale:";

function markerKey(tier: WebStorageTier, key: string): string {
  return `${STALE_MARKER_PREFIX}${stampOf(tier, key)}`;
}

/** 웹 스토리지 계층은 둘뿐이라 "이 계층이 아닌 쪽"이 곧 묘비를 맡길 자리다. */
function otherWebTier(tier: WebStorageTier): WebStorageTier {
  return tier === "local" ? "session" : "local";
}

/** 지우지 못했다고 표시한다. `keep` 이 웹 스토리지면 거기에 묘비도 남긴다. */
function markStale(tier: WebStorageTier, key: string, keep: DraftTier): void {
  const stamp = stampOf(tier, key);
  staleEntries.add(stamp);
  freshEntries.delete(stamp);
  // 메모리 계층이면 적을 곳이 없다 — 그런데 그 경우 draft 자체도 새로고침을 못 넘기므로,
  // 리로드 뒤 남는 것은 위 계층의 옛 값뿐이다. 옛 값이라도 돌려주는 편이 낫다.
  if (keep === "memory") return;
  try {
    webStorage(keep)?.setItem(markerKey(tier, key), "1");
  } catch {
    // 묘비를 못 남겼다 — 이번 로드 동안만 유효하다. 그래도 지금 세션은 지켜진다.
  }
}

/** 표시를 거둔다 — 물리적으로 지웠거나 그 자리에 새 값을 덮어썼을 때. */
function unmarkStale(tier: WebStorageTier, key: string): void {
  staleEntries.delete(stampOf(tier, key));
  for (const host of WEB_STORAGE_TIERS) {
    try {
      webStorage(host)?.removeItem(markerKey(tier, key));
    } catch {
      // 묘비를 못 지웠다 — 그래서 `freshEntries` 가 따로 있다.
    }
  }
}

/** 이 계층의 값을 읽어도 되는가. 이번 로드에서 직접 쓴 자리는 무조건 최신이다. */
function isStale(tier: WebStorageTier, key: string): boolean {
  const stamp = stampOf(tier, key);
  if (freshEntries.has(stamp)) return false;
  if (staleEntries.has(stamp)) return true;
  for (const host of WEB_STORAGE_TIERS) {
    try {
      if (webStorage(host)?.getItem(markerKey(tier, key)) != null) return true;
    } catch {
      // 못 읽는 계층은 묘비도 없는 셈 친다.
    }
  }
  return false;
}

const WEB_STORAGE_TIERS = ["local", "session"] as const;
type WebStorageTier = (typeof WEB_STORAGE_TIERS)[number];

/**
 * 스토리지는 **접근하는 것만으로도** 던질 수 있다(정책으로 차단된 브라우저). 그래서 프로퍼티
 * 접근까지 try 안에 둔다.
 */
function webStorage(tier: WebStorageTier): Storage | null {
  try {
    return tier === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * draft 는 **언제나 한 계층에만 산다.**
 *
 * 읽기는 위 계층부터 보므로, 낡은 값이 위에 남아 있으면 아래에 방금 쓴 새 편집이 영영 안
 * 읽힌다 — 저장 실패를 구제하려다 저장 성공분을 잃는 정반대 결과가 된다. 쓰기가 성공한
 * 계층 말고는 전부 여기서 비운다.
 */
function evictOtherTiers(key: string, keep: DraftTier): void {
  for (const tier of WEB_STORAGE_TIERS) {
    if (tier === keep) continue;
    try {
      webStorage(tier)?.removeItem(key);
      unmarkStale(tier, key);
    } catch {
      // 지우지 못했다 — 낡은 값이 남았으므로 읽기에서 건너뛰게 표시하고 정리를 계속한다.
      markStale(tier, key, keep);
    }
  }
  if (keep !== "memory") memoryDrafts.delete(key);
}

/**
 * 저장 가능한 가장 위 계층에 쓰고, **어디에 썼는지**를 알린다.
 *
 * `null` 은 브라우저 밖(SSR)이라는 뜻이다. 서버에서는 메모리 계층도 쓰지 않는다 — 모듈
 * 스코프가 요청 사이에 공유돼 다른 사용자의 본문이 섞인다.
 */
export function writeRaw(key: string, value: string): DraftTier | null {
  if (typeof window === "undefined") return null;

  for (const tier of WEB_STORAGE_TIERS) {
    const storage = webStorage(tier);
    if (!storage) continue;
    try {
      storage.setItem(key, value);
      // 방금 쓴 값이 최신이다 — 이 계층에 붙어 있던 "낡음" 표시를 거둔다. 표시를 못 지우는
      // 환경도 있으므로, 직접 썼다는 사실을 따로 기억해 읽기에서 건너뛰지 않게 한다.
      freshEntries.add(stampOf(tier, key));
      unmarkStale(tier, key);
      evictOtherTiers(key, tier);
      return tier;
    } catch {
      // 용량 초과·프라이빗 모드 — 다음 계층으로 내려간다.
    }
  }

  // 다시 쓴 문서는 끝으로 보낸다 — 지금 손대고 있는 문서가 먼저 버려지면 안 된다.
  memoryDrafts.delete(key);
  memoryDrafts.set(key, value);
  // 방금 쓴 것 하나만 남을 때까지가 한계다. 그걸 버리면 `"memory"` 를 돌려주고도 정작
  // 안 들고 있는 셈이 되어, 호출부의 경고가 거짓이 된다.
  while (memoryDrafts.size > 1 && memoryDraftChars() > MEMORY_DRAFT_BUDGET_CHARS) {
    const oldest = memoryDrafts.keys().next().value;
    if (oldest === undefined) break;
    memoryDrafts.delete(oldest);
  }
  evictOtherTiers(key, "memory");
  return "memory";
}

/** 위 계층부터 찾는다 — 한 계층 규칙 덕분에 첫 발견이 곧 최신이다. */
export function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;

  for (const tier of WEB_STORAGE_TIERS) {
    // 비우지 못해 낡은 값이 남은 계층이다 — 읽으면 아래에 있는 새 편집을 덮는다.
    if (isStale(tier, key)) continue;
    try {
      const value = webStorage(tier)?.getItem(key);
      if (value !== null && value !== undefined) return value;
    } catch {
      // 읽기가 막힌 계층은 없는 것으로 보고 아래로 이어간다.
    }
  }

  return memoryDrafts.get(key) ?? null;
}

/**
 * 세 계층을 모두 지운다. 한 계층만 지우면 "지웠다"고 본 draft 가 아래 계층에서 되살아나
 * 다음 진입 때 복원 배너로 다시 뜬다.
 */
export function clearRaw(key: string): void {
  if (typeof window === "undefined") return;

  for (const tier of WEB_STORAGE_TIERS) {
    try {
      webStorage(tier)?.removeItem(key);
      unmarkStale(tier, key);
      freshEntries.delete(stampOf(tier, key));
    } catch {
      // 지우지 못했으면 낡은 값이 남는다 — 없는 셈 쳐야 "지웠다"가 지켜진다. 묘비는
      // 살아남는 계층에 적어야 새로고침 뒤에도 지운 draft 가 안 되살아난다.
      freshEntries.delete(stampOf(tier, key));
      markStale(tier, key, otherWebTier(tier));
    }
  }
  memoryDrafts.delete(key);
}

/**
 * 이 계층에 담겼다는 사실이 사용자에게 뜻하는 바. 경고할 것이 없으면 `null`.
 *
 * 계층마다 **잃는 조건**이 다르고, 그 조건이 곧 사용자가 지금 할 일을 가른다 — 탭을 닫지
 * 말라는 것과 새로고침하지 말라는 것은 다른 주문이다. 한 문장으로 뭉치면 둘 다 못 지킨다.
 */
export function draftTierWarning(tier: DraftTier | null): string | null {
  switch (tier) {
    case "local":
      return null;
    case "session":
      return "저장 공간이 부족해 이 탭에서만 임시 보관했어요. 탭을 닫으면 사라집니다.";
    case "memory":
      return "저장 공간이 부족해 임시로만 들고 있어요. 새로고침하면 사라집니다.";
    default:
      return "임시 저장에 실패했어요. 지금 내용을 복사해 두세요.";
  }
}

/** 테스트 전용 — 모듈 스코프 상태는 테스트 사이에 살아남는다. */
export function __resetMemoryDrafts(): void {
  memoryDrafts.clear();
  staleEntries.clear();
  freshEntries.clear();
}
