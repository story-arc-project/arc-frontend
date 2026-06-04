import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Chip } from "./chip";

const meta: Meta<typeof Chip> = {
  title: "UI/Chip",
  component: Chip,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    selected: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: {
    children: "칩",
    selected: false,
  },
};

export default meta;

type Story = StoryObj<typeof Chip>;

export const Default: Story = {
  args: { selected: false },
};

export const Selected: Story = {
  args: { selected: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DisabledSelected: Story = {
  args: { selected: true, disabled: true },
};

function ToggleGroupRender() {
  const options = ["React", "TypeScript", "Next.js", "Tailwind"];
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (label: string) => {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <Chip
          key={option}
          selected={selected.includes(option)}
          onClick={() => toggle(option)}
        >
          {option}
        </Chip>
      ))}
    </div>
  );
}

export const ToggleGroup: Story = {
  render: () => <ToggleGroupRender />,
};
