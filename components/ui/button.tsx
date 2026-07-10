import { ButtonHTMLAttributes, forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /**
   * 렌더 요소를 자식 엘리먼트로 위임한다(Radix Slot). `<Button asChild><Link/></Button>`
   * 처럼 쓰면 버튼 스타일이 자식(`<a>`)에 병합돼 단일 상호작용 요소로 렌더된다.
   */
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-text-on-brand hover:bg-brand-dark active:bg-brand-dark disabled:bg-gray-100 disabled:text-text-disabled",
  secondary:
    "bg-surface-tertiary text-text-primary hover:bg-gray-100 active:bg-gray-200 disabled:text-text-disabled",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-tertiary active:bg-gray-100 disabled:text-text-disabled",
  destructive:
    "bg-error text-white hover:opacity-90 active:opacity-80 disabled:opacity-40",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[13px] font-medium rounded-sm",
  md: "h-11 px-5 text-[15px] font-semibold rounded-md",
  lg: "h-14 px-6 text-[17px] font-semibold rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      asChild = false,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        // anchor 등 비-button 요소에는 type="button"을 강제 주입하지 않는다.
        type={asChild ? props.type : props.type ?? "button"}
        className={[
          "inline-flex items-center justify-center gap-2",
          "transition-colors duration-150 cursor-pointer",
          "disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? "w-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";
