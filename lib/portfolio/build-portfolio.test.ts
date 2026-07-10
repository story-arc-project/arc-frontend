import { describe, it, expect } from "vitest";
import type { Experience } from "@/types/experience";
import type { Block } from "@/types/archive";
import { SCHEMA_VERSION_V2 } from "@/types/archive";
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

  it("코어가 비고 type-specific extension(동의어)에만 값이 있으면 폴백한다", () => {
    // 폼 dedup 으로 빈 코어가 숨겨지고 값이 extension 동의어 라벨에 저장된 케이스.
    const core: Block[] = [
      blk("c1", "text", "경험명", { type: "text", text: "팀 프로젝트" }),
      blk("c2", "period", "기간", { type: "period", start: "", end: "", isCurrent: false }),
      blk("c3", "text", "한 줄 요약", { type: "text", text: "요약" }),
      blk("c4", "textarea", "내 역할/기여도", { type: "textarea", text: "" }),
      blk("c5", "textarea", "핵심 성과", { type: "textarea", text: "" }),
    ];
    const ext: Block[] = [
      blk("e1", "period", "재직기간", { type: "period", start: "2025-03-01", end: "2025-08-31", isCurrent: false }),
      blk("e2", "textarea", "내 역할", { type: "textarea", text: "프론트엔드 전담" }),
      blk("e3", "textarea", "결과/성과", { type: "textarea", text: "출시 및 200+ 다운로드" }),
    ];
    const exp = makeExp({
      type: "team-project",
      content: { title: "팀 프로젝트", summary: "요약", status: "complete", tags: [], coreBlocks: core, extensionBlocks: ext },
    });
    const post = experienceToPost(exp);
    expect(post.period).toBe("2025.03 – 2025.08");
    expect(post.contribution).toBe("프론트엔드 전담");
    expect(post.achievement).toBe("출시 및 200+ 다운로드");
  });

  it("코어 라벨(기간)과 같은 이름의 사용자 섹션이 채워져 있어도 동의어의 실제 기간을 소실하지 않는다", () => {
    // 사용자 섹션(type 'group')은 스칼라 값이 없는 구조 블록이다. 값 폴백 풀에서 제외하지 않으면
    // pickValue 정렬에서 채워진 그룹 '기간'이 동의어 '재직기간'보다 먼저 뽑혀 periodOf 가 빈 값을
    // 돌려주고 실제 기간이 발행에서 소실된다(Codex P2 회귀).
    const core: Block[] = [
      blk("c1", "text", "경험명", { type: "text", text: "팀 프로젝트" }),
      blk("c2", "period", "기간", { type: "period", start: "", end: "", isCurrent: false }),
      blk("c3", "text", "한 줄 요약", { type: "text", text: "요약" }),
      blk("c4", "textarea", "내 역할/기여도", { type: "textarea", text: "역할" }),
      blk("c5", "textarea", "핵심 성과", { type: "textarea", text: "성과" }),
    ];
    const ext: Block[] = [
      blk("e1", "period", "재직기간", { type: "period", start: "2025-03-01", end: "2025-08-31", isCurrent: false }),
    ];
    // 사용자가 '기간'이라는 이름으로 만든 채워진 커스텀 섹션(group). 자식이 있어 isBlockEmpty=false.
    const groupNamedGigan: Block = {
      id: "g1",
      type: "group",
      label: "기간",
      value: { type: "group" },
      children: [blk("g1c1", "textarea", "메모", { type: "textarea", text: "이건 기간이 아니라 사용자 메모" })],
    };
    const exp = makeExp({
      type: "team-project",
      content: {
        title: "팀 프로젝트",
        summary: "요약",
        status: "complete",
        tags: [],
        coreBlocks: core,
        extensionBlocks: ext,
        customBlocks: [groupNamedGigan],
      },
    });
    const post = experienceToPost(exp);
    expect(post.period).toBe("2025.03 – 2025.08");
  });

  it("기간 동의어가 text 블록(예: 읽은 기간/완독일)이면 입력 문자열을 그대로 쓴다", () => {
    const core: Block[] = [
      blk("c1", "text", "경험명", { type: "text", text: "독서" }),
      blk("c2", "period", "기간", { type: "period", start: "", end: "", isCurrent: false }),
    ];
    const ext: Block[] = [
      blk("e1", "text", "읽은 기간/완독일", { type: "text", text: "2024.03 ~ 2024.05" }),
    ];
    const exp = makeExp({
      content: { title: "독서", summary: "요약", status: "complete", tags: [], coreBlocks: core, extensionBlocks: ext },
    });
    expect(experienceToPost(exp).period).toBe("2024.03 ~ 2024.05");
  });

  it("성과 동의어가 repeatable-cell(예: 결과/성과)이면 평탄화해서 채운다", () => {
    const core: Block[] = [
      blk("c1", "text", "경험명", { type: "text", text: "대외활동" }),
      blk("c5", "textarea", "핵심 성과", { type: "textarea", text: "" }),
    ];
    const ext: Block[] = [
      blk("e1", "repeatable-cell", "결과/성과", {
        type: "repeatable-cell",
        columns: [{ key: "action", label: "한 일", blockType: "text" }],
        rows: [
          { id: "r1", cells: { action: "mAP 0.68 달성" } },
          { id: "r2", cells: { action: "앙상블 전략 적용" } },
        ],
      }),
    ];
    const exp = makeExp({
      content: { title: "대외활동", summary: "요약", status: "complete", tags: [], coreBlocks: core, extensionBlocks: ext },
    });
    expect(experienceToPost(exp).achievement).toBe("mAP 0.68 달성\n앙상블 전략 적용");
  });

  it("학회: 단체·개인 활동/성과가 둘 다 채워지면 성과를 모두 합친다(상호보완 필드)", () => {
    // 학회는 '단체 활동 / 성과'와 '개인 활동 / 성과'를 동시에 채우는 상호보완 필드다.
    // 첫 값만 뽑으면 뒤 목록이 통째로 누락되므로 둘 다 포함해야 한다.
    const core: Block[] = [
      blk("c1", "text", "경험명", { type: "text", text: "AI 학회" }),
      blk("c5", "textarea", "핵심 성과", { type: "textarea", text: "" }), // dedup 으로 빈 코어
    ];
    const ext: Block[] = [
      blk("e1", "repeatable-cell", "단체 활동 / 성과", {
        type: "repeatable-cell",
        columns: [{ key: "item", label: "활동 / 성과", blockType: "text" }],
        rows: [{ id: "r1", cells: { item: "전국 케이스 경진대회 은상" } }],
      }),
      blk("e2", "repeatable-cell", "개인 활동 / 성과", {
        type: "repeatable-cell",
        columns: [{ key: "item", label: "활동 / 성과", blockType: "text" }],
        rows: [{ id: "r2", cells: { item: "우수 부원 선정" } }],
      }),
    ];
    const exp = makeExp({
      type: "academic-society",
      content: { title: "AI 학회", summary: "요약", status: "complete", tags: [], coreBlocks: core, extensionBlocks: ext },
    });
    expect(experienceToPost(exp).achievement).toBe("전국 케이스 경진대회 은상\n우수 부원 선정");
  });

  it("성과 동의어가 core 와 type-specific 에 동시에 남아 있어도 하나만 쓴다(중복·과장 방지)", () => {
    // 동의어(핵심 성과 ↔ 결과/성과)는 같은 질문의 대안이다. 둘 다 채워져 있어도 합치면
    // 포트폴리오에 성과가 중복/과장되므로 core 우선 단일 값만 쓴다(상호보완 학회 필드와 구분).
    const core: Block[] = [
      blk("c1", "text", "경험명", { type: "text", text: "프로젝트" }),
      blk("c5", "textarea", "핵심 성과", { type: "textarea", text: "코어 성과값" }),
    ];
    const ext: Block[] = [
      blk("e1", "textarea", "결과/성과", { type: "textarea", text: "중복 성과값" }),
    ];
    const exp = makeExp({
      content: { title: "프로젝트", summary: "요약", status: "complete", tags: [], coreBlocks: core, extensionBlocks: ext },
    });
    expect(experienceToPost(exp).achievement).toBe("코어 성과값");
  });

  it("학회(구 레코드): 폐기된 extended.결과/성과 성과값이 orphan 으로 보존돼도 발행 시 포함한다", () => {
    // 3차 개편으로 학회 템플릿에서 범용 extended 가 빠지며 구 `extended.결과/성과` 는 현재 템플릿이
    // 소비하지 않아 customBlocks(orphan)로 보존된다. 성과 계산이 core+extension 만 보면 이 값이
    // 통째로 누락되므로 customBlocks 까지 봐야 발행 포트폴리오에서 성과가 소실되지 않는다.
    const exp = makeExp({
      type: "academic-society",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "AI 학회",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: {
          "extended.결과/성과": { type: "textarea", text: "전국 대회 대상 수상" },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).achievement).toBe("전국 대회 대상 수상");
  });

  it("한 줄 요약이 비면 type-specific 한 줄 설명으로 폴백한다", () => {
    const core: Block[] = [
      blk("c1", "text", "경험명", { type: "text", text: "프로젝트" }),
      blk("c3", "text", "한 줄 요약", { type: "text", text: "" }),
    ];
    const ext: Block[] = [
      blk("e1", "text", "한 줄 설명", { type: "text", text: "프로젝트 한 줄 설명입니다" }),
    ];
    const exp = makeExp({
      content: { title: "프로젝트", summary: "", status: "complete", tags: [], coreBlocks: core, extensionBlocks: ext },
    });
    expect(experienceToPost(exp).summary).toBe("프로젝트 한 줄 설명입니다");
  });

  it("코어와 extension 동의어가 모두 있으면 채워진 코어를 우선한다", () => {
    const ext: Block[] = [
      blk("e1", "period", "재직기간", { type: "period", start: "2099-01-01", end: "2099-12-31", isCurrent: false }),
    ];
    const exp = makeExp({
      content: {
        title: "주가 예측 프로젝트",
        summary: "LLM 뉴스 감성 분석",
        status: "complete",
        tags: [],
        coreBlocks: (makeExp().content as { coreBlocks: Block[] }).coreBlocks,
        extensionBlocks: ext,
      },
    });
    // 코어 기간(2026.02 – 2026.05)이 채워져 있으므로 extension 재직기간을 덮어쓰지 않는다.
    expect(experienceToPost(exp).period).toBe("2026.02 – 2026.05");
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
