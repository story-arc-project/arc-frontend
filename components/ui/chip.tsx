import { ButtonHTMLAttributes } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({
  selected = false,
  className = "",
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
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
