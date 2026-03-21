import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-label text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            "h-12 w-full rounded-md border bg-surface px-4",
            "text-[15px] text-text-primary placeholder:text-text-tertiary",
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
          <p className="text-[13px] text-error">{error}</p>
        ) : hint ? (
          <p className="text-caption">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
