"use client";

import { TextareaHTMLAttributes, forwardRef, useImperativeHandle } from "react";

import { syncTextareaHeight, useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";

import { RequiredDot } from "./required-dot";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** 힌트(가이드라인) 위치. "top"이면 라벨과 입력칸 사이에 렌더한다. 기본 "bottom". */
  hintPosition?: "top" | "bottom";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, hintPosition = "bottom", className = "", id, onChange, value, required, ...props }, ref) => {
    // 높이 동기화는 공용 훅에 맡긴다 — 테두리 보정·리플로우·웹폰트 교체까지 한곳에서(FRT-327).
    // 비제어(`defaultValue`)로 쓰면 `value` 가 늘 undefined 라 마운트 한 번만 재고, 이후 타이핑은
    // 아래 `onChange` 가 직접 다시 잰다.
    const isControlled = value !== undefined;
    const innerRef = useAutoResizeTextarea(isControlled ? String(value) : "");
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const hintId = textareaId ? `${textareaId}-hint` : undefined;
    const errorId = textareaId ? `${textareaId}-error` : undefined;
    const describedBy = error ? errorId : hint ? hintId : undefined;
    const hintNode = hint ? (
      <p id={hintId} className="text-caption">{hint}</p>
    ) : null;

    // 훅이 돌려준 ref 를 그대로 요소에 물리고, 바깥에서 준 ref 에는 같은 요소를 노출한다.
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, [innerRef]);

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
          ref={innerRef}
          id={textareaId}
          value={value}
          rows={3}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(e) => {
            if (!isControlled) syncTextareaHeight(e.currentTarget);
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
