import { HTMLAttributes } from "react";

type BadgeVariant = "default" | "brand" | "success" | "warning" | "error" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-tertiary text-text-secondary",
  brand:   "bg-surface-brand text-brand-dark",
  success: "bg-surface-success text-success",
  warning: "bg-surface-warning text-warning",
  error:   "bg-surface-error text-error",
  outline: "bg-transparent border border-border text-text-secondary",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        // FRT-338: globals.css 밖의 값이라 스케일 상향 때 함께 올린다 — 캡션(13px)과 같은 눈금.
        "text-[13px] font-medium leading-none",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
