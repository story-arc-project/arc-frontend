import { describe, it, expect } from "vitest";
import type { Experience } from "@/types/experience";
import type { Block } from "@/types/archive";
import { SCHEMA_VERSION_V2 } from "@/types/archive";
import type { PortfolioProfile } from "@/types/portfolio";
import { toExperienceV2, toSavePayload } from "@/lib/utils/experience-mapper";
import { getTemplateForType } from "@/lib/constants/templates-v2";
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

/**
 * FRT-211 회귀(Codex P1) — 단일 날짜로 시점을 받는 유형의 발행 기간.
 *
 * 확정본 정렬로 수상경력·자격증은 코어 '기간'을 빼고(CORE_EXCLUDE) 각각 '수상일'·'취득일'
 * 하나로 시점을 받는다. 그런데 발행 매퍼는 period 의미그룹(기간·활동 기간…)만 조회하고
 * periodOf 는 date 값을 포맷하지 못해, **새로 만든 수상/자격증은 발행 시 날짜가 통째로 빈다**.
 * (구 레코드는 폐기된 '기간'이 orphan 으로 custom 에 남아 있어 여전히 채워진다 — 신규만 해당.)
 */
describe("FRT-211 단일 날짜 유형의 발행 기간", () => {
  function dateOnlyExp(type: string, key: string, date: string): Experience {
    return makeExp({
      type,
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "전국 대학생 창업 경진대회 대상",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: { [key]: { type: "date", date } },
      } as unknown as Experience["content"],
    });
  }

  it("수상경력은 '수상일'을 발행 기간으로 쓴다", () => {
    expect(experienceToPost(dateOnlyExp("award", "award-info.수상일", "2026-05-20")).period).toBe(
      "2026.05",
    );
  });

  it("자격증은 '취득일'을 발행 기간으로 쓴다", () => {
    expect(
      experienceToPost(dateOnlyExp("certification", "cert-info.취득일", "2025-11-03")).period,
    ).toBe("2025.11");
  });

  it("날짜가 비어 있으면 기간도 빈다 — 없는 값을 지어내지 않는다", () => {
    expect(experienceToPost(dateOnlyExp("award", "award-info.수상일", "")).period).toBe("");
  });

  /**
   * FRT-211 후속(Codex P2) — 수상경력의 역할이 발행에서 사라지던 문제.
   *
   * 확정본은 팀 수상일 때만 '팀에서 내가 맡은 역할'을 보여준다. 이 라벨은 **의도적으로**
   * `SEMANTIC_GROUPS.role` 밖에 있다(templates-v2.ts) — 그룹에 넣으면 `computeFormCards` 가
   * 빈 코어 '내 역할/기여도' 를 항상 dedup 해 **개인 수상에서 역할 칸이 통째로 사라진다.**
   * 그래서 라벨을 옮기는 대신 **발행 쪽에서만** 이 안정키를 폴백으로 읽는다.
   * (화면엔 '데이터 분석 · 발표'가 보이는데 포트폴리오의 '내 역할' 섹션만 통째로 비던 상태)
   */
  it("팀 수상의 '팀에서 내가 맡은 역할'이 발행 기여도로 실린다", () => {
    const exp = makeExp({
      type: "award",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "전국 대학생 데이터 분석 공모전 우수상",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: {
          "award-info.팀에서 내가 맡은 역할": { type: "text", text: "데이터 분석 · 발표" },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).contribution).toBe("데이터 분석 · 발표");
  });

  /**
   * 같은 부류(Codex P2 2라운드) — 수상경력은 확정본이 코어 '핵심 성과'를 빼고(CORE_EXCLUDE)
   * '수상 내용 / 배경' 으로 대체했는데, 그 라벨이 `SEMANTIC_GROUPS.achievement` 밖이라
   * 발행 시 성과가 통째로 버려졌다 — 화면엔 길게 적혀 있는데 포트폴리오만 빈 상태.
   */
  it("수상의 '수상 내용 / 배경'이 발행 성과로 실린다", () => {
    const exp = makeExp({
      type: "award",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "공모전 우수상",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: {
          "award-info.수상 내용 / 배경": { type: "textarea", text: "심야 노선 3개 구간 제안" },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).achievement).toBe("심야 노선 3개 구간 제안");
  });

  it("성과 동의어에 값이 있으면 그쪽이 이긴다", () => {
    const exp = makeExp({
      type: "award",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "공모전 우수상",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: {
          "core.핵심 성과": { type: "textarea", text: "코어 성과" },
          "award-info.수상 내용 / 배경": { type: "textarea", text: "심야 노선 3개 구간 제안" },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).achievement).toBe("코어 성과");
  });

  it("코어 '내 역할/기여도'에 값이 있으면 그쪽이 이긴다 — 폴백은 빈 자리만 채운다", () => {
    const exp = makeExp({
      type: "award",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "수상",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: {
          "core.내 역할/기여도": { type: "textarea", text: "팀장으로 전체 조율" },
          "award-info.팀에서 내가 맡은 역할": { type: "text", text: "데이터 분석 · 발표" },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).contribution).toBe("팀장으로 전체 조율");
  });

  /**
   * 해외경험(FRT-249)도 코어 '기간'을 빼고 확정본 ① 이 자기 '기간'을 갖는다. 수상·자격증과 달리
   * 라벨이 코어와 같은 '기간'이라 범용 폴백만으로도 값이 잡히므로, 이 두 건은 TYPE_PERIOD_KEY
   * 등록의 그물이 아니라 **발행 결과 자체**를 고정한다(등록을 지워도 통과한다 — 회귀 주입으로 확인).
   */
  function overseasExp(fields: Record<string, unknown>): Experience {
    return makeExp({
      type: "overseas",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "베를린 교환학생",
        summary: "요약",
        status: "complete",
        tags: [],
        fields,
      } as unknown as Experience["content"],
    });
  }

  it("해외경험은 확정본 ① 의 '기간'을 발행 기간으로 쓴다", () => {
    const exp = overseasExp({
      "overseas-program.기간": {
        type: "period",
        start: "2024-03",
        end: "2024-08",
        isCurrent: false,
      },
    });

    expect(experienceToPost(exp).period).toBe("2024.03 – 2024.08");
  });

  /**
   * 개편 전 레코드에는 폐기된 `core.기간` 이 orphan 으로 남을 수 있다(코어 기간이 채워진 예외
   * 레코드). 사용자가 화면에서 보고 고치는 값은 확정본 ① 쪽이므로, 발행도 그쪽을 따라야 한다 —
   * 옛 범위가 이기면 화면에서 볼 수도 고칠 수도 없는 기간이 계속 나간다(FRT-211 과 같은 결).
   */
  it("화면에서 못 고치는 orphan 코어 기간보다 확정본 ① 의 '기간'이 앞선다", () => {
    const exp = overseasExp({
      "core.기간": { type: "period", start: "2020-01", end: "2020-02", isCurrent: false },
      "overseas-program.기간": {
        type: "period",
        start: "2024-03",
        end: "2024-08",
        isCurrent: false,
      },
    });

    expect(experienceToPost(exp).period).toBe("2024.03 – 2024.08");
  });

  /** 대조군: 코어 '기간'을 쓰는 유형은 날짜 폴백이 끼어들지 않는다. */
  it("'기간'을 쓰는 유형의 표기는 그대로다", () => {
    expect(experienceToPost(makeExp()).period).toBe("2026.02 – 2026.05");
  });

  /**
   * 폴백은 **유형별 안정키**로만 찾는다. 라벨로 훑으면 다른 유형의 커스텀/레거시 블록에
   * 우연히 같은 이름이 있을 때 무관한 날짜가 발행 기간으로 나간다.
   */
  it("다른 유형에 같은 라벨의 느슨한 블록이 있어도 기간으로 쓰지 않는다", () => {
    const exp = makeExp({
      content: {
        title: "주가 예측 프로젝트",
        summary: "요약",
        status: "complete",
        tags: [],
        coreBlocks: [blk("c1", "text", "경험명", { type: "text", text: "주가 예측 프로젝트" })],
        extensionBlocks: [],
        customBlocks: [blk("x1", "date", "수상일", { type: "date", date: "2026-05-20" })],
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).period).toBe("");
  });

  /**
   * 개편 전에 만든 v2 수상 기록은 폐기된 `core.기간` 이 orphan 으로 custom 에 남는다.
   * 그 값이 `수상일` 을 이기면, 사용자가 화면에서 볼 수도 고칠 수도 없는 옛 범위가 계속
   * 발행되고 **새로 채운 수상일이 반영되지 않는다.** 확정본이 시점으로 정한 쪽이 이겨야 한다.
   */
  it("폐기된 '기간'이 남아 있어도 '수상일'을 먼저 쓴다", () => {
    const exp = makeExp({
      type: "award",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "전국 대학생 창업 경진대회 대상",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: {
          "core.기간": { type: "period", start: "2025-01-01", end: "2025-03-31", isCurrent: false },
          "award-info.수상일": { type: "date", date: "2026-05-20" },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).period).toBe("2026.05");
  });

  /** 다만 수상일이 아직 비어 있으면 옛 기간이라도 보여준다 — 있는 정보를 지우지 않는다. */
  it("'수상일'이 비어 있으면 폐기된 '기간'으로 폴백한다", () => {
    const exp = makeExp({
      type: "award",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "전국 대학생 창업 경진대회 대상",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: {
          "core.기간": { type: "period", start: "2025-01-01", end: "2025-03-31", isCurrent: false },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).period).toBe("2025.01 – 2025.03");
  });

  /** 자격증에 '수상일'까지 섞여 있어도 자기 유형의 키('취득일')를 쓴다. */
  it("자격증은 '수상일'이 섞여 있어도 '취득일'을 쓴다", () => {
    const exp = makeExp({
      type: "certification",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "정보처리기사",
        summary: "요약",
        status: "complete",
        tags: [],
        fields: {
          "cert-info.취득일": { type: "date", date: "2025-11-03" },
          "award-info.수상일": { type: "date", date: "2026-05-20" },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).period).toBe("2025.11");
  });

  /**
   * 드리프트 가드 — 발행 매퍼의 날짜 폴백은 템플릿 안정키를 **문자열로 베껴 적은 것**이라
   * (`withSectionKeys` 가 `${sectionId}.${label}` 로 만든다), 라벨을 바꾸면 조용히 깨진다.
   * 위 테스트들은 같은 문자열을 하드코딩하므로 양쪽이 함께 어긋나도 초록이다 —
   * 여기서만 픽스처 키를 **실제 템플릿에서 뽑아** 쓴다. 라벨이 바뀌면 매퍼가 그 키를 못 찾아
   * 기간이 비고 이 테스트가 먼저 빨개진다. `visibleWhen.key` 일치 가드와 같은 성격이다.
   */
  it.each([
    ["award" as const, "수상일", "2026-05-20", "2026.05"],
    ["certification" as const, "취득일", "2025-11-03", "2025.11"],
  ])("%s 의 날짜 폴백 키가 실제 템플릿 안정키와 일치한다", (type, label, date, expected) => {
    const key = getTemplateForType(type)
      .extensions.flatMap(s => s.blocks)
      .find(b => b.label === label)?.key;
    expect(key).toBeTruthy();
    expect(experienceToPost(dateOnlyExp(type, key as string, date)).period).toBe(expected);
  });

  /**
   * 독서(FRT-236)는 시점을 **단일 날짜가 아니라 period 블록**(`독서 기간`)으로 받는다.
   * 수상/자격증과 상황은 같다 — `CORE_EXCLUDE.reading` 이 코어 '기간'을 빼면서, 개편 전
   * 레코드의 `core.기간` 은 orphan 으로 custom 에 남는다. 그 orphan 은 라벨이 정확히 '기간'
   * 이라 `pickValue` 의 정확-라벨 우선 정렬에서 동의어 '독서 기간' 을 이긴다. 보정이 없으면
   * **화면에서 볼 수도 고칠 수도 없는 옛 범위가 계속 발행된다**(Codex P2).
   */
  describe("독서는 '독서 기간'을 발행 기간으로 쓴다 (FRT-236)", () => {
    function readingExp(fields: Record<string, unknown>): Experience {
      return makeExp({
        type: "reading",
        content: {
          schema_version: SCHEMA_VERSION_V2,
          title: "사피엔스",
          summary: "",
          status: "complete",
          tags: [],
          fields,
        } as unknown as Experience["content"],
      });
    }

    const READ_PERIOD = {
      type: "period",
      start: "2024-03-01",
      end: "2024-05-31",
      isCurrent: false,
    };
    const OLD_CORE_PERIOD = {
      type: "period",
      start: "2019-01-01",
      end: "2019-02-28",
      isCurrent: false,
    };

    it("새로 채운 '독서 기간'이 orphan 된 옛 core '기간'을 이긴다", () => {
      const post = experienceToPost(
        readingExp({
          "core.기간": OLD_CORE_PERIOD,
          "book-info.독서 기간": READ_PERIOD,
        }),
      );
      expect(post.period).toBe("2024.03 – 2024.05");
    });

    it("'독서 기간'이 비면 옛 기간으로 폴백한다 — 있는 정보를 지우지 않는다", () => {
      const post = experienceToPost(readingExp({ "core.기간": OLD_CORE_PERIOD }));
      expect(post.period).toBe("2019.01 – 2019.02");
    });

    /** 드리프트 가드 — 매퍼가 베껴 적은 안정키를 실제 템플릿에서 뽑아 대조한다. */
    it("독서 기간 폴백 키가 실제 템플릿 안정키와 일치한다", () => {
      const key = getTemplateForType("reading")
        .extensions.flatMap(s => s.blocks)
        .find(b => b.label === "독서 기간")?.key;
      expect(key).toBeTruthy();
      expect(experienceToPost(readingExp({ [key as string]: READ_PERIOD })).period).toBe(
        "2024.03 – 2024.05",
      );
    });
  });

  /**
   * 독서의 '한 줄 감상'("이 책을 한 줄로 정리한다면?")은 곧 한 줄 요약이다. 코어 '한 줄 요약'
   * 은 optional 이라 비워 두기 쉬운데, 폴백 목록에 없으면 발행물 요약이 통째로 빈다(Codex P2).
   */
  it("독서는 코어 '한 줄 요약'이 비면 '한 줄 감상'으로 폴백한다 (FRT-236)", () => {
    const exp = makeExp({
      type: "reading",
      content: {
        schema_version: SCHEMA_VERSION_V2,
        title: "사피엔스",
        summary: "",
        status: "complete",
        tags: [],
        fields: {
          "book-info.한 줄 감상": {
            type: "text",
            text: "인류의 역사를 새로운 시각으로 바라보게 해준 책",
          },
        },
      } as unknown as Experience["content"],
    });
    expect(experienceToPost(exp).summary).toBe("인류의 역사를 새로운 시각으로 바라보게 해준 책");
  });

  /**
   * 창작물(FRT-267)도 `CORE_EXCLUDE` 로 코어 '기간'을 빼고 '작업 기간'으로 시점을 받는다.
   * 여기에는 **구 `cw-info.제작 기간` 이라는 두 번째 orphan** 이 더 있다 — 확정본 개편으로 그
   * 키도 화면에서 사라지므로, 새 '작업 기간'이 둘 다 이겨야 한다.
   */
  describe("창작물은 '작업 기간'을 발행 기간으로 쓴다 (FRT-267)", () => {
    function creativeExp(fields: Record<string, unknown>): Experience {
      return makeExp({
        type: "creative-work",
        content: {
          schema_version: SCHEMA_VERSION_V2,
          title: "골목의 기록",
          summary: "",
          status: "complete",
          tags: [],
          fields,
        } as unknown as Experience["content"],
      });
    }

    const WORK_PERIOD = { type: "period", start: "2024-03-01", end: "2024-06-30", isCurrent: false };
    const OLD_CORE_PERIOD = {
      type: "period",
      start: "2019-01-01",
      end: "2019-02-28",
      isCurrent: false,
    };
    const OLD_SECTION_PERIOD = {
      type: "period",
      start: "2020-05-01",
      end: "2020-08-31",
      isCurrent: false,
    };

    it("새로 채운 '작업 기간'이 orphan 된 옛 기간 둘을 모두 이긴다", () => {
      const post = experienceToPost(
        creativeExp({
          "core.기간": OLD_CORE_PERIOD,
          "cw-info.제작 기간": OLD_SECTION_PERIOD,
          "creative-info.작업 기간": WORK_PERIOD,
        }),
      );
      expect(post.period).toBe("2024.03 – 2024.06");
    });

    it("'작업 기간'이 비면 옛 기간으로 폴백한다 — 있는 정보를 지우지 않는다", () => {
      const post = experienceToPost(creativeExp({ "core.기간": OLD_CORE_PERIOD }));
      expect(post.period).toBe("2019.01 – 2019.02");
    });

    /** 드리프트 가드 — 매퍼가 베껴 적은 안정키를 실제 템플릿에서 뽑아 대조한다. */
    it("창작물 기간 폴백 키가 실제 템플릿 안정키와 일치한다", () => {
      const key = getTemplateForType("creative-work")
        .extensions.flatMap(s => s.blocks)
        .find(b => b.label === "작업 기간")?.key;
      expect(key).toBeTruthy();
      expect(experienceToPost(creativeExp({ [key as string]: WORK_PERIOD })).period).toBe(
        "2024.03 – 2024.06",
      );
    });
  });

  /**
   * 봉사(FRT-247)도 `CORE_EXCLUDE` 로 코어 '기간'을 빼고 '활동 기간'으로 시점을 받는다.
   * 독서와 같은 자리에서 같은 함정을 밟는다 — orphan 된 `core.기간` 은 라벨이 정확히 '기간'
   * 이라 `pickValue` 의 정확-라벨 우선 정렬에서 동의어 '활동 기간' 을 이긴다.
   */
  describe("봉사는 '활동 기간'을 발행 기간으로 쓴다 (FRT-247)", () => {
    function volunteerExp(fields: Record<string, unknown>): Experience {
      return makeExp({
        type: "volunteer",
        content: {
          schema_version: SCHEMA_VERSION_V2,
          title: "지역 학습 멘토링",
          summary: "",
          status: "complete",
          tags: [],
          fields,
        } as unknown as Experience["content"],
      });
    }

    const VOL_PERIOD = { type: "period", start: "2024-03-01", end: "2024-12-31", isCurrent: false };
    const OLD_CORE_PERIOD = {
      type: "period",
      start: "2019-01-01",
      end: "2019-02-28",
      isCurrent: false,
    };

    it("새로 채운 '활동 기간'이 orphan 된 옛 core '기간'을 이긴다", () => {
      const post = experienceToPost(
        volunteerExp({
          "core.기간": OLD_CORE_PERIOD,
          "volunteer-info.활동 기간": VOL_PERIOD,
        }),
      );
      expect(post.period).toBe("2024.03 – 2024.12");
    });

    it("'활동 기간'이 비면 옛 기간으로 폴백한다 — 있는 정보를 지우지 않는다", () => {
      const post = experienceToPost(volunteerExp({ "core.기간": OLD_CORE_PERIOD }));
      expect(post.period).toBe("2019.01 – 2019.02");
    });

    /** 드리프트 가드 — 매퍼가 베껴 적은 안정키를 실제 템플릿에서 뽑아 대조한다. */
    it("봉사 기간 폴백 키가 실제 템플릿 안정키와 일치한다", () => {
      const key = getTemplateForType("volunteer")
        .extensions.flatMap(s => s.blocks)
        .find(b => b.label === "활동 기간")?.key;
      expect(key).toBeTruthy();
      expect(experienceToPost(volunteerExp({ [key as string]: VOL_PERIOD })).period).toBe(
        "2024.03 – 2024.12",
      );
    });

    /**
     * `CORE_EXCLUDE.volunteer` 가 코어 '내 역할/기여도' 를 빼도, 확정본 '역할' 이
     * SEMANTIC_GROUPS.role 동의어라 기여도 발행이 비지 않는다.
     */
    it("코어 역할을 빼도 확정본 '역할'이 기여도로 발행된다", () => {
      const post = experienceToPost(
        volunteerExp({ "volunteer-info.역할": { type: "text", text: "학습 멘토" } }),
      );
      expect(post.contribution).toBe("학습 멘토");
    });
  });
});
