"use client";

import { type ComponentPropsWithoutRef, forwardRef } from "react";

import { Input } from "./input";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "type" | "rightAddon"> & {
  visible: boolean;
  onToggleVisibility: () => void;
};

/** Visibility stays with the form so moving between steps preserves its state. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ visible, onToggleVisibility, className = "", ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type={visible ? "text" : "password"}
      className={["pr-14", className].filter(Boolean).join(" ")}
      rightAddon={
        <button
          type="button"
          onClick={onToggleVisibility}
          className="text-caption text-text-tertiary
                     hover:text-text-secondary transition-colors cursor-pointer select-none"
        >
          {visible ? "숨기기" : "보기"}
        </button>
      }
    />
  )
);

PasswordInput.displayName = "PasswordInput";
