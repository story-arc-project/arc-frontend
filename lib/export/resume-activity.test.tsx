import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PreviewActivity } from "@/app/(main)/export/resume/[versionId]/_components/preview/PreviewActivity";
import { buildResumeDocument } from "@/lib/export/resume-document";
import { resumeSectionLabels } from "@/lib/export/resume-labels";
import { visibleUsableActivities } from "@/lib/export/resume-activity";
import { seedResume } from "@/lib/demo/seed";
import type { Activity } from "@/types/resume";

const labels = resumeSectionLabels("ko");
function activity(overrides: Partial<Activity> = {}): Activity {
  return { id: 1, 활동명: null, 기관: null, 역할: null, 기간_시작: null, 기간_종료: null, 기간_원문: null, 진행중: false, 활동내용: [], 성과: [], ...overrides };
}
function documentActivities(items: Activity[]) {
  return buildResumeDocument({ ...seedResume, 대외활동: items }).sections.find(section => section.title === "대외활동");
}
afterEach(cleanup);
describe("FRT-203 activity content in preview and document", () => {
  it.each([
    { 진행중: true }, { 진행중: false },
    { 기간_시작: "2024-01", 기간_종료: "2025-01" },
    { 기간_원문: "2024년", 진행중: true },
    { 활동명: " \n", 기관: "\t", 역할: " ", 활동내용: [" ", "\n"], 성과: ["\t"], 진행중: true },
  ])("hides metadata-only and blank rows: %j", overrides => {
    const items = [activity(overrides)];
    const snapshot = structuredClone(items);
    const { container } = render(<PreviewActivity data={items} labels={labels} />);
    expect(container).toBeEmptyDOMElement();
    expect(documentActivities(items)).toBeUndefined();
    expect(items).toEqual(snapshot);
  });
  it("document also omits an ongoing-only activity", () => {
    expect(documentActivities([activity({ 진행중: true })])).toBeUndefined();
  });
  it.each([
    { 활동명: "일부 이름" }, { 기관: "일부 기관" }, { 역할: "팀장" },
    { 활동내용: ["", "운영 업무", " "] }, { 성과: [" ", "참가자 증가"] },
  ])("keeps partial meaningful content and ongoing label: %j", overrides => {
    const items = [activity({ ...overrides, 진행중: true })];
    const { container } = render(<PreviewActivity data={items} labels={labels} />);
    const content = Object.values(overrides).flat().find(value => typeof value === "string" && value.trim());
    expect(container).toHaveTextContent(content!);
    expect(JSON.stringify(documentActivities(items))).toContain(content!);
    expect(container).toHaveTextContent("현재");
    expect(documentActivities(items)?.entries).toHaveLength(1);
    expect(documentActivities(items)?.entries[0].meta).toBe("현재");
  });
  it("accepts missing arrays and keeps English ongoing labels", () => {
    expect(visibleUsableActivities(null)).toEqual([]);
    expect(visibleUsableActivities(undefined)).toEqual([]);
    const item = activity({ 활동명: "Volunteer", 진행중: true });
    const { container } = render(<PreviewActivity data={[item]} labels={resumeSectionLabels("en")} />);
    expect(container).toHaveTextContent("Present");
    expect(container).not.toHaveTextContent("현재");
    const section = buildResumeDocument({ ...seedResume, meta: { ...seedResume.meta, language: "en" }, 대외활동: [item] }).sections.find(section => section.title === "Activities");
    expect(section?.entries[0].meta).toBe("Present");
  });
  it("preserves visibility, rank, input order and false ongoing values", () => {
    const items = [activity({ id: 1, 활동명: "후순위", 표시: true, 표시순위: 2 }), activity({ id: 2, 활동명: "숨긴 활동", 표시: false, 표시순위: 0 }), activity({ id: 3, 활동명: "우선 활동", 표시: true, 표시순위: 1 }), activity({ id: 4, 진행중: true, 표시: true, 표시순위: 0 })];
    const snapshot = structuredClone(items);
    const { container } = render(<PreviewActivity data={items} labels={labels} />);
    expect(container).not.toHaveTextContent("숨긴 활동");
    expect(container).not.toHaveTextContent("현재");
    expect(container.textContent!.indexOf("우선 활동")).toBeLessThan(container.textContent!.indexOf("후순위"));
    expect(documentActivities(items)?.entries.map(entry => entry.title)).toEqual(["우선 활동", "후순위"]);
    expect(items).toEqual(snapshot);
  });
});
