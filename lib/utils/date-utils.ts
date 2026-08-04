// FRT-128: 값이 없거나 파싱 불가일 때 화면에 "Invalid Date"·"NaN일 전" 이 새지 않게 한다.
// 폴백 관례는 lib/admin/format.ts 의 formatAdminDate 와 맞춘다 — 값 없음은 "—", 파싱 불가는 원문.
//
// ⚠️ 시그니처가 `string | null | undefined` 인 이유: 호출부 타입은 전부 non-optional `string` 이지만,
// lib/api/*.ts 의 `asString(value, fallback = "")` 이 서버 응답의 unknown 필드를 **빈 문자열로 폴백**해
// 그 값을 `createdAt: string` 에 담는다. 타입은 string 인데 런타임 값이 "" 인 지점이 실재한다.
// null 은 특히 위험하다 — new Date(null) 은 Invalid Date 가 아니라 epoch(1970-01-01)라서,
// 가드가 없으면 에러가 아니라 "19875일 전" 같은 **그럴듯하지만 틀린 값**이 조용히 렌더된다.

/** 값 없음을 나타내는 표기. 리포 전반(admin·TableBlock 등)이 쓰는 em-dash 를 따른다. */
const EMPTY = "—";

type MaybeIso = string | null | undefined;

/**
 * Format ISO date string to Korean locale short date.
 * e.g. "2024. 3. 15." · 값 없음 → "—" · 파싱 불가 → 원문 그대로
 */
export function formatDate(iso: MaybeIso): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format ISO date string to Korean locale long date with time.
 * e.g. "2024년 3월 15일 오후 2:30" · 값 없음 → "—" · 파싱 불가 → 원문 그대로
 */
export function formatDateTime(iso: MaybeIso): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format ISO date string to relative time in Korean.
 * e.g. "3분 전", "2시간 전", "5일 전" · 값 없음/파싱 불가 → "—"
 *
 * formatDate 와 달리 파싱 불가도 "—" 로 떨어뜨린다. 상대시각 자리에 원문("garbage")을
 * 그대로 두면 문장이 성립하지 않는다.
 */
export function formatRelativeTime(iso: MaybeIso): string {
  if (!iso) return EMPTY;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return EMPTY;
  const diff = Date.now() - time;
  if (diff < 0) return "방금 전";
  const mins = Math.floor(diff / 60000);
  if (mins === 0) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}
