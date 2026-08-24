import { ButtonHTMLAttributes } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/**
 * 다시 눌러 해제되는 토글 칩. `selected` 는 배경색·굵기만이 아니라 `aria-pressed` 로도
 * 노출한다 — 안 그러면 스크린리더에는 라벨만 읽혀 무엇을 골랐는지 알 수 없다(FRT-312).
 * 호출부가 `aria-pressed` 를 직접 넘기면 그 값이 우선한다(`...props` 가 뒤에 온다).
 */
export function Chip({
  selected = false,
  className = "",
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[
        "inline-flex items-center px-3 py-1 rounded-full text-label transition-all",
        selected
          ? "bg-brand text-white border border-brand font-semibold"
          : "text-text-secondary border border-border hover:border-brand hover:text-brand hover:bg-surface-brand",
        props.disabled
          ? "opacity-50 cursor-not-allowed hover:border-border hover:text-text-secondary hover:bg-transparent"
          : "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
