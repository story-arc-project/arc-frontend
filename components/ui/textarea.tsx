"use client";

import { TextareaHTMLAttributes, forwardRef, useCallback, useEffect, useRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className = "", id, onChange, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    // Sync forwarded ref + inner ref
    const setRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        (innerRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      },
      [ref]
    );

    // Resize on mount (handles defaultValue)
    useEffect(() => {
      if (innerRef.current) autoResize(innerRef.current);
    }, []);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-label text-text-primary">
            {label}
          </label>
        )}
        <textarea
          ref={setRef}
          id={textareaId}
          rows={1}
          onChange={(e) => {
            autoResize(e.currentTarget);
            onChange?.(e);
          }}
          className={[
            "w-full rounded-md border bg-surface px-4 py-3",
            "text-[15px] text-text-primary placeholder:text-text-tertiary leading-[1.6]",
            "outline-none transition-colors duration-150 resize-none overflow-hidden",
            "min-h-[48px]",
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

Textarea.displayName = "Textarea";
