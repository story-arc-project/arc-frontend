"use client";

import { EditorTextarea } from "./shared";

interface Props {
  value: string | null;
  onChange: (next: string | null) => void;
}

export function SummaryEditor({ value, onChange }: Props) {
  return (
    <EditorTextarea
      value={value ?? ""}
      placeholder="간단한 자기소개를 적어주세요."
      onChange={(e) => onChange(e.target.value || null)}
      rows={5}
    />
  );
}
