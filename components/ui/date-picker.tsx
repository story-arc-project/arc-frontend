import { InputHTMLAttributes, forwardRef } from "react";

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  hint?: string;
  error?: string;
  /** 'date' renders YYYY-MM-DD picker, 'month' renders YYYY-MM picker */
  mode?: "date" | "month";
  /** Additional classes for the outer wrapper div */
  wrapperClassName?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, hint, error, mode = "date", wrapperClassName = "", className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const hintId = inputId ? `${inputId}-hint` : undefined;
    const errorId = inputId ? `${inputId}-error` : undefined;
    const describedBy = error ? errorId : hint ? hintId : undefined;

    return (
      <div className={`flex flex-col gap-1.5 min-w-0 ${wrapperClassName}`.trim()}>
        {label && (
          <label htmlFor={inputId} className="text-label text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={mode === "month" ? "month" : "date"}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          placeholder={mode === "month" ? "YYYY-MM" : "YYYY-MM-DD"}
          pattern={mode === "month" ? "\\d{4}-\\d{2}" : "\\d{4}-\\d{2}-\\d{2}"}
          className={[
            "h-12 px-4 rounded-md border bg-surface min-width-0 box-border",
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
        ) : hint ? (
          <p id={hintId} className="text-caption">{hint}</p>
        ) : null}
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
