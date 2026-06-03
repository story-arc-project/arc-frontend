import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { ANALYSIS_TYPE_FILTERS } from "@/types/analysis";

import FilterBar from "./FilterBar";

const meta: Meta<typeof FilterBar> = {
  title: "Features/Analysis/FilterBar",
  component: FilterBar,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof FilterBar>;

type AnalysisFilterKey = (typeof ANALYSIS_TYPE_FILTERS)[number]["key"];

function AnalysisTypeFilterStory() {
  const [value, setValue] = useState<AnalysisFilterKey>("all");
  return (
    <FilterBar
      options={ANALYSIS_TYPE_FILTERS}
      value={value}
      onChange={(key) => setValue(key)}
      id="analysis-type"
    />
  );
}

function IndividualSelectedStory() {
  const [value, setValue] = useState<AnalysisFilterKey>("individual");
  return (
    <FilterBar
      options={ANALYSIS_TYPE_FILTERS}
      value={value}
      onChange={(key) => setValue(key)}
      id="analysis-type-individual"
    />
  );
}

type StatusKey = "all" | "pending" | "completed" | "updated";

const STATUS_OPTIONS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기 중" },
  { key: "completed", label: "분석 완료" },
  { key: "updated", label: "업데이트됨" },
];

function CustomOptionsStory() {
  const [value, setValue] = useState<StatusKey>("all");
  return (
    <FilterBar
      options={STATUS_OPTIONS}
      value={value}
      onChange={(key) => setValue(key)}
      id="status-filter"
    />
  );
}

export const AnalysisTypeFilter: Story = {
  render: () => <AnalysisTypeFilterStory />,
};

export const IndividualSelected: Story = {
  render: () => <IndividualSelectedStory />,
};

export const CustomOptions: Story = {
  render: () => <CustomOptionsStory />,
};
