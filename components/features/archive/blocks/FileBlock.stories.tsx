import type { Meta, StoryObj } from "@storybook/nextjs"

import FileBlock from "./FileBlock"
import { emptyFileBlock, fileBlock } from "../__fixtures__/archive.fixtures"

const meta: Meta<typeof FileBlock> = {
  title: "Features/Archive/Blocks/FileBlock",
  component: FileBlock,
  parameters: {
    layout: "padded",
  },
  args: {
    onChange: () => {},
  },
}

export default meta

type Story = StoryObj<typeof FileBlock>

/**
 * Empty editable state — shows the file picker dropzone.
 * Kept to the empty/no-fileId state to avoid triggering the
 * getFileUrl() API call that would fail in Storybook.
 */
export const Empty: Story = {
  args: {
    block: emptyFileBlock,
    readOnly: false,
  },
}

/** 라벨 아래 안내문(guide). 문서 확정본이 파일 첨부에도 가이드 문구를 지정한다(FRT-135). */
export const WithGuide: Story = {
  args: {
    block: {
      ...emptyFileBlock,
      label: "강의계획서 첨부",
      guide: "강의계획서(실라버스)를 첨부해주세요. PDF, 이미지, 문서 파일 모두 괜찮아요.",
    },
    readOnly: false,
  },
}

/**
 * 증빙 유형 드롭다운 (FRT-179 자격증). 템플릿이 선택지를 주면 자유 입력 대신 드롭다운이 된다 —
 * 무엇이 증빙이 되는지는 경험 유형마다 다르므로 선택지는 템플릿이 정한다.
 */
export const WithEvidenceTypeOptions: Story = {
  args: {
    block: {
      ...emptyFileBlock,
      label: "증빙 자료",
      options: ["합격증/자격증 사본", "성적표/점수 확인서", "발급 확인서", "기타"],
    },
    readOnly: false,
  },
}

/**
 * ReadOnly view with an attached file shown by name.
 * The fixture has no `fileId`, so FileBlock's getFileUrl() effect early-returns
 * and no backend call is made — the story stays deterministic in Storybook.
 */
export const ReadOnlyWithFile: Story = {
  args: {
    block: fileBlock,
    readOnly: true,
  },
}

export const ReadOnlyEmpty: Story = {
  args: {
    block: emptyFileBlock,
    readOnly: true,
  },
}
