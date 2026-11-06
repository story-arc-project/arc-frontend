import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import ExperienceCard from "./ExperienceCard"
import ExperienceDetailV2 from "./ExperienceDetailV2"
import { ResumeExperiencePicker } from "../export/ResumeExperiencePicker"
import { careerExperience } from "./__fixtures__/archive.fixtures"

afterEach(cleanup)

describe("shared compact dates in archive and resume picker", () => {
  it.each([
    ["2026-03-14T20:00:00Z", "2026.03.15"],
    ["2026-03-14", "2026.03.14"],
    ["2026-02-30", "2026-02-30"],
    ["garbage", "garbage"],
    ["", "—"],
  ])("renders %s consistently", (updatedAt, expected) => {
    const experience = { ...careerExperience, updatedAt }
    render(<>
      <ExperienceCard experience={experience} selected={false} onClick={vi.fn()} onEdit={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} />
      <ExperienceDetailV2 experience={experience} onEdit={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()} />
      <ResumeExperiencePicker experiences={[experience]} excludedIds={new Set()} onToggle={vi.fn()} onSelectAll={vi.fn()} onClearAll={vi.fn()} />
    </>)
    expect(screen.getAllByText(expected, { exact: true })).toHaveLength(2)
    expect(screen.getByText(`마지막 수정: ${expected}`)).toBeInTheDocument()
  })
})
