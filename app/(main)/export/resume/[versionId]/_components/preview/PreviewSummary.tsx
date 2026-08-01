"use client";

import type { ResumeSectionLabels } from "@/lib/export/resume-labels";
import { PreviewSection } from "./PreviewSection";

interface Props {
  labels: ResumeSectionLabels;
  data: string | null;
}

export function PreviewSummary({ data, labels }: Props) {
  if (!data || !data.trim()) return null;

  return (
    <PreviewSection title={labels.summary}>
      <p className="whitespace-pre-wrap text-body-sm text-text-primary leading-relaxed">
        {data}
      </p>
    </PreviewSection>
  );
}
