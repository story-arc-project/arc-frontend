"use client";

import { PreviewSection } from "./PreviewSection";

interface Props {
  title: string;
  data: string | null;
}

export function PreviewSummary({ data, title }: Props) {
  if (!data || !data.trim()) return null;

  return (
    <PreviewSection title={title}>
      <p className="whitespace-pre-wrap text-body-sm text-text-primary leading-relaxed">
        {data}
      </p>
    </PreviewSection>
  );
}
