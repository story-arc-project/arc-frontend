import type { Block, BlockValue, ExperienceTypeId } from "@/types/archive";
import type { Experience } from "@/types/experience";
import type { Portfolio, PortfolioPost, PortfolioProfile } from "@/types/portfolio";
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2";
import { toExperienceV2 } from "@/lib/utils/experience-mapper";

function findBlock(blocks: Block[] | undefined, label: string): Block | undefined {
  return (blocks ?? []).find((b) => b.label === label);
}

function textOf(value: BlockValue | undefined): string {
  if (value && (value.type === "text" || value.type === "textarea")) {
    return value.text ?? "";
  }
  return "";
}

function ym(date: string | undefined): string {
  return date ? date.slice(0, 7).replace("-", ".") : "";
}

function periodOf(value: BlockValue | undefined): string {
  if (!value || value.type !== "period") return "";
  // 아카이브 읽기전용 뷰(formatPeriodString)와 동일하게: 시작일이 없으면 빈 값,
  // 종료(또는 진행 중)가 있을 때만 범위로, 단일 날짜는 매달린 구분자 없이 시작일만 표기.
  const start = ym(value.start);
  if (!start) return "";
  const end = value.isCurrent ? "현재" : ym(value.end);
  return end ? `${start} – ${end}` : start;
}

export function experienceToPost(exp: Experience): PortfolioPost {
  const ev2 = toExperienceV2(exp);
  const core = ev2.coreBlocks;
  const label = EXPERIENCE_TYPE_MAP[exp.type as ExperienceTypeId]?.label ?? "경험";
  return {
    id: exp.id,
    title: ev2.title || textOf(findBlock(core, "경험명")?.value),
    period: periodOf(findBlock(core, "기간")?.value),
    category: label,
    summary: ev2.summary || textOf(findBlock(core, "한 줄 요약")?.value),
    contribution: textOf(findBlock(core, "내 역할/기여도")?.value),
    achievement: textOf(findBlock(core, "핵심 성과")?.value),
    keywords: ev2.tags,
  };
}

export function buildPortfolio(
  id: string,
  experiences: Experience[],
  profile: PortfolioProfile,
): Portfolio {
  return { id, profile, posts: experiences.map(experienceToPost) };
}
