// 데모 시드가 **현재 확정본 템플릿과 어긋나지 않는지** 고정하는 그물.
//
// 데모는 로그인 없이 제품을 보여주는 유일한 경로인데, 시드는 화면과 달리 사람이 손으로 쓴
// 데이터라 템플릿이 바뀌어도 아무도 깨뜨리지 않는다. 그래서 유형별 입력항목 확정본이
// 여러 차례 정렬되는 동안 시드만 v1 블록 형태로 남아 "기타" 카드에 값이 밀려 있었다.
// 이 파일은 그 재발을 **다음 확정본 정렬 시점에 즉시** 알리는 것이 목적이다.

import { describe, it, expect } from "vitest";

import { TEMPLATE_VERSION } from "@/lib/constants/templates-v2";
import { toExperienceV2 } from "@/lib/utils/experience-mapper";
import { SCHEMA_VERSION_V2 } from "@/types/archive";
import type { BlockValue, ExperienceTypeId } from "@/types/archive";
import { isBlockEmpty } from "@/lib/utils/block-utils";

import {
  seedCoverLetter,
  seedExperiences,
  seedLibraryMembership,
  templateBlocksByKey,
} from "./seed";
import {
  mockAnalysisHomeSummary,
  mockComprehensiveList,
  mockComprehensiveResult,
  mockIndividualAnalysisResult,
  mockKeywordResult,
  mockSelectableExperiences,
} from "@/lib/api/mocks/analysis";

type SeedContent = {
  schema_version?: number;
  template_version?: number;
  fields?: Record<string, BlockValue>;
  custom?: unknown[];
};

function contentOf(exp: (typeof seedExperiences)[number]): SeedContent {
  return exp.content as SeedContent;
}

/**
 * `fields` 맵을 꺼내되 **비어 있으면 그 자체로 실패**시킨다.
 *
 * 이 가드가 없으면 아래 검사들이 빈 객체를 순회하고 통과한다 — 시드가 v1 형태라
 * `fields` 가 아예 없던 시점에도 orphan·값 타입·컬럼 검사가 전부 초록으로 떴다.
 * 통과했다는 사실이 아무것도 증명하지 않는 상태를 남기지 않는다.
 */
function fieldsOf(exp: (typeof seedExperiences)[number]): Record<string, BlockValue> {
  const fields = contentOf(exp).fields;
  expect(fields, `${exp.id}: fields 맵이 없다 (v1 형태?)`).toBeDefined();
  expect(
    Object.keys(fields ?? {}).length,
    `${exp.id}: fields 가 비어 있어 아래 검사가 공허해진다`,
  ).toBeGreaterThan(5);
  return fields ?? {};
}

/**
 * 템플릿 소비 규칙은 시드(`seed.ts`)와 **같은 함수**를 쓴다.
 *
 * 여기서 다시 구현하면 규칙이 바뀔 때 시드만 따라가고 그물은 옛 규칙에 머문다 —
 * 이 파일이 막으려는 드리프트가 정작 이 파일에서 나는 셈이 된다.
 */
const templateBlocks = templateBlocksByKey;

describe("데모 시드 — 확정본 입력항목 정렬", () => {
  it("모든 경험이 스키마 v2 로 저장돼 있다", () => {
    // v1(coreBlocks/extensionBlocks) 로 두면 toExperienceV2 가 라벨 매칭 경로를 타서
    // 확정본에서 라벨이 바뀐 값이 조용히 '기타' 카드로 밀린다.
    for (const exp of seedExperiences) {
      const content = contentOf(exp);
      expect(content.schema_version, `${exp.id}: schema_version`).toBe(SCHEMA_VERSION_V2);
      expect(content.template_version, `${exp.id}: template_version`).toBe(TEMPLATE_VERSION);
      expect(content.fields, `${exp.id}: fields 맵`).toBeDefined();
    }
  });

  it("확정본이 반영된 유형만 쓴다", () => {
    // 확정본 미반영 유형(개인/팀 프로젝트·연구)을 데모에 두면 "바뀐 입력항목"을 보여줄 수 없다.
    const canonical = new Set<string>([
      "career",
      "extracurricular",
      "club",
      "award",
      "certification",
      "language",
      "overseas",
      "creative-work",
      "education",
      "volunteer",
      "reading",
    ]);
    for (const exp of seedExperiences) {
      expect(canonical.has(exp.type), `${exp.id}: 확정본 미반영 유형 ${exp.type}`).toBe(true);
    }
  });

  it("모든 fields 키가 현재 템플릿의 안정키다 — orphan 0건", () => {
    for (const exp of seedExperiences) {
      const known = templateBlocks(exp.type as ExperienceTypeId);
      const unknown = Object.keys(fieldsOf(exp)).filter(k => !known.has(k));
      expect(unknown, `${exp.id}(${exp.type}) 템플릿에 없는 키`).toEqual([]);
    }
  });

  it("값 타입이 템플릿 블록 타입과 일치한다", () => {
    // injectValue 는 타입이 다르면 값을 조용히 버린다(text↔textarea 만 예외).
    // 시드가 잘못된 모양을 담으면 화면에는 빈 칸이 뜨는데 테스트는 통과해버린다.
    for (const exp of seedExperiences) {
      const known = templateBlocks(exp.type as ExperienceTypeId);
      for (const [key, value] of Object.entries(fieldsOf(exp))) {
        const block = known.get(key);
        if (!block) continue; // 위 테스트가 따로 잡는다
        const textual = new Set(["text", "textarea"]);
        const ok = value.type === block.type || (textual.has(value.type) && textual.has(block.type));
        expect(ok, `${exp.id}: ${key} 값 타입 ${value.type} ≠ 블록 타입 ${block.type}`).toBe(true);
      }
    }
  });

  it("toExperienceV2 를 통과해도 '기타' 카드가 생기지 않는다", () => {
    // 화면이 실제로 지나는 경로. 여기서 customBlocks 가 비어야 확정본 칸 그대로 그려진다.
    for (const exp of seedExperiences) {
      const v2 = toExperienceV2(exp);
      const labels = v2.customBlocks.map(b => b.label);
      expect(labels, `${exp.id}(${exp.type}) 기타 카드로 밀린 값`).toEqual([]);
    }
  });

  it("필수 필드가 모두 채워져 있다", () => {
    // 빈 required 는 데모 상세에서 빈 칸으로 뜨고, 편집 화면에서는 완료 저장을 막는다.
    for (const exp of seedExperiences) {
      const v2 = toExperienceV2(exp);
      const blanks = [...v2.coreBlocks, ...v2.extensionBlocks]
        .filter(b => b.required && isBlockEmpty(b))
        .map(b => b.label);
      expect(blanks, `${exp.id}(${exp.type}) 빈 필수 필드`).toEqual([]);
    }
  });

  it("표(repeatable-cell) 의 컬럼이 템플릿 정의와 같다", () => {
    // 컬럼이 어긋나면 injectValue 가 열 잠금을 풀어(FRT-104) 데모에 열 관리 UI 가 노출된다.
    for (const exp of seedExperiences) {
      const known = templateBlocks(exp.type as ExperienceTypeId);
      for (const [key, value] of Object.entries(fieldsOf(exp))) {
        if (value.type !== "repeatable-cell") continue;
        const block = known.get(key);
        if (!block || block.value.type !== "repeatable-cell") continue;
        expect(
          value.columns.map(c => c.key),
          `${exp.id}: ${key} 컬럼 구성`,
        ).toEqual(block.value.columns.map(c => c.key));
      }
    }
  });

  it("모든 경험이 포트폴리오에 발행되도록 '공개' 로 설정돼 있다", () => {
    // build-portfolio 는 명시적 옵트인만 발행한다. 시드가 비면 데모 포트폴리오가 통째로 빈다.
    for (const exp of seedExperiences) {
      const visibility = fieldsOf(exp)["extended.공개 설정"];
      expect(visibility, `${exp.id}: 공개 설정`).toEqual({
        type: "single-select",
        options: ["공개", "비공개", "일부 공개"],
        selected: "공개",
      });
    }
  });

  it("라이브러리 멤버십이 실재하는 경험만 가리킨다", () => {
    const ids = new Set(seedExperiences.map(e => e.id));
    for (const [libId, members] of Object.entries(seedLibraryMembership)) {
      for (const id of members) {
        expect(ids.has(id), `${libId} 의 멤버 ${id} 가 시드에 없다`).toBe(true);
      }
    }
  });
});

// ─── 분석 mock ↔ 시드 결속 ──────────────────────────────────
//
// 데모의 분석 결과는 `lib/api/mocks/analysis.ts` 가 정본이다(analysis-api 의 isDemoMode 분기).
// 그 본문이 시드와 어긋나면 화면은 존재하지 않는 경험을 인용하게 된다 — 실제로 그런 상태였다.

/** 이 경험이 담고 있는 사람이 읽는 텍스트를 전부 모은다(원문 대조용). */
function seedText(exp: (typeof seedExperiences)[number]): string {
  const parts: string[] = [];
  const content = contentOf(exp) as SeedContent & { title?: string; summary?: string };
  parts.push(content.title ?? "", content.summary ?? "");
  for (const value of Object.values(content.fields ?? {})) {
    switch (value.type) {
      case "text":
      case "textarea":
        parts.push(value.text);
        break;
      case "repeatable-cell":
        for (const row of value.rows) {
          for (const cell of Object.values(row.cells)) {
            if (typeof cell === "string") parts.push(cell);
            else if (Array.isArray(cell)) parts.push(cell.join(" "));
          }
        }
        break;
      default:
        break;
    }
  }
  return parts.join("\n");
}

describe("분석 mock — 시드 결속", () => {
  const allSeedText = seedExperiences.map(seedText).join("\n");
  const seedIds = new Set(seedExperiences.map(e => e.id));
  const seedTitles = new Set(seedExperiences.map(e => (e.content as { title?: string }).title));

  it("선택 가능한 경험 목록이 시드와 1:1로 대응한다", () => {
    expect(mockSelectableExperiences.map(e => e.id).sort()).toEqual([...seedIds].sort());
    for (const item of mockSelectableExperiences) {
      const seed = seedExperiences.find(e => e.id === item.id);
      expect(seed, `${item.id} 가 시드에 없다`).toBeDefined();
      expect(item.type, `${item.id} 유형 불일치`).toBe(seed?.type);
      expect(item.title, `${item.id} 제목 불일치`).toBe(
        (seed?.content as { title?: string }).title,
      );
    }
  });

  it("홈 요약의 경험 수·추천 묶음이 시드를 가리킨다", () => {
    expect(mockAnalysisHomeSummary.stats.totalExperiences).toBe(seedExperiences.length);
    for (const group of mockAnalysisHomeSummary.recommendations.experienceGroups) {
      for (const id of group.experienceIds) {
        expect(seedIds.has(id), `추천 묶음이 없는 경험 ${id} 를 가리킨다`).toBe(true);
      }
    }
  });

  it("종합분석이 참조하는 경험 id 가 시드에 있다 (삭제된 경험 제외)", () => {
    for (const snapshot of mockComprehensiveList) {
      for (const id of snapshot.selectedExperienceIds ?? []) {
        expect(seedIds.has(id), `${snapshot.id} 가 없는 경험 ${id} 를 가리킨다`).toBe(true);
      }
    }
    for (const ref of mockComprehensiveResult.experiences) {
      // title=null 은 "삭제된 경험" 표시를 보여주기 위한 의도된 항목이다.
      if (ref.title === null) continue;
      expect(seedIds.has(ref.id), `종합분석이 없는 경험 ${ref.id} 를 인용한다`).toBe(true);
      expect(seedTitles.has(ref.title), `제목 불일치: ${ref.title}`).toBe(true);
    }
    expect(mockIndividualAnalysisResult.experienceId).toSatisfy((id: string) => seedIds.has(id));
    expect(mockIndividualAnalysisResult.result.itemName).toSatisfy((t: string) =>
      seedTitles.has(t),
    );
  });

  it("STAR 근거 인용문이 실제 시드 원문에 있다", () => {
    // v3.1 sourceQuotes 는 "원문 대조에 성공한 문장"이라는 뜻이다. 지어낸 문장을 넣으면
    // evidenceStatus 가 보고하는 것과 데이터가 모순된다.
    for (const star of mockComprehensiveResult.resumeStarFormat) {
      for (const [slot, quote] of Object.entries(star.sourceQuotes)) {
        if (!quote) continue;
        expect(
          allSeedText.includes(quote),
          `STAR "${star.title}" 의 ${slot} 인용이 시드 원문에 없다: ${quote}`,
        ).toBe(true);
      }
    }
  });

  it("키워드 분석의 근거 인용문이 실제 시드 원문에 있다", () => {
    for (const group of mockKeywordResult.matchedExperiences) {
      for (const exp of group.experiences) {
        for (const ev of exp.evidence) {
          expect(
            allSeedText.includes(ev.sourceQuote),
            `'${group.keyword}' / ${exp.careerTitle} 의 근거 인용이 시드 원문에 없다: ${ev.sourceQuote}`,
          ).toBe(true);
        }
      }
    }
    for (const storyline of mockKeywordResult.storylines) {
      for (const q of storyline.keyQuotes) {
        expect(
          allSeedText.includes(q.quote),
          `스토리라인 인용이 시드 원문에 없다: ${q.quote}`,
        ).toBe(true);
      }
    }
  });

  it("키워드 커버리지의 모수가 시드 경험 수와 같다", () => {
    for (const c of mockKeywordResult.coverage) {
      expect(c.totalCount, `'${c.keyword}' 커버리지 모수`).toBe(seedExperiences.length);
      expect(
        c.highCount + c.mediumCount + c.lowCount,
        `'${c.keyword}' 등급별 합계가 relatedCount 와 다르다`,
      ).toBe(c.relatedCount);
    }
  });

  it("matchedCriteria 가 실재하는 판단 기준 id 를 가리킨다", () => {
    const byKeyword = new Map(
      mockKeywordResult.keywordDefinitions.map(d => [
        d.keyword,
        new Set(d.complianceCriteria.map(c => c.id)),
      ]),
    );
    for (const group of mockKeywordResult.matchedExperiences) {
      const known = byKeyword.get(group.keyword);
      expect(known, `'${group.keyword}' 정의가 없다`).toBeDefined();
      for (const exp of group.experiences) {
        for (const id of exp.matchedCriteria) {
          if (typeof id !== "number") continue; // 구버전 백엔드의 서술 문자열은 그대로 둔다
          expect(known?.has(id), `'${group.keyword}' 에 없는 기준 id ${id}`).toBe(true);
        }
      }
    }
  });

  it("topFixes 수치가 항목별 기준과 일치한다", () => {
    // 총평의 'N건 중 M건에서 미달' 은 사람이 손으로 적는 집계인데, 사용자는 같은 화면에서
    // 항목별 기준을 펼쳐 원본을 볼 수 있다. 집계만 옛 값으로 남으면 데모가 스스로를 반박한다.
    const review = mockComprehensiveResult.starAnalysisStatus.qualityReview;
    const entries = mockComprehensiveResult.resumeStarFormat;
    expect(review, "qualityReview 가 없으면 아래 집계 검사가 공허해진다").toBeTruthy();
    if (!review) return;
    expect(entries.length, "STAR 항목이 없으면 아래 집계 검사가 공허해진다").toBeGreaterThan(0);
    expect(review.topFixes.length, "topFixes 가 비면 검사가 공허해진다").toBeGreaterThan(0);
    expect(review.evaluated, "evaluated 가 실제 항목 수와 다르다").toBe(entries.length);

    for (const fix of review.topFixes) {
      const m = /^(.+?) — (\d+)건 중 (\d+)건에서 미달$/.exec(fix);
      expect(m, `topFixes 문구 형식이 다르다: ${fix}`).not.toBeNull();
      if (!m) continue;
      const [, label, total, failed] = m;

      const withCriterion = entries.filter(e => e.quality?.criteria.some(c => c.label === label));
      expect(withCriterion.length, `'${label}' 기준을 가진 항목이 없다`).toBeGreaterThan(0);

      const actualFailed = withCriterion.filter(e =>
        e.quality?.criteria.some(c => c.label === label && !c.passed),
      ).length;
      expect(Number(failed), `'${label}' 미달 건수가 항목별 기준과 다르다`).toBe(actualFailed);
      expect(Number(total), `'${label}' 모수가 평가 건수와 다르다`).toBe(review.evaluated);
    }
  });

  it("자기소개서의 '근거 없는 주장' 이 정말 시드에 근거가 없다", () => {
    // 이 예시는 하이라이트·배너 두 경로를 보여주기 위한 의도된 설계다. 경험을 고치다
    // 우연히 근거가 생기면 예시가 성립하지 않는다.
    for (const answer of seedCoverLetter.answers) {
      for (const claim of answer.grounding?.unsupported_claims ?? []) {
        expect(
          allSeedText.includes(claim),
          `'근거 없는 주장' 이 실제로는 시드에 있다: ${claim}`,
        ).toBe(false);
      }
    }
  });
});
