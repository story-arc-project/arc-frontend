import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

import { RequiredDot } from "./required-dot";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** 힌트(가이드라인) 위치. "top"이면 라벨과 입력칸 사이에 렌더한다. 기본 "bottom". */
  hintPosition?: "top" | "bottom";
  /** 입력칸 오른쪽 안쪽에 겹쳐 놓을 요소(비밀번호 보기 토글 등).
   *  라벨·힌트·에러 유무와 무관하게 입력칸 자신을 기준으로 세로 중앙에 정렬된다.
   *  겹치는 만큼 값이 가려지지 않도록 호출부에서 className 으로 오른쪽 여백을 준다. */
  rightAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, hintPosition = "bottom", rightAddon, className = "", id, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const hintId = inputId ? `${inputId}-hint` : undefined;
    const errorId = inputId ? `${inputId}-error` : undefined;
    const describedBy = error ? errorId : hint ? hintId : undefined;
    const hintNode = hint ? (
      <p id={hintId} className="text-caption">{hint}</p>
    ) : null;

    const inputNode = (
      <input
        ref={ref}
        id={inputId}
        required={required}
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
    );

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-field-label text-text-primary">
            {label}
            {required && <RequiredDot />}
          </label>
        )}
        {hintPosition === "top" && hintNode}
        {rightAddon ? (
          // 래퍼가 flex 흐름에서 input 의 자리를 그대로 차지하므로 간격·에러 문구 위치는 변하지 않는다.
          <div className="relative">
            {inputNode}
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center">
              {rightAddon}
            </div>
          </div>
        ) : (
          inputNode
        )}
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
