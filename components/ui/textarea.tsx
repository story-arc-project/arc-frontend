"use client";

import { TextareaHTMLAttributes, forwardRef, useCallback, useEffect, useRef } from "react";

import { RequiredDot } from "./required-dot";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** 힌트(가이드라인) 위치. "top"이면 라벨과 입력칸 사이에 렌더한다. 기본 "bottom". */
  hintPosition?: "top" | "bottom";
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, hintPosition = "bottom", className = "", id, onChange, value, required, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const hintId = textareaId ? `${textareaId}-hint` : undefined;
    const errorId = textareaId ? `${textareaId}-error` : undefined;
    const describedBy = error ? errorId : hint ? hintId : undefined;
    const hintNode = hint ? (
      <p id={hintId} className="text-caption">{hint}</p>
    ) : null;

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

    // Resize when controlled value changes externally
    useEffect(() => {
      if (innerRef.current) autoResize(innerRef.current);
    }, [value]);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-field-label text-text-primary">
            {label}
            {required && <RequiredDot />}
          </label>
        )}
        {hintPosition === "top" && hintNode}
        <textarea
          ref={setRef}
          id={textareaId}
          value={value}
          rows={3}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => {
            autoResize(e.currentTarget);
            onChange?.(e);
          }}
          className={[
            "w-full rounded-md border bg-surface px-4 py-3",
            "text-body text-text-primary placeholder:text-text-tertiary leading-[1.6]",
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
          <p id={errorId} className="text-body-sm text-error">{error}</p>
        ) : hintPosition !== "top" ? (
          hintNode
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
