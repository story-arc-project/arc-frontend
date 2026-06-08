import { InputHTMLAttributes } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  checked: boolean;
};

export function Checkbox({ checked, className = "", ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      className={[
        "h-5 w-5 shrink-0 rounded-md border-2 border-border",
        "accent-brand cursor-pointer transition-colors",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
