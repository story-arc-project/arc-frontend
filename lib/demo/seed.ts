// 데모 모드 시드 데이터.
// - 새로고침 시 모듈이 다시 평가되어 자연스럽게 초기화된다.
// - 분석 결과는 기존 lib/api/mocks/analysis.ts 를 그대로 재사용한다.
//
// ⚠️ 저장 형식은 **스키마 v2**(안정키 `fields` 맵)다 — `.claude/rules/archive.md` 의 정본 형식이고,
// 화면(`toExperienceV2`)이 v2 경로로 읽어야 현재 확정본 템플릿 그대로 그려진다. v1(coreBlocks/
// extensionBlocks 배열)로 두면 라벨 매칭 경로를 타서, 확정본에서 라벨이 바뀐 값이 조용히
// '기타' 카드로 밀린다. 실제로 그 상태로 여러 차례의 확정본 정렬을 놓쳤다.
//
// 유형은 **확정본이 반영된 것만** 쓴다. 개인/팀 프로젝트·연구는 아직 확정본 정렬 전이라
// 데모에 두면 "바뀐 입력항목"을 보여줄 수 없다. 프로젝트 성격의 기록은 확정본이 마련해 둔
// 반복 섹션(career-tasks · extra-missions · club-activities)이 받는다.
//
// 값은 `fieldsFor()` 로만 만든다 — 안정키·선택지·표 컬럼을 템플릿에서 직접 읽어 검증하므로,
// 확정본이 또 바뀌면 시드가 조용히 뒤처지지 않고 **모듈 로드 시점에 터진다**(lib/demo/seed.test.ts).

import type { Experience } from "@/types/experience";
import type { LibraryDTO } from "@/lib/utils/library-mapper";
import type { ResumeVersion } from "@/types/resume";
import type { CoverLetterResult } from "@/types/cover-letter";
import type { AuthUser } from "@/types/auth";
import type {
  Block,
  BlockRow,
  BlockValue,
  CellValue,
  ExperienceTypeId,
} from "@/types/archive";
import { SCHEMA_VERSION_V2 } from "@/types/archive";
import { getTemplateForType, TEMPLATE_VERSION } from "@/lib/constants/templates-v2";

const DEMO_USER_ID = "demo-user";

// ─── 안정키 기반 값 빌더 ─────────────────────────────────────
//
// 시드가 손으로 적는 것은 **값**뿐이다. 안정키(`${sectionId}.${label}`)·선택지·표 컬럼은
// 전부 템플릿에서 읽어 온다. 그래서 확정본이 바뀌면 여기서 예외가 나고, 선택지에 없는 값을
// 적으면 그 자리에서 걸린다 — 조용한 빈 칸으로 새어나가지 않는다.

/** 템플릿(코어 + 확장)이 소비하는 안정키 → 블록. */
function templateBlocksByKey(typeId: ExperienceTypeId): Map<string, Block> {
  const tmpl = getTemplateForType(typeId);
  const out = new Map<string, Block>();
  for (const b of tmpl.commonCore.blocks) if (b.key) out.set(b.key, b);
  for (const s of tmpl.extensions) for (const b of s.blocks) if (b.key) out.set(b.key, b);
  return out;
}

type RowSpec = Record<string, CellValue> & { roleTags?: never };
type FullRowSpec = { cells: Record<string, CellValue>; roleTags?: string[] };

/** 시드가 적는 값의 축약 표기. 블록 타입에 맞춰 `materialize` 가 완성한다. */
type FieldSpec =
  | string
  | string[]
  | { start: string; end: string; isCurrent?: boolean }
  | { url: string; title?: string; description?: string; linkType?: string }
  | { fileName: string; description?: string; evidenceType?: string }
  | { rows: (RowSpec | FullRowSpec)[] };

function isRowsSpec(v: FieldSpec): v is { rows: (RowSpec | FullRowSpec)[] } {
  return typeof v === "object" && v !== null && "rows" in v;
}

function toRow(index: number, spec: RowSpec | FullRowSpec, columnKeys: Set<string>, where: string): BlockRow {
  const isFull = "cells" in spec && typeof spec.cells === "object";
  const cells = (isFull ? (spec as FullRowSpec).cells : spec) as Record<string, CellValue>;
  for (const key of Object.keys(cells)) {
    if (!columnKeys.has(key)) {
      throw new Error(`[demo seed] ${where}: 표에 없는 컬럼 "${key}"`);
    }
  }
  const roleTags = isFull ? (spec as FullRowSpec).roleTags : undefined;
  return {
    // 시드는 정적 id 를 쓴다 — uid() 는 호출 순서에 따라 값이 바뀌어 스냅샷이 흔들린다.
    id: `${where.replace(/[^a-zA-Z0-9]+/g, "-")}-r${index + 1}`,
    cells,
    ...(roleTags ? { roleTags } : {}),
  };
}

function materialize(block: Block, spec: FieldSpec, where: string): BlockValue {
  const t = block.value.type;
  switch (t) {
    case "text":
    case "textarea": {
      if (typeof spec !== "string") throw new Error(`[demo seed] ${where}: 문자열이어야 한다`);
      return { type: t, text: spec };
    }
    case "date": {
      if (typeof spec !== "string") throw new Error(`[demo seed] ${where}: 날짜 문자열이어야 한다`);
      return { type: "date", date: spec };
    }
    case "period": {
      if (typeof spec !== "object" || spec === null || !("start" in spec)) {
        throw new Error(`[demo seed] ${where}: {start, end} 여야 한다`);
      }
      return { type: "period", start: spec.start, end: spec.end, isCurrent: spec.isCurrent ?? false };
    }
    case "tags": {
      if (!Array.isArray(spec)) throw new Error(`[demo seed] ${where}: 문자열 배열이어야 한다`);
      return { type: "tags", tags: spec };
    }
    case "single-select": {
      if (typeof spec !== "string") throw new Error(`[demo seed] ${where}: 문자열이어야 한다`);
      const options = block.value.options;
      // 확정본이 선택지를 갈면 여기서 걸린다 — 화면에 없는 값이 드롭다운에 박히는 사고를 막는다.
      if (spec && !options.includes(spec)) {
        throw new Error(`[demo seed] ${where}: 선택지에 없는 값 "${spec}" (가능: ${options.join(" / ")})`);
      }
      return { type: "single-select", options: [...options], selected: spec };
    }
    case "checklist": {
      if (!Array.isArray(spec)) throw new Error(`[demo seed] ${where}: 문자열 배열이어야 한다`);
      const options = block.value.options;
      for (const v of spec) {
        if (!options.includes(v)) {
          throw new Error(`[demo seed] ${where}: 선택지에 없는 값 "${v}"`);
        }
      }
      return { type: "checklist", options: [...options], checked: spec };
    }
    case "link": {
      if (typeof spec !== "object" || spec === null || !("url" in spec)) {
        throw new Error(`[demo seed] ${where}: {url} 이어야 한다`);
      }
      return {
        type: "link",
        url: spec.url,
        title: spec.title ?? "",
        description: spec.description ?? "",
        linkType: spec.linkType ?? "",
      };
    }
    case "file": {
      if (typeof spec !== "object" || spec === null || !("fileName" in spec)) {
        throw new Error(`[demo seed] ${where}: {fileName} 이어야 한다`);
      }
      const options = block.options;
      if (spec.evidenceType && options && !options.includes(spec.evidenceType)) {
        throw new Error(`[demo seed] ${where}: 증빙 유형 선택지에 없는 값 "${spec.evidenceType}"`);
      }
      return {
        type: "file",
        fileName: spec.fileName,
        description: spec.description ?? "",
        evidenceType: spec.evidenceType ?? "",
        // ⚠️ `fileId` 는 넣지 않는다. 데모에는 업로드된 실물이 없는데 FileBlock 은 fileId 가
        // 있으면 마운트 시 `getFileUrl(id)` 로 다운로드 URL 을 받아오려 하고(FileBlock.tsx),
        // 백엔드가 없는 데모에서는 그 요청이 전부 실패해 콘솔이 에러로 찬다.
        // fileId 가 없으면 그 effect 는 `if (!id) return` 으로 빠지고, `isBlockEmpty` 는
        // fileName 만으로도 "첨부 있음"으로 보므로 카드는 그대로 그려진다.
        //
        // 그 대가로 **상세뷰에서 `description` 은 보이지 않는다** — FileBlock 의 readOnly
        // 렌더가 설명을 업로드된 첨부(`hasUploaded`)에만 붙이기 때문이다. 값은 그대로 저장돼
        // 편집 화면에는 뜨고, 백엔드 분석도 content 를 그대로 읽으므로 남겨 둔다.
      };
    }
    case "repeatable-cell": {
      if (!isRowsSpec(spec)) throw new Error(`[demo seed] ${where}: {rows} 여야 한다`);
      const columns = block.value.columns;
      const keys = new Set(columns.map(c => c.key));
      return {
        type: "repeatable-cell",
        // 컬럼은 템플릿 정의를 그대로 복사한다 — 어긋나면 injectValue 가 열 잠금을 풀어
        // 데모에 열 관리 UI 가 노출된다(FRT-104).
        columns: columns.map(c => ({ ...c })),
        rows: spec.rows.map((r, i) => toRow(i, r, keys, where)),
      };
    }
    default:
      throw new Error(`[demo seed] ${where}: 시드가 다루지 않는 블록 타입 ${t}`);
  }
}

/**
 * 유형의 안정키 맵을 만든다. 템플릿에 없는 키를 적으면 즉시 던진다.
 *
 * ⚠️ `core.경험명`·`core.한 줄 요약`은 여기 넣지 않는다 — 그 둘은 `content.title`/`summary`가
 * 소유하고 `toExperienceV2` 가 주입한다(TITLE_KEY/SUMMARY_KEY). 여기 또 넣으면 같은 값이 두 벌이 된다.
 */
function fieldsFor(typeId: ExperienceTypeId, spec: Record<string, FieldSpec>): Record<string, BlockValue> {
  const blocks = templateBlocksByKey(typeId);
  const out: Record<string, BlockValue> = {};
  for (const [key, raw] of Object.entries(spec)) {
    const block = blocks.get(key);
    if (!block) {
      throw new Error(
        `[demo seed] ${typeId}: 템플릿에 없는 안정키 "${key}" — 확정본이 바뀌었는지 확인하세요.`,
      );
    }
    out[key] = materialize(block, raw, `${typeId} · ${key}`);
  }
  return out;
}

/** 모든 유형이 공유하는 발행 옵트인. build-portfolio 가 이 값으로 공개 여부를 가른다. */
const PUBLIC = { "extended.공개 설정": "공개" } as const;

function makeExperience(args: {
  id: string;
  type: ExperienceTypeId;
  importance: number | null;
  title: string;
  summary: string;
  tags: string[];
  status: "draft" | "complete";
  createdAt: string;
  updatedAt: string;
  fields: Record<string, BlockValue>;
}): Experience {
  return {
    id: args.id,
    user_id: DEMO_USER_ID,
    type: args.type,
    importance: args.importance,
    content: {
      schema_version: SCHEMA_VERSION_V2,
      template_version: TEMPLATE_VERSION,
      title: args.title,
      summary: args.summary,
      status: args.status,
      tags: args.tags,
      fields: args.fields,
      custom: [],
    },
    created_at: args.createdAt,
    updated_at: args.updatedAt,
  };
}

// ─── 경험 1: 인턴 (career) — 확정본 3섹션 + 담당 업무 표 ─────

const careerFields = fieldsFor("career", {
  "career-info.회사명": "한양대학교 자연어처리 연구실 (NLP Lab)",
  "career-info.산업 / 회사 종류": ["대학 연구실", "인공지능", "자연어처리"],
  "career-info.부서 / 팀": "한국어 언어모델 연구팀",
  "career-info.직무 / 포지션": "학부 연구생 (연구 인턴)",
  "career-info.근무 기간": { start: "2025-09", end: "2026-02" },
  "career-info.근무 형태": "파트타임",
  "career-info.회사 소개":
    "한국어 사전학습 언어모델과 혐오 표현 탐지를 연구하는 교내 연구실입니다. 교수 1인, 대학원생 3인, 학부 연구생 2인으로 구성되어 주 1회 전체 세미나와 주 2회 소그룹 리뷰를 진행합니다.",
  "career-info.공식 URL": { url: "https://nlp.hanyang.ac.kr", title: "연구실 홈페이지" },

  "career-detail.지원 동기":
    "학부 수업에서 배운 모델을 직접 학습시켜 보고 싶었습니다. 특히 데이터의 품질이 성능을 얼마나 좌우하는지 실제 연구 현장에서 확인하고 싶어 지원했습니다.",
  "career-detail.팀이 진행한 프로젝트 / 업무": {
    rows: [
      { item: "한국어 혐오 표현 탐지 데이터셋 v2 구축" },
      { item: "KLUE-BERT 기반 분류 모델 벤치마크" },
      { item: "학부 연구생 대상 주간 논문 리뷰 세미나 운영" },
    ],
  },
  "career-detail.나의 담당 업무 / 주요 성과": {
    rows: [
      { item: "혐오 표현 레이블링 가이드라인 작성 및 레이블러 간 일치도 관리" },
      { item: "KLUE-BERT 파인튜닝 실험 파이프라인 구성" },
    ],
  },
  "career-detail.성장 / 변화":
    "처음에는 모델을 바꾸면 성능이 오를 거라 생각했는데, 실제로 점수를 끌어올린 것은 경계 사례를 다시 정의한 가이드라인이었습니다. 이후로는 데이터를 먼저 들여다보는 습관이 생겼습니다.",
  "career-detail.사용한 스킬 / 툴 / 기술": [
    "Python",
    "PyTorch",
    "Hugging Face Transformers",
    "KLUE-BERT",
    "scikit-learn",
    "Weights & Biases",
    "Git",
  ],
  "career-detail.협업 / 팀원":
    "지도교수 1인, 대학원생 멘토 1인과 함께 일했습니다. 주 1회 진행 상황을 공유하고, 실험 설계는 멘토와 사전에 합의한 뒤 실행했습니다.",

  "career-tasks.프로젝트/담당 업무": {
    rows: [
      {
        project: "혐오 표현 레이블링 가이드라인 개정",
        role: "가이드라인 작성 · 품질 관리",
        period: "2025.09 ~ 2025.11",
        goal: "레이블러마다 판단이 갈리는 경계 사례를 줄여 데이터셋의 신뢰도를 확보하는 것",
        work: "레이블러 4명의 불일치 사례 320건을 유형별로 모아 6개 패턴으로 분류했고, 각 패턴마다 판단 기준과 예시 문장을 붙여 가이드라인을 개정했습니다. 개정 후 같은 표본으로 재측정했습니다.",
        result:
          "레이블러 간 일치도(Cohen's Kappa)가 0.61에서 0.78로 올랐습니다. 특히 풍자·인용 표현에서 불일치가 가장 크게 줄었습니다.",
        difficulty:
          "'인용된 혐오 표현'을 혐오로 볼지 의견이 갈려 2주간 결론이 나지 않았습니다. 판단을 미루는 대신 두 기준으로 각각 레이블링해 성능 차이를 재고, 그 결과를 근거로 기준을 정했습니다.",
        output: "https://github.com/demo/hate-speech-guideline",
      },
      {
        project: "KLUE-BERT 파인튜닝 실험 파이프라인",
        role: "실험 설계 · 구현",
        period: "2025.11 ~ 2026.01",
        goal: "같은 설정이면 누가 돌려도 같은 결과가 나오도록 실험 환경을 정리하는 것",
        work: "random seed를 고정하고 하이퍼파라미터를 JSON 설정 파일로 분리했습니다. 실행마다 설정과 지표가 자동으로 기록되도록 Weights & Biases를 붙였습니다.",
        result:
          "동일 설정 3회 반복 시 F1 편차가 ±0.004 이내로 줄었습니다. 멘토가 제 실험을 그대로 재현할 수 있게 되면서 리뷰 시간이 절반으로 줄었습니다.",
        difficulty:
          "초기에는 같은 코드인데도 결과가 매번 달라 원인을 찾지 못했습니다. 데이터 로더의 셔플 시드가 따로 놀고 있었다는 걸 로그를 하나씩 대조해 찾아냈습니다.",
        output: "https://github.com/demo/klue-finetune-pipeline",
      },
      {
        project: "주간 논문 리뷰 세미나 발표",
        role: "발표 · 자료 작성",
        period: "2025.10 ~ 2026.02",
        goal: "최신 연구를 팀 전체가 공유하고, 우리 데이터셋에 적용할 지점을 찾는 것",
        work: "5개월간 논문 6편을 맡아 발표했습니다. 매 발표마다 우리 데이터셋에 적용했을 때의 예상 효과를 한 장으로 정리해 붙였습니다.",
        result:
          "제안한 focal loss 적용이 실제 실험으로 이어져, 소수 클래스 F1이 0.52에서 0.61로 올랐습니다.",
        output: "https://github.com/demo/nlp-seminar-notes",
      },
    ],
  },

  "core.기간": { start: "2025-09", end: "2026-02" },
  "core.내 역할/기여도":
    "데이터 품질 관리와 실험 환경 정비를 맡았습니다. 모델 구조를 새로 설계하기보다, 같은 모델에서 더 믿을 수 있는 숫자가 나오게 만드는 일을 담당했습니다.",
  "core.핵심 성과":
    "레이블러 간 일치도 0.61 → 0.78, 반복 실험 F1 편차 ±0.004 이내 확보.",
  "core.증빙 자료": {
    fileName: "연구실_활동확인서.pdf",
    description: "지도교수 확인 학부연구생 활동 확인서",
  },
  ...PUBLIC,
});

// ─── 경험 2: 대외활동 (extracurricular) ─────────────────────

const extracurricularFields = fieldsFor("extracurricular", {
  "extra-info.활동명": "네이버 부스트캠프 AI Tech 6기",
  "extra-info.활동 유형": "스터디 / 학습 모임",
  "extra-info.기수 / 차수": "6기",
  "extra-info.주최": "네이버 커넥트재단",
  "extra-info.주관 / 후원": "네이버 클라우드 플랫폼 지원",
  "extra-info.참여 역할 / 포지션": "CV 트랙 수강생 · 팀 프로젝트 리더",
  "extra-info.활동 기간": { start: "2025-07", end: "2025-11" },
  "extra-info.활동 규모": "100~300명",
  "extra-info.공식 URL": { url: "https://boostcamp.connect.or.kr", title: "부스트캠프 공식 사이트" },

  "extra-detail.지원 동기":
    "혼자 공부할 때는 모델을 돌려보는 데서 멈췄습니다. 같은 문제를 두고 다른 사람의 접근을 보고 싶었고, 5개월간 매일 코드를 쓰는 환경에 저를 두고 싶어 지원했습니다.",
  "extra-detail.활동 내용 요약":
    "5개월간 매일 오전 이론 강의와 오후 실습으로 진행됐고, 후반 2개월은 5인 팀 단위 대회형 프로젝트로 운영됐습니다. CV 트랙에서 이미지 분류·객체 탐지·세그멘테이션을 차례로 다뤘고, 매 대회마다 리더보드 순위와 함께 실험 로그를 제출해야 했습니다.",
  "extra-detail.주요 미션 / 프로젝트": {
    rows: [
      { item: "재활용 쓰레기 객체 탐지 대회 (팀 5인)" },
      { item: "마스크 착용 상태 이미지 분류 대회 (개인)" },
      { item: "실험 관리 자동화 스터디 운영" },
    ],
  },
  "extra-detail.주요 성과": {
    rows: [
      { item: "객체 탐지 대회 참가 21팀 중 4위 (mAP 0.68)" },
      { item: "수료 시 우수 학습자 선정" },
      { item: "팀 실험 기록 템플릿이 다른 두 팀에 채택됨" },
    ],
  },
  "extra-detail.활동 성격": ["🧠 학습 중심", "🤝 팀 협업", "🔥 도전적", "🎯 목표 달성"],

  "extra-missions.미션 / 프로젝트": {
    rows: [
      {
        name: "재활용 쓰레기 객체 탐지 대회",
        type: "팀 미션",
        description:
          "쓰레기 사진에서 10종의 재활용 품목을 찾아내는 객체 탐지 대회입니다. 5인 팀으로 3주간 진행했습니다.",
        work: "팀 리더로 실험 분담과 일정을 관리했고, 저는 앙상블 파트를 맡아 팀원들이 각자 학습시킨 4개 모델을 WBF(Weighted Boxes Fusion)로 결합했습니다. 매일 저녁 실험 결과를 한 장으로 정리해 공유했습니다.",
        result:
          "단일 최고 모델 mAP 0.64 대비 앙상블로 0.68까지 올렸습니다(+4%p). 참가 21팀 중 4위로 마감했습니다.",
        difficulty:
          "팀원마다 실험 기록 방식이 달라 어떤 조합을 이미 돌려봤는지 추적되지 않았습니다. 공용 실험 기록 템플릿을 만들어 매일 같은 형식으로 남기게 했고, 이후 중복 실험이 사라졌습니다.",
        output: "https://github.com/demo/trash-detection",
      },
      {
        name: "마스크 착용 상태 이미지 분류 대회",
        type: "개인 미션",
        description: "얼굴 사진에서 마스크 착용 상태·성별·연령대 18개 클래스를 분류하는 개인 대회입니다.",
        work: "클래스 불균형이 심해 오버샘플링과 focal loss를 각각 적용해 비교했고, 최종적으로 두 기법을 함께 썼습니다.",
        result: "F1 0.71로 마감했습니다. 가장 적었던 클래스의 정확도가 0.38에서 0.66으로 올랐습니다.",
        difficulty:
          "검증 점수는 높은데 리더보드 점수가 낮아 원인을 찾지 못했습니다. 같은 사람의 사진이 학습·검증에 나뉘어 들어간 것이 문제였고, 사람 단위로 데이터를 나눠 해결했습니다.",
      },
    ],
  },

  "core.기간": { start: "2025-07", end: "2025-11" },
  "core.내 역할/기여도":
    "CV 트랙 수강생으로 참여했고, 후반 팀 프로젝트에서는 5인 팀의 리더를 맡아 실험 분담과 기록 체계를 담당했습니다.",
  "core.증빙 자료": {
    fileName: "부스트캠프_수료증.pdf",
    description: "네이버 커넥트재단 발급 수료증",
  },
  ...PUBLIC,
});

// ─── 경험 3: 동아리 (club) — 역할 이력·행별 역할 태그 ───────

const clubFields = fieldsFor("club", {
  "club-info.동아리 / 단체명": "데이터 분석 학회 DataWave",
  "club-info.단체 유형": "학술 / 스터디",
  "club-info.소속 학교": "한양대학교",
  "club-info.학과 / 학부": "컴퓨터소프트웨어학부",
  "club-info.소속 단위": "중앙 동아리",
  "club-info.활동 기간": { start: "2023-03", end: "2025-12" },
  "club-info.역할 / 직책": "학회장 (2025) · 스터디장 (2024) · 정회원 (2023)",
  "club-info.역할 이력": {
    rows: [
      { start: "2023-03", end: "2023-12", role: "정회원" },
      { start: "2024-03", end: "2024-12", role: "스터디장" },
      { start: "2025-03", end: "2025-12", role: "학회장" },
    ],
  },
  "club-info.활동 규모": "30~50명",
  "club-info.공식 URL": { url: "https://datawave.hanyang.ac.kr", title: "DataWave 소개 페이지" },

  "club-detail.가입 동기":
    "데이터를 다루고 싶은데 무엇부터 해야 할지 몰랐습니다. 혼자 강의를 듣다 멈추기를 반복하던 차에, 매주 결과물을 공유해야 하는 환경이 필요하다고 생각해 지원했습니다.",
  "club-detail.동아리 소개":
    "학부생 40여 명이 활동하는 교내 데이터 분석 학회입니다. 학기당 4~6개 스터디를 운영하고, 방학마다 공모전 참가 팀을 꾸립니다. 학기말에는 전체 발표회에서 각 팀의 분석 결과를 공유합니다.",
  "club-detail.주요 활동 / 이벤트": {
    rows: [
      { cells: { item: "SQL 기초 스터디 운영 (2024 봄)" }, roleTags: ["스터디장"] },
      { cells: { item: "2025 신입 학회원 모집 및 온보딩 개편" }, roleTags: ["학회장"] },
      { cells: { item: "학기말 데이터 분석 발표회 기획" }, roleTags: ["학회장", "스터디장"] },
      { cells: { item: "머신러닝 논문 읽기 스터디 참여" }, roleTags: ["정회원"] },
    ],
  },
  "club-detail.주요 성과": {
    rows: [
      { cells: { item: "스터디 중도 이탈률 40% → 12%로 감소" }, roleTags: ["스터디장"] },
      { cells: { item: "신입 학회원 지원자 24명 → 41명" }, roleTags: ["학회장"] },
      { cells: { item: "학회 팀 3곳이 교외 공모전 본선 진출" }, roleTags: ["학회장"] },
    ],
  },
  "club-detail.활동 성격": ["📝 학술 / 스터디", "🤝 협업 기반", "🏛️ 자치 / 대표"].filter(t =>
    // 아래 checklist 검증이 잡아주지만, 목록이 유형마다 달라 눈으로도 구분되게 남겨 둔다.
    ["📝 학술 / 스터디", "🏛️ 자치 / 대표", "💼 창업 / 실무"].includes(t),
  ),

  "club-activities.활동 / 이벤트": {
    rows: [
      {
        role: ["스터디장"],
        name: "SQL 기초 스터디 운영",
        type: "정기 모임 / 스터디",
        detail:
          "데이터 분석이 처음인 학회원 12명을 대상으로 8주간 진행한 SQL 스터디입니다. 매주 실습 과제와 코드 리뷰로 구성했습니다.",
        work: "커리큘럼을 8주로 설계하고 매주 실습 문제를 직접 만들었습니다. 과제를 제출하지 못한 사람에게는 개별로 막힌 지점을 물어 다음 주 문제 난이도를 조정했습니다.",
        result:
          "이전 학기 중도 이탈률 40%에서 12%로 낮췄습니다. 수료자 12명 중 5명이 다음 학기 공모전 팀에 합류했습니다.",
        difficulty:
          "3주차부터 난이도가 급격히 올라 이탈이 몰렸습니다. 과제를 '필수 3문제 + 선택 3문제'로 나눠 최소 진도만 따라와도 완주할 수 있게 바꿨습니다.",
        output: "https://github.com/demo/datawave-sql-study",
      },
      {
        role: ["학회장"],
        name: "2025 신입 학회원 모집 및 온보딩 개편",
        type: "신입 부원 모집",
        detail:
          "학회장으로서 모집 홍보부터 첫 4주 온보딩 과정까지 다시 설계했습니다.",
        work: "기존에는 모집 공고만 올렸는데, 재학생이 실제로 궁금해하는 것을 먼저 물었습니다. 설문 62건을 받아 '무엇을 배우는지 모르겠다'는 응답이 가장 많은 걸 확인하고, 지난 학기 결과물 8개를 정리한 소개 페이지를 만들었습니다.",
        result: "지원자가 24명에서 41명으로 늘었고, 첫 4주 이탈이 9명에서 3명으로 줄었습니다.",
        difficulty:
          "홍보 채널을 늘리자는 의견과 내용을 바꾸자는 의견이 갈렸습니다. 두 학기 지원 경로 데이터를 확인해 유입은 충분한데 지원 전환이 낮다는 걸 보여주고 내용 개편을 먼저 했습니다.",
        output: "https://datawave.hanyang.ac.kr/recruit-2025",
      },
    ],
  },

  "core.기간": { start: "2023-03", end: "2025-12" },
  "core.내 역할/기여도":
    "3년간 정회원 → 스터디장 → 학회장으로 활동했습니다. 마지막 해에는 학회 운영 전반과 신입 온보딩 설계를 맡았습니다.",
  "core.증빙 자료": {
    fileName: "DataWave_임원_활동확인서.pdf",
    description: "학회장 재임 확인서 (2025)",
  },
  ...PUBLIC,
});

// ─── 경험 4: 수상 (award) — 조건부 '팀에서 내가 맡은 역할' ──

const awardFields = fieldsFor("award", {
  "award-info.대회 / 프로그램명": "2025 전국 대학생 데이터 분석 공모전",
  "award-info.대회 유형": "공모전/경진대회",
  "award-info.수상 훈격": "우수상 (2위)",
  "award-info.주최 기관": "한국데이터산업진흥원",
  "award-info.수상일": "2025-11-22",
  "award-info.참가 규모 / 경쟁률": "총 187팀 참가, 본선 12팀 진출 중 2위",
  // '팀 수상' 으로 시작하는 값이라 아래 '팀에서 내가 맡은 역할' 칸이 화면에 나타난다(확정본 §7).
  "award-info.개인 / 팀": "팀 수상 (2~5명)",
  "award-info.팀에서 내가 맡은 역할": "데이터 분석 · 발표",
  "award-info.지원 동기":
    "학회에서 배운 분석을 실제 공공 데이터로 검증해보고 싶었습니다. 심사위원에게 제 결론이 설득되는지 확인하고 싶은 마음도 컸습니다.",
  "award-info.수상 내용 / 배경":
    "대중교통 승하차 데이터와 상권 매출 데이터를 결합해 '심야 버스 노선이 실제로 필요한 구간'을 찾는 분석으로 수상했습니다. 기존 노선 기준과 다른 3개 구간을 제안했고, 심사위원으로부터 근거의 구체성과 정책 적용 가능성에서 높은 평가를 받았습니다.",
  "award-info.상금 / 부상": "상금 300만원 (팀), 데이터산업진흥원장상",

  "award-process.준비 과정":
    "8주간 팀원 3명과 매주 두 번 모였습니다. 앞 4주는 데이터를 모으고 정제하는 데 썼고, 뒤 4주에 가설을 세우고 검증했습니다. 저는 승하차 데이터 전처리와 최종 발표를 맡았습니다.",
  "award-process.기억에 남는 순간 / 배운 점":
    "본선 사흘 전에 우리 분석의 기준 시간대가 잘못 설정된 걸 발견했습니다. 결과를 다시 뽑으니 제안 구간 하나가 바뀌었고, 그대로 발표 자료를 고쳤습니다. 숫자를 의심하는 습관이 그때 생겼습니다.",

  "award-evidence.관련 링크": {
    url: "https://www.kdata.or.kr/news/2025-analysis-contest",
    title: "수상자 발표 공식 페이지",
  },

  "core.증빙 자료": {
    fileName: "데이터분석공모전_상장.pdf",
    description: "한국데이터산업진흥원장상 상장",
    evidenceType: "상장 원본/사본",
  },
  ...PUBLIC,
});

// ─── 경험 5: 창작물 (creative-work) — 최신 확정본(v6) ───────

const creativeFields = fieldsFor("creative-work", {
  "creative-info.작품명 / 작업물명": "서울 심야 이동 인터랙티브 데이터 시각화",
  "creative-info.유형 / 매체": "웹/앱 UI",
  // '개인 작업' 이 아니라서 바로 아래 '역할' 칸이 화면에 나타난다(확정본 §7).
  "creative-info.개인 / 팀": "팀 작업(2~5명)",
  "creative-info.역할": "데이터 처리 · 프론트엔드 구현",
  "creative-info.작업 기간": { start: "2026-03", end: "2026-05" },
  "creative-info.공개 / 전시 이력": {
    rows: [
      { item: "2026 교내 소프트웨어 전시회 출품" },
      { item: "개인 포트폴리오 사이트 공개" },
    ],
  },
  "creative-info.사용 툴 / 기술": ["D3.js", "TypeScript", "Next.js", "Python", "Pandas", "Figma"],
  "creative-info.작품 링크 / 파일": {
    rows: [
      {
        link: "https://demo.story-arc.org/seoul-night",
        desc: "인터랙티브 시각화 (최종 결과물)",
      },
      {
        link: "https://github.com/demo/seoul-night-viz",
        desc: "소스 코드 저장소",
      },
      {
        // 확정본의 '파일' 컬럼은 실제 업로드가 있어야 셀이 채워진 것으로 판정된다
        // (`cellFilled` 는 fileId 로 본다). 데모에는 실물이 없으므로 링크로 남긴다.
        link: "https://demo.story-arc.org/seoul-night/deck",
        desc: "교내 전시회 발표 자료",
      },
    ],
  },

  "creative-detail.작업 배경 / 컨셉":
    "공모전에서 다룬 심야 이동 데이터가 표와 막대그래프 안에만 남는 게 아쉬웠습니다. 사람이 실제로 어디서 어디로 움직이는지 지도 위에서 보이면 다른 이야기가 될 것 같아 시작한 작업입니다.",
  "creative-detail.제작 과정":
    "3주 데이터 정제 → 2주 프로토타입 → 4주 구현 → 1주 사용자 테스트 순으로 진행했습니다. 초기에는 모든 노선을 한 번에 보여줬는데 아무것도 읽히지 않아, 시간대 슬라이더를 넣어 한 번에 한 시점만 보이도록 바꿨습니다. 이 결정이 작업 전체의 방향을 갈랐습니다.",
  "creative-detail.반응 / 피드백":
    "교내 전시회에서 관람객 약 200명이 시연했고, '심야 시간대에 강남–영등포 흐름이 이렇게 뚜렷한 줄 몰랐다'는 반응이 가장 많았습니다. 학과 조교가 다음 학기 시각화 수업 예시 자료로 쓰겠다고 요청했습니다.",
  "creative-detail.이 작업이 나에게 남긴 것":
    "분석과 전달은 다른 일이라는 걸 배웠습니다. 정확한 그래프보다 한 번에 하나만 보여주는 화면이 더 많은 것을 전달했습니다. 이후로는 결과를 낼 때 '누가 어떤 순서로 볼 것인가'를 먼저 생각합니다.",
  "creative-detail.작품 성격": ["🔍 리서치 기반", "🛠️ 기술 중심", "🤝 협업 기반", "🌍 사회적 메시지"],

  // ⚠️ `core.내 역할/기여도` 는 비워 둔다. 창작물 확정본은 '역할'을 자기 필드로 갖고(위),
  // computeFormCards 가 빈 코어만 dedup 한다 — 값을 넣으면 역할 칸이 두 벌로 보인다(FRT-267).
  ...PUBLIC,
});

// ─── 경험 6: 어학 (language) ────────────────────────────────

const languageFields = fieldsFor("language", {
  "lang-overview.언어": "영어",
  "lang-overview.전반적 수준": "중상급(실무 소통·문서 이해)",
  "lang-overview.가능한 활용 영역": [
    "📖 문서 독해",
    "🎓 학술 논문 독해",
    "🎤 발표 / 프레젠테이션",
    "💬 일상 회화",
  ],

  "lang-experience.어학 학습 / 습득 동기":
    "머신러닝 논문이 대부분 영어라 읽는 속도가 곧 공부 속도였습니다. 번역기를 거치면 뉘앙스가 사라져서, 원문으로 읽는 힘을 기르는 걸 목표로 삼았습니다.",
  "lang-experience.주요 경험": {
    rows: [
      { item: "미국 워싱턴대 교환학생 한 학기" },
      { item: "학회 논문 읽기 스터디 5학기 참여" },
      { item: "부스트캠프 영문 기술 문서 번역 공유" },
    ],
  },
  "lang-experience.학습 방법 / 노력":
    "매일 논문 초록 하나를 읽고 세 문장으로 요약하는 습관을 2년간 이어갔습니다. 교환학생 기간에는 수업 발표를 자원해 말하기 기회를 일부러 늘렸습니다.",

  "lang-records.경험 상세 기록": {
    rows: [
      {
        name: "미국 워싱턴대학교 교환학생",
        period: "2024.08 ~ 2024.12",
        activities: ["💬 일상 회화", "🎤 발표 / 프레젠테이션", "📖 문서 독해"],
        summary:
          "한 학기 동안 데이터 과학 전공 수업 3개를 들으며 현지 학생들과 팀 과제를 진행했고, 학기말 팀 발표에서 결과 해석 파트를 영어로 맡았습니다.",
        moment:
          "발표 후 교수님이 '질문에 답할 때 근거를 먼저 말하는 게 좋았다'고 하셨습니다. 영어가 유창해서가 아니라 구조가 분명해서 전달됐다는 걸 그때 알았습니다.",
      },
      {
        name: "머신러닝 논문 읽기 스터디",
        period: "2023.03 ~ 2025.06",
        activities: ["🎓 학술 논문 독해", "🎤 발표 / 프레젠테이션"],
        summary:
          "학회 스터디에서 5학기 동안 매주 논문 한 편을 읽고 돌아가며 발표했습니다. 제가 맡은 발표는 총 18회였습니다.",
        moment:
          "처음에는 한 편을 읽는 데 사흘이 걸렸는데, 마지막 학기에는 초록과 그림만으로 핵심을 잡고 두 시간이면 정리할 수 있게 됐습니다.",
      },
    ],
  },

  "lang-certificate.시험 / 자격증명": "TOEIC",
  "lang-certificate.점수 / 등급": "875점",
  "lang-certificate.취득일": "2024-09-08",
  "lang-certificate.유효기간": "2026-09-08",
  "lang-certificate.성적표 첨부": {
    fileName: "TOEIC_성적표.pdf",
    description: "2024년 9월 정기시험 성적표",
    evidenceType: "성적표/점수 확인서",
  },
  ...PUBLIC,
});

// ─── 경험 7: 해외경험 (overseas) ────────────────────────────

const overseasFields = fieldsFor("overseas", {
  "overseas-program.경험 유형": "교환학생",
  "overseas-program.국가 / 도시": "미국 시애틀",
  "overseas-program.주최 / 소속 기관": "University of Washington (한양대학교 교환학생 프로그램)",
  "overseas-program.기간": { start: "2024-08", end: "2024-12" },
  "overseas-program.사용 언어": "영어",
  "overseas-program.참여 형태": "혼자",
  "overseas-program.증빙 자료": {
    fileName: "교환학생_수료증.pdf",
    description: "University of Washington 수학 증명서",
    evidenceType: "수료증/참가 확인서",
  },

  "overseas-reflection.주요 활동": {
    rows: [
      { item: "데이터 과학 전공 수업 3개 수강" },
      { item: "현지 학생 4인 팀 과제 및 학기말 발표" },
      { item: "교내 데이터 사이언스 클럽 세미나 참여" },
    ],
  },
  "overseas-reflection.이 경험이 나에게 준 것": [
    "🗣️ 언어 능력 향상",
    "🎓 학문적 시야 확장",
    "💪 독립성/자립심",
    "🧭 새로운 관점",
  ],
  "overseas-reflection.기억에 남는 순간":
    "팀 과제에서 한 학생이 제 결론에 '데이터를 어떻게 나눴는지 먼저 보여달라'고 했습니다. 결론보다 과정을 먼저 검증하는 태도가 낯설었는데, 돌아온 뒤 제 발표 순서를 그렇게 바꿨습니다.",

  "overseas-activities.활동별 상세 설명": {
    rows: [
      {
        activity: "데이터 과학 전공 수업 3개 수강",
        detail:
          "Statistical Learning, Data Visualization, Database Systems 세 과목을 들었습니다. 매주 과제가 코드와 짧은 리포트로 나왔고, 결과보다 판단 근거를 적는 데 배점이 컸습니다.",
      },
      {
        activity: "현지 학생 4인 팀 과제 및 학기말 발표",
        detail:
          "시애틀 자전거 통행량 데이터로 기상 조건과 통행량의 관계를 분석했습니다. 저는 데이터 정제와 결과 해석 파트를 맡았고, 발표에서 해석 부분을 담당했습니다.",
      },
    ],
  },
  ...PUBLIC,
});

// ─── 경험 8: 자격증 (certification) — 반복 섹션 없는 확정본 ──

const certificationFields = fieldsFor("certification", {
  "cert-info.자격증명": "SQL 개발자 (SQLD)",
  "cert-info.자격증 분야": "데이터/AI",
  "cert-info.등급/급수": "개발자 등급",
  "cert-info.발급 기관": "한국데이터산업진흥원",
  "cert-info.취득일": "2025-04-11",

  "cert-background.취득 동기":
    "학회 스터디에서 SQL을 쓰긴 했지만 제가 아는 범위가 어디까지인지 알 수 없었습니다. 기준이 있는 시험으로 한 번 정리하고 싶어 준비했습니다.",
  "cert-background.준비 기간/방법":
    "6주간 준비했습니다. 앞 3주는 이론을 훑고, 뒤 3주는 기출 8회분을 반복해 풀었습니다. 특히 계층형 질의와 윈도우 함수가 약해 따로 문제를 모아 다시 봤습니다.",
  "cert-background.활용 계획":
    "데이터 분석 직무 지원 시 기본기 증빙으로 쓰고, 다음 단계로 SQLP와 ADsP를 이어서 준비할 계획입니다.",

  "core.증빙 자료": {
    fileName: "SQLD_자격증.pdf",
    description: "한국데이터산업진흥원 발급 자격증 사본",
    evidenceType: "합격증/자격증 사본",
  },
  ...PUBLIC,
});

// ─── 시드 경험 목록 ─────────────────────────────────────────

export const seedExperiences: Experience[] = [
  makeExperience({
    id: "exp-demo-career",
    type: "career",
    importance: 5,
    title: "자연어처리 연구실 학부 연구생",
    summary:
      "한국어 혐오 표현 데이터셋의 레이블링 기준을 다시 세우고, 재현 가능한 파인튜닝 실험 환경을 만들었어요.",
    tags: ["자연어처리", "데이터품질", "실험재현성", "인턴"],
    status: "complete",
    createdAt: "2026-02-20T09:00:00Z",
    updatedAt: "2026-05-08T14:00:00Z",
    fields: careerFields,
  }),
  makeExperience({
    id: "exp-demo-extracurricular",
    type: "extracurricular",
    importance: 4,
    title: "네이버 부스트캠프 AI Tech 6기",
    summary:
      "5개월간 CV 트랙을 수료하고, 5인 팀 리더로 객체 탐지 대회에서 앙상블로 성능을 4%p 끌어올렸어요.",
    tags: ["컴퓨터비전", "팀리딩", "대회", "부스트캠프"],
    status: "complete",
    createdAt: "2025-11-30T09:00:00Z",
    updatedAt: "2026-04-12T10:00:00Z",
    fields: extracurricularFields,
  }),
  makeExperience({
    id: "exp-demo-club",
    type: "club",
    importance: 4,
    title: "데이터 분석 학회 DataWave",
    summary:
      "정회원에서 학회장까지 3년간 활동하며 스터디 이탈률을 낮추고 신입 온보딩을 다시 설계했어요.",
    tags: ["학회", "리더십", "스터디운영", "데이터분석"],
    status: "complete",
    createdAt: "2025-12-20T09:00:00Z",
    updatedAt: "2026-03-02T11:00:00Z",
    fields: clubFields,
  }),
  makeExperience({
    id: "exp-demo-award",
    type: "award",
    importance: 5,
    title: "전국 대학생 데이터 분석 공모전 우수상",
    summary:
      "대중교통·상권 데이터를 결합해 심야 버스 노선이 실제로 필요한 구간 3곳을 제안해 187팀 중 2위를 했어요.",
    tags: ["공모전", "공공데이터", "수상", "발표"],
    status: "complete",
    createdAt: "2025-11-25T09:00:00Z",
    updatedAt: "2026-01-15T09:00:00Z",
    fields: awardFields,
  }),
  makeExperience({
    id: "exp-demo-creative",
    type: "creative-work",
    importance: 3,
    title: "서울 심야 이동 인터랙티브 데이터 시각화",
    summary:
      "공모전에서 다룬 심야 이동 데이터를 지도 위 인터랙티브 시각화로 다시 만들어 전시했어요.",
    tags: ["데이터시각화", "D3", "전시", "프론트엔드"],
    status: "complete",
    createdAt: "2026-05-20T09:00:00Z",
    updatedAt: "2026-06-01T09:00:00Z",
    fields: creativeFields,
  }),
  makeExperience({
    id: "exp-demo-language",
    type: "language",
    importance: 3,
    title: "영어 — 논문 독해와 실무 소통",
    summary:
      "논문 원문 독해를 목표로 2년간 매일 요약 습관을 이어갔고, 교환학생 기간에 발표로 말하기를 늘렸어요.",
    tags: ["영어", "TOEIC", "논문독해", "발표"],
    status: "complete",
    createdAt: "2025-01-10T09:00:00Z",
    updatedAt: "2026-02-01T09:00:00Z",
    fields: languageFields,
  }),
  makeExperience({
    id: "exp-demo-overseas",
    type: "overseas",
    importance: 4,
    title: "미국 워싱턴대학교 교환학생",
    summary:
      "한 학기 동안 데이터 과학 수업을 듣고, 결론보다 과정을 먼저 검증하는 태도를 배워 왔어요.",
    tags: ["교환학생", "미국", "데이터과학", "협업"],
    status: "complete",
    createdAt: "2024-12-20T09:00:00Z",
    updatedAt: "2025-06-10T09:00:00Z",
    fields: overseasFields,
  }),
  makeExperience({
    id: "exp-demo-certification",
    type: "certification",
    importance: 2,
    title: "SQL 개발자 (SQLD)",
    summary: "스터디에서 쓰던 SQL 지식의 범위를 기준이 있는 시험으로 한 번 정리했어요.",
    tags: ["SQL", "자격증", "데이터"],
    status: "complete",
    createdAt: "2025-04-15T09:00:00Z",
    updatedAt: "2025-04-15T09:00:00Z",
    fields: certificationFields,
  }),
];

export const seedLibraries: LibraryDTO[] = [
  {
    id: "demo-lib-ai",
    name: "AI · 데이터",
    color: "#8B5CF6",
    icon: undefined,
    is_system: false,
    filter: null,
  },
  {
    id: "demo-lib-dev",
    name: "커뮤니티 · 글로벌",
    color: "#3B82F6",
    icon: undefined,
    is_system: false,
    filter: null,
  },
];

// 라이브러리별 멤버십 초기 상태
export const seedLibraryMembership: Record<string, string[]> = {
  "demo-lib-ai": [
    "exp-demo-career",
    "exp-demo-extracurricular",
    "exp-demo-award",
    "exp-demo-creative",
    "exp-demo-certification",
  ],
  "demo-lib-dev": ["exp-demo-club", "exp-demo-language", "exp-demo-overseas"],
};

export const seedDemoUser: AuthUser = {
  account: {
    email: "demo@story-arc.org",
    has_password: true,
    email_verified: true,
    connected_oauth: [],
  },
  profile: {
    name: "김서윤",
    birth: "2002-03-15",
    phone: "",
    affiliation: "student",
    school: "한양대학교",
    department: "컴퓨터소프트웨어학부",
    worry: [],
    interest: ["AI/ML", "데이터분석", "자연어처리", "데이터 시각화"],
  },
  onboarded: true,
};

const DEMO_RESUME_ID = "demo-resume-1";

export const seedResume: ResumeVersion = {
  version_id: DEMO_RESUME_ID,
  meta: {
    language: "ko",
    format: "json",
    generated_at: "2026-06-08T15:00:00Z",
    source_chars: 6480,
  },
  인적사항: {
    이름: "김서윤",
    영문명: "Seo-yun Kim",
    생년월일: "2002-03-15",
    이메일: "seo-yun.kim@hanyang.ac.kr",
    전화번호: null,
    주소: null,
    링크: [
      { label: "GitHub", url: "https://github.com/demo" },
      { label: "Portfolio", url: "https://demo.story-arc.org" },
    ],
  },
  학력: [
    {
      id: 1,
      학교명: "한양대학교",
      학과: "컴퓨터소프트웨어학부",
      전공구분: "주전공",
      학위: "학사",
      입학년월: "2021-03",
      졸업년월: "2026-08",
      졸업구분: "졸업예정",
      학점: 3.72,
      만점: 4.5,
      비고: "2024년 2학기 University of Washington 교환학생",
    },
  ],
  경력: [
    {
      id: 1,
      회사명: "한양대학교 자연어처리 연구실 (NLP Lab)",
      부서: "한국어 언어모델 연구팀",
      직위: "학부 연구생",
      고용형태: "인턴",
      입사년월: "2025-09",
      퇴사년월: "2026-02",
      재직중: false,
      담당업무: [
        "한국어 혐오 표현 레이블링 가이드라인 개정 및 데이터 품질 관리",
        "KLUE-BERT 기반 파인튜닝 실험 파이프라인 구성",
        "주간 논문 리뷰 세미나 발표 6회",
      ],
      성과: [
        "레이블러 간 일치도(Cohen's Kappa) 0.61 → 0.78 개선",
        "동일 설정 반복 실험 F1 편차 ±0.004 이내 확보",
        "focal loss 제안 반영으로 소수 클래스 F1 0.52 → 0.61",
      ],
    },
  ],
  자격증: [
    {
      id: 1,
      자격증명: "SQL 개발자 (SQLD)",
      발급기관: "한국데이터산업진흥원",
      취득년월: "2025-04",
      자격구분: "국가공인",
    },
  ],
  어학: [
    {
      id: 1,
      언어: "영어",
      시험명: "TOEIC",
      점수등급: "875",
      취득년월: "2024-09",
    },
  ],
  대외활동: [
    {
      id: 1,
      활동명: "네이버 부스트캠프 AI Tech 6기",
      기관: "네이버 커넥트재단",
      기간_시작: "2025-07-01",
      기간_종료: "2025-11-30",
      기간_원문: "2025.07 - 2025.11",
      진행중: false,
      역할: "CV 트랙 수강생 · 팀 프로젝트 리더",
      활동내용: [
        "PyTorch 기반 학습 파이프라인 구축 및 객체 탐지 모델 비교 실험",
        "5인 팀 리더로 실험 분담 및 공용 실험 기록 체계 운영",
      ],
      성과: [
        "객체 탐지 대회 참가 21팀 중 4위 (mAP 0.68)",
        "WBF 앙상블로 단일 최고 모델 대비 mAP 4%p 향상",
        "수료 시 우수 학습자 선정",
      ],
    },
  ],
  프로젝트: [
    {
      id: 1,
      프로젝트명: "심야 대중교통 수요 분석 (전국 대학생 데이터 분석 공모전)",
      소속기관: "한국데이터산업진흥원 공모전 · 4인 팀",
      기간_시작: "2025-09",
      기간_종료: "2025-11",
      기간_원문: "2025.09 - 2025.11",
      역할: "데이터 분석 · 발표",
      사용기술: ["Python", "Pandas", "PostgreSQL", "GeoPandas", "Matplotlib"],
      내용: [
        "대중교통 승하차 데이터와 상권 매출 데이터 결합 및 정제",
        "시간대·구간별 수요 밀도 분석으로 심야 노선 후보 구간 도출",
        "본선 발표 자료 작성 및 발표 담당",
      ],
      성과: [
        "기존 노선 기준과 다른 3개 구간 제안, 187팀 중 우수상(2위)",
        "본선 3일 전 기준 시간대 오류를 발견해 결과 재산출",
      ],
    },
    {
      id: 2,
      프로젝트명: "서울 심야 이동 인터랙티브 데이터 시각화",
      소속기관: "팀 작업 (3인) · 교내 전시 출품",
      기간_시작: "2026-03",
      기간_종료: "2026-05",
      기간_원문: "2026.03 - 2026.05",
      역할: "데이터 처리 · 프론트엔드 구현",
      사용기술: ["D3.js", "TypeScript", "Next.js", "Python", "Pandas"],
      내용: [
        "심야 이동 데이터를 지도 기반 인터랙티브 시각화로 재구성",
        "시간대 슬라이더 도입으로 한 시점만 보이도록 정보량 조절",
      ],
      성과: [
        "교내 소프트웨어 전시회 출품, 관람객 약 200명 시연",
        "학과 시각화 수업 예시 자료로 채택",
      ],
    },
    {
      id: 3,
      프로젝트명: "재활용 쓰레기 객체 탐지 대회",
      소속기관: "네이버 부스트캠프 AI Tech · 5인 팀",
      기간_시작: "2025-10",
      기간_종료: "2025-11",
      기간_원문: "2025.10 - 2025.11",
      역할: "팀 리더 · 앙상블 담당",
      사용기술: ["PyTorch", "MMDetection", "Weights & Biases"],
      내용: [
        "팀원 4명의 개별 모델을 WBF(Weighted Boxes Fusion)로 결합",
        "공용 실험 기록 템플릿 도입으로 중복 실험 제거",
      ],
      성과: ["단일 최고 모델 mAP 0.64 → 앙상블 0.68 (+4%p)", "참가 21팀 중 4위"],
    },
  ],
  수상: [
    {
      id: 1,
      수상명: "우수상 (2위)",
      수여기관: "한국데이터산업진흥원",
      수상년월: "2025-11",
      내용: "2025 전국 대학생 데이터 분석 공모전 — 187팀 참가, 본선 12팀 중 2위",
    },
  ],
  기술및역량: {
    기술스택: ["Python", "PyTorch", "SQL", "TypeScript", "D3.js"],
    툴: ["Git", "Weights & Biases", "PostgreSQL", "Jupyter", "Figma"],
    소프트스킬: ["문제 해결", "데이터 기반 의사결정", "팀 운영", "자기주도성"],
  },
  동아리_학회: [
    {
      id: 1,
      단체명: "데이터 분석 학회 DataWave",
      구분: "교내학회",
      기간_원문: "2023.03 - 2025.12",
      역할: "학회장 (2025) · 스터디장 (2024) · 정회원 (2023)",
      활동내용: [
        "SQL 기초 스터디 8주 커리큘럼 설계 및 운영",
        "2025 신입 학회원 모집·온보딩 과정 개편",
      ],
    },
  ],
  연계성: [],
  자기소개_요약:
    "데이터의 품질과 전달 방식이 결론을 바꾼다고 믿는 학생입니다. 연구실에서는 레이블링 기준을 다시 세워 데이터 신뢰도를 끌어올렸고, 공모전과 시각화 작업에서는 같은 데이터를 어떻게 보여주느냐가 설득을 가른다는 것을 배웠습니다.",
  파싱경고: [],
};

export const seedResumeListItem = {
  version_id: DEMO_RESUME_ID,
  created_at: seedResume.meta.generated_at,
  updated_at: seedResume.meta.generated_at,
};

export const DEMO_RESUME_VERSION_ID = DEMO_RESUME_ID;

// ─── Cover letter (FRT-140) ─────────────────────────────────
//
// 백엔드(BAC-62)가 아직 없어 데모가 유일한 "걸어볼 수 있는" 경로다. 그래서 시드는
// 잘 된 결과만 보여주지 않는다 — **근거 없는 주장이 섞인 초안**을 일부러 넣어,
// 이 기능의 핵심인 경고·하이라이트가 실제로 보이게 한다.

const DEMO_COVER_LETTER_ID = "demo-cover-letter-1";

export const seedCoverLetter: CoverLetterResult = {
  version_id: DEMO_COVER_LETTER_ID,
  created_at: "2026-07-24T01:00:00.000Z",
  meta: {
    job_key: "data",
    job_label: "데이터 분석/사이언스",
    region: "KR",
    num_questions: 2,
    num_style_examples: 3,
    company_research_used: true,
    all_grounded: false,
  },
  company_research:
    "고객의 신뢰를 최우선 가치로 두고, 자율과 책임을 함께 강조하는 문화를 지향합니다. 데이터 기반 의사결정을 조직 전반의 기본기로 삼습니다.",
  action_plan:
    "단기(3개월): SQL 윈도우 함수·실험 설계 복습\n중기(6개월): 도메인 지표 정의 경험 쌓기\n장기(1년): 데이터 프로덕트 기획까지 범위 넓히기",
  answers: [
    {
      question: "지원 동기와 본인의 강점을 서술하시오. (1,000자 이내)",
      max_chars: 1000,
      cover_letter:
        "데이터로 문제를 좁혀 가는 일에 가장 큰 동기를 느낍니다.\n\n학부 2학년 때 교내 데이터 분석 학회에 들어가면서 데이터를 다루기 시작했습니다. 처음에는 스터디를 따라가는 것도 벅찼지만, 이듬해 스터디장을 맡아 커리큘럼을 직접 설계하면서 중도 이탈률을 40%에서 12%로 낮췄습니다. 그때 '사람이 어디서 막히는지 먼저 물어야 한다'는 것을 배웠습니다.\n\n연구실에서는 모델보다 데이터가 결과를 좌우한다는 것을 확인했습니다. 5년간 대기업 데이터 조직에서 쌓은 실무 감각을 바탕으로 레이블링 기준을 다시 세웠고, 레이블러 간 일치도를 0.61에서 0.78까지 끌어올렸습니다.\n\n귀사가 데이터를 조직의 기본기로 삼는다는 점에 끌렸습니다. 숫자로 확인하고 설득하는 방식으로 기여하고 싶습니다.",
      grounding: {
        grounded: false,
        // 첫 번째는 본문에 그대로 있어 하이라이트되고, 두 번째는 없어 배너에만 뜬다 —
        // 두 경로를 한 화면에서 확인할 수 있게 일부러 섞었다.
        // ⚠️ 둘 다 **시드 경험에 근거가 없어야** 이 예시가 성립한다. 경험을 고칠 때
        // 이 문장들이 우연히 사실이 되지 않는지 함께 확인할 것.
        unsupported_claims: [
          "5년간 대기업 데이터 조직에서 쌓은 실무 감각",
          "사내 추천 시스템을 직접 운영해 매출을 개선했습니다",
        ],
        notes: "기록에서 근거를 찾지 못한 주장 2건 (교정 반복 2회)",
      },
      writing_guide:
        "전략\n두괄식으로 시작해 첫 문장에서 동기를 분명히 밝히세요.\n\n문단별 해설\n1문단 — 결론부터. 2문단 — 계기를 사실로. 3문단 — 성과를 숫자로.\n\n보완 포인트\n정량 성과(줄인 시간, 개선한 지표)를 기록에 남겨 두면 다음 초안이 더 단단해집니다.\n\n예상 면접 질문\n1. 스터디 이탈률을 낮추기 위해 구체적으로 무엇을 바꿨나요?\n2. 레이블링 기준을 어떤 근거로 개정했나요?\n3. 팀에서 의견이 갈렸을 때 어떻게 결정했나요?",
    },
    {
      question: "입사 후 이루고 싶은 목표를 서술하시오. (500자 이내)",
      max_chars: 500,
      cover_letter:
        "데이터가 의사결정에 실제로 쓰이게 만드는 사람이 되고 싶습니다.\n\n분석이 보고서로 끝나면 조직은 바뀌지 않습니다. 지표를 정의하고, 그 지표를 팀이 매일 보게 만드는 일까지가 분석이라고 생각합니다. 먼저 도메인을 익혀 숫자의 맥락을 이해하고, 이후에는 제가 정의한 지표로 팀의 판단이 빨라지는 데까지 기여하고 싶습니다.",
      grounding: {
        grounded: true,
        unsupported_claims: [],
        notes: "검증 통과 (교정 반복 0회)",
      },
      writing_guide:
        "전략\n목표를 회사의 맥락과 연결하세요.\n\n체크리스트\n- 직무와 목표가 이어지는가\n- 추상적 다짐 대신 할 일이 보이는가",
    },
  ],
};

export const seedCoverLetterListItem = {
  id: DEMO_COVER_LETTER_ID,
  created_at: seedCoverLetter.created_at ?? "2026-07-24T01:00:00.000Z",
  updated_at: seedCoverLetter.created_at ?? "2026-07-24T01:00:00.000Z",
  title: "토스 · 데이터 분석 자기소개서",
  status: "completed" as const,
};

export const DEMO_COVER_LETTER_VERSION_ID = DEMO_COVER_LETTER_ID;
