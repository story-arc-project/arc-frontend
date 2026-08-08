import type { Block, BlockValue, ExperienceTypeId } from "@/types/archive";
import type { Experience } from "@/types/experience";
import type { Portfolio, PortfolioPost, PortfolioProfile } from "@/types/portfolio";
import { EXPERIENCE_TYPE_MAP } from "@/lib/constants/templates-v2";
import { toExperienceV2 } from "@/lib/utils/experience-mapper";
import { cellText, isBlockEmpty } from "@/lib/utils/block-utils";
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
        .map((v) => cellText(v).trim())
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
// '한 줄 감상'(독서, FRT-236)은 "이 책을 한 줄로 정리한다면?" 이라 곧 한 줄 요약이다.
// 코어 '한 줄 요약'이 optional 이라 비워 두기 쉬운데, 여기 없으면 발행물 요약이 통째로 빈다.
const SUMMARY_LABELS = ["한 줄 요약", "한 줄 설명", "한 줄 소개", "한 줄 감상"];

// 확정본 정렬로 코어 '기간'을 뺀 유형(CORE_EXCLUDE)은 자기 시점 필드를 따로 갖는다.
// 그 값이 우선하지 않으면, 개편 전 레코드에 orphan 으로 남은 `core.기간`(라벨이 정확히 '기간'
// 이라 pickValue 의 정확-라벨 우선 정렬에서 동의어를 이긴다)이 계속 발행된다. SUMMARY_LABELS 와
// 같은 이유로 SEMANTIC_GROUPS 가 아니라 로컬 상수다 — 여기에 넣으면 입력 폼 dedup 까지 바뀐다.
//
// ⚠️ 라벨이 아니라 **유형별 안정키**로 찾는다(Codex P2). 라벨로 훑으면 다른 유형에 우연히
// 같은 이름의 커스텀·레거시 블록이 있을 때 무관한 날짜가 발행 기간으로 나가고, 자격증에
// '수상일' 잔재가 섞이면 탐색 순서만으로 엉뚱한 쪽이 뽑힌다.
//
// 값 타입은 유형마다 다르다 — 수상·자격증은 단일 `date`, 독서는 시작~종료를 받는 `period`
// (FRT-236). 그래서 `date` 만 포맷하던 것을 둘 다 받도록 넓혔다.
const TYPE_PERIOD_KEY: Partial<Record<ExperienceTypeId, string>> = {
  award: "award-info.수상일",
  certification: "cert-info.취득일",
  reading: "book-info.독서 기간",
  volunteer: "volunteer-info.활동 기간",
};

/** 코어 '기간'이 없는 유형의 시점. 값이 없으면 빈 문자열 — 없는 날짜를 지어내지 않는다. */
function typePeriodOf(typeId: ExperienceTypeId, blocks: Block[]): string {
  const key = TYPE_PERIOD_KEY[typeId];
  if (!key) return "";
  const block = blocks.find((b) => b.key === key && !isBlockEmpty(b));
  if (!block) return "";
  if (block.value.type === "date") return ym(block.value.date);
  return periodOf(block.value);
}

// 성과 라벨 그룹(SEMANTIC_GROUPS.achievement)엔 성격이 다른 둘이 섞여 있다:
//  - 동의어(핵심 성과·결과/성과·성과 등): 같은 질문의 **대안**. 하나만 고른다(core 우선).
//  - 상호보완(학회 `단체 활동 / 성과`·`개인 활동 / 성과`): 동시에 채우는 별개 항목. 모두 합친다.
const COMPLEMENTARY_ACHIEVEMENT_LABELS = ["단체 활동 / 성과", "개인 활동 / 성과"];

/**
 * 성과 텍스트를 만든다.
 * - 동의어는 첫 채워진 값 하나만 쓴다. 구 레코드에서 core `핵심 성과`와 type-specific 동의어
 *   (`결과/성과` 등)가 동시에 남아 있어도 합치면 포트폴리오에 성과가 중복·과장되므로 core 우선 단일.
 * - 학회 상호보완 필드(단체·개인 활동/성과)만 모두 합친다. 단일 유형은 채워진 게 하나라 무변화(무회귀).
 * 호출측이 customBlocks 까지 넘기면, 폐기된 템플릿 필드(구 `extended.결과/성과`)가 orphan 으로
 * 보존된 경우에도 발행 시 성과가 소실되지 않는다.
 */
function achievementText(blocks: Block[]): string {
  const synonymLabels = equivalentLabels("핵심 성과").filter(
    (l) => !COMPLEMENTARY_ACHIEVEMENT_LABELS.includes(l),
  );
  const parts: string[] = [];
  // 동의어: core 우선, 채워진 것 하나만.
  const filledSynonyms = blocks.filter((b) => synonymLabels.includes(b.label) && !isBlockEmpty(b));
  const primary = filledSynonyms.find((b) => b.label === "핵심 성과") ?? filledSynonyms[0];
  const primaryText = textOf(primary?.value);
  if (primaryText) parts.push(primaryText);
  // 상호보완(학회): 채워진 것 모두.
  for (const b of blocks) {
    if (COMPLEMENTARY_ACHIEVEMENT_LABELS.includes(b.label) && !isBlockEmpty(b)) {
      const t = textOf(b.value);
      if (t) parts.push(t);
    }
  }
  return parts.join("\n");
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
  // 세 출처를 함께 본다: (1) 코어, (2) 값이 type-specific extension 동의어 라벨에 저장된 경우
  // (폼 dedup), (3) 템플릿 개편으로 폐기된 필드값이 orphan 으로 custom 에 보존된 경우
  // (experience-mapper 안전망 — v2 orphanFieldsToBlocks·v1 미매칭 extension 이관).
  // custom 을 빼면 orphan 된 기간·기여·성과가 발행 시 소실된다.
  // 단, 사용자 섹션(type 'group')은 스칼라 값이 없는 구조 블록이라 값 폴백 대상이 아니다.
  // 코어 라벨(예 '기간')과 같은 이름의 커스텀 섹션이 채워져 있으면 pickValue 정렬에서
  // 앞서 뽑혀 periodOf/textOf 가 빈 값을 돌려주고 실제 동의어 값이 소실되므로 제외한다.
  const blocks = [...core, ...ev2.extensionBlocks, ...ev2.customBlocks].filter(
    (b) => b.type !== "group",
  );
  const label = EXPERIENCE_TYPE_MAP[exp.type as ExperienceTypeId]?.label ?? "경험";
  return {
    id: exp.id,
    title: ev2.title || textOf(findBlock(core, "경험명")?.value),
    // 확정본이 시점을 자기 필드로 정한 유형은 **그 필드가 먼저**다. 개편 전 레코드는 폐기된
    // `core.기간` 이 orphan 으로 custom 에 남아 있어(experience-mapper 안전망) 범용 조회가
    // 먼저 걸리면, 화면에서 볼 수도 고칠 수도 없는 옛 범위가 계속 발행되고 새로 채운 값이
    // 반영되지 않는다. 새 값이 비어 있을 때만 옛 기간으로 폴백한다 — 있는 정보를 지우지 않는다.
    period: typePeriodOf(exp.type as ExperienceTypeId, blocks) || periodOf(pickValue(blocks, "기간")),
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
