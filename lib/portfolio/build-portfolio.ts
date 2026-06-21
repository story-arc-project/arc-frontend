import type { Block, BlockValue, ExperienceTypeId } from "@/types/archive";
import type { Experience } from "@/types/experience";
import type { Portfolio, PortfolioPost, PortfolioProfile } from "@/types/portfolio";
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2";

interface ExperienceContentShape {
  title?: string;
  summary?: string;
  tags?: string[];
  coreBlocks?: Block[];
}

function readContent(exp: Experience): ExperienceContentShape {
  return (exp.content ?? {}) as ExperienceContentShape;
}

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
  const start = ym(value.start);
  const end = value.isCurrent ? "현재" : ym(value.end);
  if (!start && !end) return "";
  return `${start} – ${end}`;
}

export function experienceToPost(exp: Experience): PortfolioPost {
  const content = readContent(exp);
  const core = content.coreBlocks;
  const label = EXPERIENCE_TYPE_MAP[exp.type as ExperienceTypeId]?.label ?? "경험";
  return {
    id: exp.id,
    title: content.title ?? textOf(findBlock(core, "경험명")?.value),
    period: periodOf(findBlock(core, "기간")?.value),
    category: label,
    summary: content.summary ?? textOf(findBlock(core, "한 줄 요약")?.value),
    contribution: textOf(findBlock(core, "내 역할/기여도")?.value),
    achievement: textOf(findBlock(core, "핵심 성과")?.value),
    keywords: content.tags ?? [],
  };
}

export function buildPortfolio(
  id: string,
  experiences: Experience[],
  profile: PortfolioProfile,
): Portfolio {
  return { id, profile, posts: experiences.map(experienceToPost) };
}
