import type { Activity } from "@/types/resume";
import { compactStrings } from "@/lib/export/resume-format";
import { visibleExperiences } from "@/lib/export/resume-visibility";

/** 활동의 날짜·진행 여부만으로는 그릴 내용이 생기지 않는다(FRT-203). */
export function visibleUsableActivities(items: Activity[] | null | undefined): Activity[] {
  return visibleExperiences(items).filter((item) =>
    item && (
      [item.활동명, item.기관, item.역할].some((value) => typeof value === "string" && value.trim().length > 0)
      || compactStrings(item.활동내용).length > 0
      || compactStrings(item.성과).length > 0
    ),
  );
}
