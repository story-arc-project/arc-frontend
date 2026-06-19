"use client"

import type { RefObject } from "react"
import { Button } from "@/components/ui/button"
import type { SectionCategory } from "@/types/archive"
import type { ExperienceFormV2Handle } from "@/components/features/archive/ExperienceFormV2"
import { useScrollspy } from "@/hooks/useScrollspy"

interface SectionNavProps {
  sections: { id: SectionCategory; label: string }[]
  formRef: RefObject<ExperienceFormV2Handle | null>
  saving?: boolean
}

export default function SectionNav({ sections, formRef, saving }: SectionNavProps) {
  const active = useScrollspy(sections.map(s => s.id))

  function scrollTo(id: SectionCategory) {
    const el = document.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="섹션 이동" className="flex flex-col gap-1">
        {sections.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(s.id)}
            aria-current={active === s.id ? "true" : undefined}
            className={`text-left text-body-sm rounded-md px-3 py-2 transition-colors ${
              active === s.id
                ? "bg-surface-brand text-brand-dark font-medium"
                : "text-text-secondary hover:bg-surface-secondary"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button
          variant="primary"
          size="sm"
          disabled={saving}
          onClick={() => formRef.current?.save("complete")}
          fullWidth
        >
          완료
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={() => formRef.current?.save("draft")}
          fullWidth
        >
          초안 저장
        </Button>
      </div>
    </div>
  )
}
