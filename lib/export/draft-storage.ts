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
 * 메모리 계층이 들고 있을 문서 수. 편집은 한 번에 한 문서라 몇 개면 충분하고, 상한이 없으면
 * 실패가 잦은 환경에서 본문이 계속 쌓인다.
 */
export const MEMORY_DRAFT_LIMIT = 3;

/** 삽입 순서를 유지하는 Map 이라 가장 오래된 항목이 곧 첫 키다(FIFO). */
const memoryDrafts = new Map<string, string>();

/**
 * 비우는 데 **실패한** 계층(`"<tier>:<key>"`).
 *
 * 아래 계층으로 내려갈 때 위 계층의 옛 값을 지우는데, 그 삭제 자체가 막힐 수 있다(쓰기 계열
 * 전체를 차단하는 환경). 그대로 두면 위에 낡은 값이 남고 읽기는 위부터 보므로, 방금 아래에
 * 쓴 새 편집 대신 **옛 편집이 복원된다** — 이 파일이 막으려는 바로 그 실패다. 지우지 못했으면
 * 없는 셈 치고 건너뛴다.
 */
const staleEntries = new Set<string>();

function stampOf(tier: WebStorageTier, key: string): string {
  return `${tier}:${key}`;
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
      staleEntries.delete(stampOf(tier, key));
    } catch {
      // 지우지 못했다 — 낡은 값이 남았으므로 읽기에서 건너뛰게 표시하고 정리를 계속한다.
      staleEntries.add(stampOf(tier, key));
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
      // 방금 쓴 값이 최신이다 — 이 계층에 붙어 있던 "낡음" 표시를 거둔다.
      staleEntries.delete(stampOf(tier, key));
      evictOtherTiers(key, tier);
      return tier;
    } catch {
      // 용량 초과·프라이빗 모드 — 다음 계층으로 내려간다.
    }
  }

  memoryDrafts.set(key, value);
  // 갱신은 자리를 새로 차지하지 않는다(Map 은 기존 키의 순서를 유지한다). 그래서 같은 문서를
  // 계속 고쳐도 다른 문서를 밀어내지 않는다.
  if (memoryDrafts.size > MEMORY_DRAFT_LIMIT) {
    const oldest = memoryDrafts.keys().next().value;
    if (oldest !== undefined) memoryDrafts.delete(oldest);
  }
  evictOtherTiers(key, "memory");
  return "memory";
}

/** 위 계층부터 찾는다 — 한 계층 규칙 덕분에 첫 발견이 곧 최신이다. */
export function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;

  for (const tier of WEB_STORAGE_TIERS) {
    // 비우지 못해 낡은 값이 남은 계층이다 — 읽으면 아래에 있는 새 편집을 덮는다.
    if (staleEntries.has(stampOf(tier, key))) continue;
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
      staleEntries.delete(stampOf(tier, key));
    } catch {
      // 지우지 못했으면 낡은 값이 남는다 — 없는 셈 쳐야 "지웠다"가 지켜진다.
      staleEntries.add(stampOf(tier, key));
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
}
