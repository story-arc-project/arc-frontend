import type { Block, BlockValue, ExperienceTypeId } from "@/types/archive";
import type { Experience } from "@/types/experience";
import type { Portfolio, PortfolioPost, PortfolioProfile } from "@/types/portfolio";
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2";
import { toExperienceV2 } from "@/lib/utils/experience-mapper";
import { isBlockEmpty } from "@/lib/utils/block-utils";
import { equivalentLabels } from "@/lib/utils/form-cards";

function findBlock(blocks: Block[] | undefined, label: string): Block | undefined {
  return (blocks ?? []).find((b) => b.label === label);
}

/**
 * 코어 라벨의 값을 고른다. 폼 dedup 으로 빈 코어가 숨겨지고 값이 type-specific
 * extension 의 동의어 라벨에 저장될 수 있으므로(form-cards SEMANTIC_GROUPS),
 * 코어를 우선하되 비어 있으면 같은 의미 그룹의 채워진 블록으로 폴백한다.
 */
function pickValue(blocks: Block[], coreLabel: string): BlockValue | undefined {
  const labels = equivalentLabels(coreLabel);
  const candidates = blocks.filter((b) => labels.includes(b.label));
  const ordered = [
    ...candidates.filter((b) => b.label === coreLabel),
    ...candidates.filter((b) => b.label !== coreLabel),
  ];
  return (ordered.find((b) => !isBlockEmpty(b)) ?? ordered[0])?.value;
}

function textOf(value: BlockValue | undefined): string {
  if (value && (value.type === "text" || value.type === "textarea")) {
    return value.text ?? "";
  }
  return "";
}

function selectedOf(value: BlockValue | undefined): string {
  return value && value.type === "single-select" ? value.selected : "";
}

/**
 * 포트폴리오는 공개 발행물이므로 명시적 옵트인(공개)만 발행한다.
 * status 는 toExperienceV2 가 정규화한 값(content.status, 없으면 "draft") 기준이고,
 * 공개 여부는 '공개 설정' single-select 가 정확히 "공개" 일 때만 true 다.
 * 누락/빈 값/"일부 공개"/"비공개" 는 모두 비공개로 취급한다(기본 비공개).
 */
export function isPublishableExperience(exp: Experience): boolean {
  const ev2 = toExperienceV2(exp);
  if (ev2.status !== "complete") return false;
  const blocks = [...ev2.coreBlocks, ...ev2.extensionBlocks];
  return selectedOf(findBlock(blocks, "공개 설정")?.value) === "공개";
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
  // 코어가 비고 값이 type-specific extension 에 저장된 경우(폼 dedup)를 위해 양쪽을 본다.
  const blocks = [...core, ...ev2.extensionBlocks];
  const label = EXPERIENCE_TYPE_MAP[exp.type as ExperienceTypeId]?.label ?? "경험";
  return {
    id: exp.id,
    title: ev2.title || textOf(findBlock(core, "경험명")?.value),
    period: periodOf(pickValue(blocks, "기간")),
    category: label,
    summary: ev2.summary || textOf(findBlock(core, "한 줄 요약")?.value),
    contribution: textOf(pickValue(blocks, "내 역할/기여도")),
    achievement: textOf(pickValue(blocks, "핵심 성과")),
    keywords: ev2.tags,
  };
}

export function buildPortfolio(
  id: string,
  experiences: Experience[],
  profile: PortfolioProfile,
): Portfolio {
  return { id, profile, posts: experiences.filter(isPublishableExperience).map(experienceToPost) };
}
