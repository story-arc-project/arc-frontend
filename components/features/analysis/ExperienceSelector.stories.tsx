import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

import type { SelectableExperience } from "@/types/analysis";

import ExperienceSelector from "./ExperienceSelector";

const SAMPLE_EXPERIENCES: SelectableExperience[] = [
  {
    id: "exp-1",
    title: "카카오 백엔드 인턴십",
    type: "인턴",
    importance: 5,
    isComplete: true,
  },
  {
    id: "exp-2",
    title: "교내 개발 동아리 팀장",
    type: "동아리",
    importance: 4,
    isComplete: true,
  },
  {
    id: "exp-3",
    title: "오픈소스 기여 프로젝트",
    type: "프로젝트",
    importance: 3,
    isComplete: true,
  },
  {
    id: "exp-4",
    title: "아직 작성 중인 경험 (미완성)",
    type: "기타",
    importance: 2,
    isComplete: false,
  },
];

const INCOMPLETE_ONLY: SelectableExperience[] = [
  {
    id: "exp-incomplete",
    title: "미완성 경험",
    type: "기타",
    importance: 1,
    isComplete: false,
  },
];

const meta: Meta<typeof ExperienceSelector> = {
  title: "Features/Analysis/ExperienceSelector",
  component: ExperienceSelector,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ExperienceSelector>;

function NoneSelectedStory() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="max-w-md">
      <ExperienceSelector
        experiences={SAMPLE_EXPERIENCES}
        selected={selected}
        onChange={setSelected}
        minCount={2}
      />
    </div>
  );
}

function BelowMinCountStory() {
  const [selected, setSelected] = useState<string[]>(["exp-1"]);
  return (
    <div className="max-w-md">
      <ExperienceSelector
        experiences={SAMPLE_EXPERIENCES}
        selected={selected}
        onChange={setSelected}
        minCount={2}
      />
    </div>
  );
}

function MinCountMetStory() {
  const [selected, setSelected] = useState<string[]>(["exp-1", "exp-2"]);
  return (
    <div className="max-w-md">
      <ExperienceSelector
        experiences={SAMPLE_EXPERIENCES}
        selected={selected}
        onChange={setSelected}
        minCount={2}
      />
    </div>
  );
}

function AllSelectedStory() {
  const [selected, setSelected] = useState<string[]>(["exp-1", "exp-2", "exp-3"]);
  return (
    <div className="max-w-md">
      <ExperienceSelector
        experiences={SAMPLE_EXPERIENCES}
        selected={selected}
        onChange={setSelected}
        minCount={2}
      />
    </div>
  );
}

function NoCompleteExperiencesStory() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="max-w-md">
      <ExperienceSelector
        experiences={INCOMPLETE_ONLY}
        selected={selected}
        onChange={setSelected}
        minCount={2}
      />
    </div>
  );
}

export const NoneSelected: Story = {
  render: () => <NoneSelectedStory />,
};

export const BelowMinCount: Story = {
  render: () => <BelowMinCountStory />,
};

export const MinCountMet: Story = {
  render: () => <MinCountMetStory />,
};

export const AllSelected: Story = {
  render: () => <AllSelectedStory />,
};

export const NoCompleteExperiences: Story = {
  render: () => <NoCompleteExperiencesStory />,
};
