/**
 * Format ISO date string to Korean locale short date.
 * e.g. "2024. 3. 15."
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format ISO date string to Korean locale long date with time.
 * e.g. "2024년 3월 15일 오후 2:30"
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format ISO date string to relative time in Korean.
 * e.g. "3분 전", "2시간 전", "5일 전"
 */
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "방금 전";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}
