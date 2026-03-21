import { HTMLAttributes } from "react";

type BadgeVariant = "default" | "brand" | "success" | "warning" | "error" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-tertiary text-text-secondary",
  brand:   "bg-surface-brand text-brand-dark",
  success: "bg-[#e8faf3] text-success",
  warning: "bg-[#fff8e6] text-warning",
  error:   "bg-[#fef0f1] text-error",
  outline: "bg-transparent border border-border text-text-secondary",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        "text-[12px] font-medium leading-none",
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
