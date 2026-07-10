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

/** repeatable-cell(로그형) 값을 사람이 읽을 수 있는 텍스트로 평탄화한다. */
function flattenRepeatable(value: BlockValue): string {
  if (value.type !== "repeatable-cell") return "";
  return value.rows
    .map((row) =>
      value.columns
        .map((c) => row.cells[c.key])
        .map((v) => (Array.isArray(v) ? v.join(", ") : (v ?? "")).trim())
        .filter(Boolean)
        .join(" · "),
    )
    .filter(Boolean)
    .join("\n");
}

function textOf(value: BlockValue | undefined): string {
  if (!value) return "";
  if (value.type === "text" || value.type === "textarea") return value.text ?? "";
  // 동의어 폴백이 repeatable-cell(예: extracurricular '결과/성과')일 수 있어 평탄화한다.
  if (value.type === "repeatable-cell") return flattenRepeatable(value);
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
  if (!value) return "";
  // 동의어 폴백이 text 블록(예: reading '읽은 기간/완독일')이면 입력 문자열을 그대로 쓴다.
  if (value.type === "text" || value.type === "textarea") return (value.text ?? "").trim();
  if (value.type !== "period") return "";
  // 아카이브 읽기전용 뷰(formatPeriodString)와 동일하게: 시작일이 없으면 빈 값,
  // 종료(또는 진행 중)가 있을 때만 범위로, 단일 날짜는 매달린 구분자 없이 시작일만 표기.
  const start = ym(value.start);
  if (!start) return "";
  const end = value.isCurrent ? "현재" : ym(value.end);
  return end ? `${start} – ${end}` : start;
}

// 한 줄 요약(헤더, optional)이 비면 type-specific 한 줄 설명/소개(필수)로 폴백.
// SEMANTIC_GROUPS 에 넣지 않는다 — 폼 dedup 동작(아카이브 입력)을 바꾸지 않기 위해 로컬 처리.
const SUMMARY_LABELS = ["한 줄 요약", "한 줄 설명", "한 줄 소개"];

/**
 * "핵심 성과" 는 유형별로 보통 단일 동의어(결과/성과·성과 등) 하나로 저장되지만,
 * 학회는 `단체 활동 / 성과` 와 `개인 활동 / 성과` 를 **동시에** 채우는 상호보완 필드다.
 * pickValue(첫 비어있지 않은 것만)로 뽑으면 뒤 목록이 통째로 누락되므로, 성과만은
 * 채워진 동등 블록을 모두 모아 합친다. 단일 유형은 채워진 게 하나뿐이라 무변화(무회귀).
 */
function achievementText(blocks: Block[]): string {
  const labels = equivalentLabels("핵심 성과");
  return blocks
    .filter((b) => labels.includes(b.label) && !isBlockEmpty(b))
    .map((b) => textOf(b.value))
    .filter(Boolean)
    .join("\n");
}

function pickSummary(blocks: Block[]): string {
  for (const label of SUMMARY_LABELS) {
    const block = blocks.find((b) => b.label === label && !isBlockEmpty(b));
    const text = textOf(block?.value);
    if (text) return text;
  }
  return "";
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
    summary: ev2.summary || pickSummary(blocks),
    contribution: textOf(pickValue(blocks, "내 역할/기여도")),
    achievement: achievementText(blocks),
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
