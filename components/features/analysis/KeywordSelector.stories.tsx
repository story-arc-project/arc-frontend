import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

import type { KeywordCategory, KeywordSuggestion } from "@/types/analysis";

import KeywordSelector from "./KeywordSelector";

type SelectedKeyword = { label: string; category: KeywordCategory };

const SAMPLE_SUGGESTIONS: KeywordSuggestion[] = [
  {
    id: "kw-1",
    label: "문제 해결력",
    category: "skill",
    reason: "다양한 프로젝트에서 복잡한 문제를 직접 해결한 경험이 있습니다.",
    relatedExperienceCount: 3,
  },
  {
    id: "kw-2",
    label: "팀워크",
    category: "work_style",
    reason: "여러 팀 프로젝트에서 협업 경험이 풍부합니다.",
    relatedExperienceCount: 5,
  },
  {
    id: "kw-3",
    label: "성장 지향",
    category: "value",
    reason: "지속적으로 새로운 기술을 학습하는 태도가 보입니다.",
    relatedExperienceCount: 2,
  },
  {
    id: "kw-4",
    label: "백엔드 개발",
    category: "job_domain",
    reason: "백엔드 관련 경험이 다수 포함되어 있습니다.",
    relatedExperienceCount: 4,
  },
];

const meta: Meta<typeof KeywordSelector> = {
  title: "Features/Analysis/KeywordSelector",
  component: KeywordSelector,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof KeywordSelector>;

function EmptyStory() {
  const [selected, setSelected] = useState<SelectedKeyword[]>([]);
  return (
    <div className="max-w-lg">
      <KeywordSelector
        suggestions={SAMPLE_SUGGESTIONS}
        selected={selected}
        onChange={setSelected}
        maxCount={3}
      />
    </div>
  );
}

function OneSelectedStory() {
  const [selected, setSelected] = useState<SelectedKeyword[]>([
    { label: "문제 해결력", category: "skill" },
  ]);
  return (
    <div className="max-w-lg">
      <KeywordSelector
        suggestions={SAMPLE_SUGGESTIONS}
        selected={selected}
        onChange={setSelected}
        maxCount={3}
      />
    </div>
  );
}

function AtMaxCountStory() {
  const [selected, setSelected] = useState<SelectedKeyword[]>([
    { label: "문제 해결력", category: "skill" },
    { label: "팀워크", category: "work_style" },
    { label: "성장 지향", category: "value" },
  ]);
  return (
    <div className="max-w-lg">
      <KeywordSelector
        suggestions={SAMPLE_SUGGESTIONS}
        selected={selected}
        onChange={setSelected}
        maxCount={3}
      />
    </div>
  );
}

function NoSuggestionsStory() {
  const [selected, setSelected] = useState<SelectedKeyword[]>([]);
  return (
    <div className="max-w-lg">
      <KeywordSelector
        suggestions={[]}
        selected={selected}
        onChange={setSelected}
        maxCount={3}
      />
    </div>
  );
}

export const Empty: Story = {
  render: () => <EmptyStory />,
};

export const OneSelected: Story = {
  render: () => <OneSelectedStory />,
};

export const AtMaxCount: Story = {
  render: () => <AtMaxCountStory />,
};

export const NoSuggestions: Story = {
  render: () => <NoSuggestionsStory />,
};
