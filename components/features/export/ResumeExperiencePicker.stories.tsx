import type { Meta, StoryObj } from "@storybook/nextjs";

import { ResumeExperiencePicker } from "./ResumeExperiencePicker";
import type { ExperienceTypeId, ExperienceV2 } from "@/types/archive";

const TYPES: ExperienceTypeId[] = [
  "career",
  "academic-society",
  "team-project",
  "volunteer",
  "award",
];

function exp(i: number, title: string, typeId: ExperienceTypeId): ExperienceV2 {
  const day = String(28 - (i % 28)).padStart(2, "0");
  return {
    id: `e${i}`,
    userId: "u1",
    typeId,
    title,
    summary: "",
    status: "complete",
    tags: [],
    coreBlocks: [],
    extensionBlocks: [],
    customBlocks: [],
    hiddenKeys: [],
    createdAt: `2026-06-${day}T00:00:00.000Z`,
    updatedAt: `2026-07-${day}T00:00:00.000Z`,
  };
}

const few: ExperienceV2[] = [
  exp(1, "ARC 프론트엔드 인턴", "career"),
  exp(2, "데이터사이언스 학회 발표", "academic-society"),
  exp(3, "교내 해커톤 팀 프로젝트", "team-project"),
  exp(4, "지역 아동센터 봉사", "volunteer"),
];

const many: ExperienceV2[] = Array.from({ length: 20 }, (_, i) =>
  exp(i + 1, `기록한 경험 ${i + 1}`, TYPES[i % TYPES.length]),
);

const meta: Meta<typeof ResumeExperiencePicker> = {
  title: "Features/Export/ResumeExperiencePicker",
  component: ResumeExperiencePicker,
  parameters: { layout: "padded" },
  args: {
    onToggle: () => {},
    onSelectAll: () => {},
    onClearAll: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ResumeExperiencePicker>;

/** 기본 상태 — 모달을 열면 전부 선택되어 있다(아무것도 안 하면 현행과 결과가 같다). */
export const AllSelected: Story = {
  args: { experiences: few, excludedIds: new Set<string>() },
};

/** 일부를 뺀 상태. 헤더 카운트가 줄고 토글이 '전체 선택'으로 바뀐다. */
export const PartiallyExcluded: Story = {
  args: { experiences: few, excludedIds: new Set(["e2", "e4"]) },
};

/** 전체 해제 — 이 상태에서 모달의 '만들기'는 비활성이다. */
export const NoneSelected: Story = {
  args: { experiences: few, excludedIds: new Set(few.map((e) => e.id)) },
};

/** 경험 20개 — 목록이 자체 스크롤 안에 갇히고 모달이 화면을 넘지 않아야 한다. */
export const ManyExperiences: Story = {
  args: { experiences: many, excludedIds: new Set(["e3"]) },
};

/** 제목이 비었거나 매우 긴 기록 — 말줄임과 '제목 없음' 폴백. */
export const EdgeCaseTitles: Story = {
  args: {
    experiences: [
      { ...exp(1, "", "career") },
      {
        ...exp(2, "제목이 아주 길어서 한 줄에 절대 들어가지 않는 경험 기록의 이름", "team-project"),
      },
    ],
    excludedIds: new Set<string>(),
  },
};
