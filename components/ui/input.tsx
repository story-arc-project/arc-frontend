import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** 힌트(가이드라인) 위치. "top"이면 라벨과 입력칸 사이에 렌더한다. 기본 "bottom". */
  hintPosition?: "top" | "bottom";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, hintPosition = "bottom", className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const hintId = inputId ? `${inputId}-hint` : undefined;
    const errorId = inputId ? `${inputId}-error` : undefined;
    const describedBy = error ? errorId : hint ? hintId : undefined;
    const hintNode = hint ? (
      <p id={hintId} className="text-caption">{hint}</p>
    ) : null;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-field-label text-text-primary">
            {label}
          </label>
        )}
        {hintPosition === "top" && hintNode}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={[
            "h-12 w-full rounded-md border bg-surface px-4",
            "text-body text-text-primary placeholder:text-text-tertiary",
            "outline-none transition-colors duration-150",
            error
              ? "border-error focus:border-error focus:ring-2 focus:ring-error/20"
              : "border-border focus:border-brand focus:ring-2 focus:ring-brand/15",
            "disabled:bg-surface-tertiary disabled:text-text-disabled disabled:cursor-not-allowed",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error ? (
          <p id={errorId} className="text-body-sm text-error">{error}</p>
        ) : hintPosition !== "top" ? (
          hintNode
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
