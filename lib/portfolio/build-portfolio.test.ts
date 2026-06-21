import { describe, it, expect } from "vitest";
import type { Experience } from "@/types/experience";
import type { Block } from "@/types/archive";
import type { PortfolioProfile } from "@/types/portfolio";
import { toExperienceV2, toSavePayload } from "@/lib/utils/experience-mapper";
import { buildPortfolio, experienceToPost, isPublishableExperience } from "./build-portfolio";

function blk(id: string, type: Block["type"], label: string, value: Block["value"]): Block {
  return { id, type, label, value };
}

function makeExp(overrides?: Partial<Experience>): Experience {
  const core: Block[] = [
    blk("c1", "text", "경험명", { type: "text", text: "주가 예측 프로젝트" }),
    blk("c2", "period", "기간", { type: "period", start: "2026-02-01", end: "2026-05-31", isCurrent: false }),
    blk("c3", "text", "한 줄 요약", { type: "text", text: "LLM 뉴스 감성 분석" }),
    blk("c4", "textarea", "내 역할/기여도", { type: "textarea", text: "전 과정 독립 수행" }),
    blk("c5", "textarea", "핵심 성과", { type: "textarea", text: "백테스팅 시각화 완성" }),
  ];
  return {
    id: "exp-1",
    user_id: "demo-user",
    type: "personal-project",
    importance: 5,
    content: {
      title: "주가 예측 프로젝트",
      summary: "LLM 뉴스 감성 분석",
      status: "complete",
      tags: ["LLM", "NLP"],
      coreBlocks: core,
      extensionBlocks: [
        blk("vis", "single-select", "공개 설정", {
          type: "single-select",
          options: ["공개", "비공개", "일부 공개"],
          selected: "공개",
        }),
      ],
    },
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-08T00:00:00Z",
    ...overrides,
  };
}

const profile: PortfolioProfile = { name: "데모 사용자", headline: "h", strengthTags: ["문제 해결"] };

describe("experienceToPost", () => {
  it("코어 블록을 요약/기여/성과 3필드로 매핑한다", () => {
    const post = experienceToPost(makeExp());
    expect(post.id).toBe("exp-1");
    expect(post.title).toBe("주가 예측 프로젝트");
    expect(post.period).toBe("2026.02 – 2026.05");
    expect(post.category).toBe("개인 프로젝트");
    expect(post.summary).toBe("LLM 뉴스 감성 분석");
    expect(post.contribution).toBe("전 과정 독립 수행");
    expect(post.achievement).toBe("백테스팅 시각화 완성");
    expect(post.keywords).toEqual(["LLM", "NLP"]);
  });

  it("진행 중(period.isCurrent)이면 종료를 '현재'로 표기한다", () => {
    const exp = makeExp();
    (exp.content as { coreBlocks: Block[] }).coreBlocks[1].value = {
      type: "period", start: "2026-02-01", end: "", isCurrent: true,
    };
    expect(experienceToPost(exp).period).toBe("2026.02 – 현재");
  });

  it("시작일만 있고 종료가 없으면(진행 중 아님) 시작일만 표기한다 — 매달린 구분자 없음", () => {
    const exp = makeExp();
    (exp.content as { coreBlocks: Block[] }).coreBlocks[1].value = {
      type: "period", start: "2026-02-01", end: "", isCurrent: false,
    };
    expect(experienceToPost(exp).period).toBe("2026.02");
  });

  it("알 수 없는 type 은 '경험' 라벨로 폴백한다", () => {
    expect(experienceToPost(makeExp({ type: "unknown-xyz" })).category).toBe("경험");
  });

  it("코어 블록이 없으면 throw 없이 빈 문자열로 방어한다", () => {
    const exp = makeExp({ content: {} });
    const post = experienceToPost(exp);
    expect(post.title).toBe("");
    expect(post.summary).toBe("");
    expect(post.contribution).toBe("");
    expect(post.achievement).toBe("");
    expect(post.period).toBe("");
    expect(post.keywords).toEqual([]);
  });

  it("v2 스키마(fields)로 저장된 경험도 period/역할/성과를 채운다", () => {
    const v1 = makeExp();
    const v2content = toSavePayload(toExperienceV2(v1));
    const v2exp: Experience = { ...v1, content: v2content.content };
    const post = experienceToPost(v2exp);
    expect(post.period).toBe("2026.02 – 2026.05");
    expect(post.contribution).toBe("전 과정 독립 수행");
    expect(post.achievement).toBe("백테스팅 시각화 완성");
  });
});

describe("buildPortfolio", () => {
  it("experiences N개 → posts N개 (결정적, 순서 유지)", () => {
    const a = makeExp({ id: "a" });
    const b = makeExp({ id: "b" });
    const result = buildPortfolio("demo-portfolio-1", [a, b], profile);
    expect(result.id).toBe("demo-portfolio-1");
    expect(result.profile).toEqual(profile);
    expect(result.posts.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("빈 experiences → 빈 posts (throw 없음)", () => {
    expect(buildPortfolio("demo-portfolio-1", [], profile).posts).toEqual([]);
  });

  it("명시적으로 '공개'인 경험만 발행한다 (draft·비공개 제외)", () => {
    const done = makeExp({ id: "done" }); // makeExp 기본 = 공개
    const draft: Experience = {
      ...makeExp({ id: "draft" }),
      content: { ...(makeExp().content as Record<string, unknown>), status: "draft" },
    };
    const hidden = withVisibility("hidden", "비공개");
    const result = buildPortfolio("demo-portfolio-1", [done, draft, hidden], profile);
    expect(result.posts.map((p) => p.id)).toEqual(["done"]);
  });
});

// 공개 설정 single-select 값을 바꾼(또는 블록을 제거한) complete 경험을 만든다.
function withVisibility(id: string, selected: string | null): Experience {
  const core = (makeExp().content as { coreBlocks: Block[] }).coreBlocks;
  const ext: Block[] =
    selected === null
      ? []
      : [
          blk("v", "single-select", "공개 설정", {
            type: "single-select",
            options: ["공개", "비공개", "일부 공개"],
            selected,
          }),
        ];
  return {
    ...makeExp({ id }),
    content: { title: id, summary: "", status: "complete", tags: [], coreBlocks: core, extensionBlocks: ext },
  };
}

describe("isPublishableExperience (명시적 옵트인)", () => {
  it("complete + 공개 설정 '공개' → 발행 가능", () => {
    expect(isPublishableExperience(makeExp())).toBe(true);
  });

  it("draft 면 공개여도 발행 불가", () => {
    const draft: Experience = {
      ...makeExp(),
      content: { ...(makeExp().content as Record<string, unknown>), status: "draft" },
    };
    expect(isPublishableExperience(draft)).toBe(false);
  });

  it.each([
    ["공개 설정 블록 누락", null],
    ["빈 값", ""],
    ["일부 공개", "일부 공개"],
    ["비공개", "비공개"],
  ])("기본 비공개 — %s 는 발행 불가", (_label, selected) => {
    expect(isPublishableExperience(withVisibility("x", selected))).toBe(false);
  });
});
