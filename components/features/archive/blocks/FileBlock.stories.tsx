import type { Meta, StoryObj } from "@storybook/nextjs"
import { expect, userEvent, within } from "storybook/test"

import { http, HttpResponse } from "msw"

import FileBlock from "./FileBlock"
import {
  emptyFileBlock,
  fileBlock,
  longFileName,
  longUnbrokenFileName,
} from "../__fixtures__/archive.fixtures"

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

/**
 * FRT-318: 아주 긴 파일명을 붙여도 블록이 부모 폭 안에 머문다.
 *
 * 파일명 자체는 `GenericFileCard` 가 이미 말줄임으로 자르지만, 그것만으로는 부족했다 —
 * `fieldset` 은 UA 스타일이 `min-inline-size: min-content` 라 부모보다 넓어질 수 있고,
 * 그러면 잘린 파일 행뿐 아니라 그 아래 설명·증빙 유형 칸까지 통째로 카드 밖으로 밀려난다.
 * 넘침은 레이아웃 결과라 jsdom 으로는 잴 수 없어 실브라우저인 여기서 폭으로 단언한다.
 */
function expectWithinParent(canvasElement: HTMLElement, testId: string) {
  const container = canvasElement.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  expect(container).not.toBeNull()
  // 컨테이너보다 넓은 자손이 있으면 그만큼 스크롤 폭이 생긴다(넘침 여부는 overflow 설정과 무관).
  expect(container!.scrollWidth).toBeLessThanOrEqual(container!.clientWidth)
}

const overflowProbe = (testId: string): NonNullable<Story["play"]> =>
  async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 파일명만 기다리면 **너무 이르다** — `getFileUrl` 이 아직이면 URL 없는 카드가 먼저 그려지고
    // 그 이름은 두 상태에 다 있다. 그 사이에 재면 '열기'(고정폭)가 빠진 좁은 카드를 재게 되어,
    // 느린 CI 에서는 진짜 넘치는 최종 레이아웃을 건드리지 않고도 통과한다.
    // 링크가 붙은 뒤가 이 블록이 가장 넓어지는 상태다.
    await canvas.findByRole("link", { name: `${longFileName} 열기` })

    expectWithinParent(canvasElement, testId)
  }

export const LongFileName: Story = {
  decorators: [
    Story => (
      <div data-testid="frt318-block-container" className="w-[545px]">
        <Story />
      </div>
    ),
  ],
  args: {
    block: {
      ...fileBlock,
      label: "증빙 자료",
      value: {
        type: "file",
        fileName: longFileName,
        // 실제 첨부와 같은 경로를 태운다 — fileId 가 있어야 미리보기 카드가 그려진다
        // (다운로드 URL 은 MSW 의 `*/files/:id/download` 핸들러가 준다).
        fileId: "file-frt318",
        mimeType: "application/pdf",
        size: 45_000_000,
        description: "",
        evidenceType: "",
      },
    },
    readOnly: false,
  },
  play: overflowProbe("frt318-block-container"),
}

/** 상세뷰(readOnly)도 같은 파일 행을 그린다 — 여기서도 카드 밖으로 나가지 않는다. */
export const ReadOnlyLongFileName: Story = {
  decorators: [
    Story => (
      <div data-testid="frt318-readonly-container" className="w-[545px]">
        <Story />
      </div>
    ),
  ],
  args: {
    block: {
      ...fileBlock,
      label: "증빙 자료",
      value: {
        type: "file",
        fileName: longFileName,
        fileId: "file-frt318-ro",
        mimeType: "application/pdf",
        size: 45_000_000,
        description: "",
        evidenceType: "",
      },
    },
    readOnly: true,
  },
  play: overflowProbe("frt318-readonly-container"),
}

/**
 * 업로드 실물 없이 **이름만** 남은 첨부의 상세뷰 (FRT-318 리뷰 지적).
 *
 * `fileId` 가 없으면 파일 카드가 아니라 클립 아이콘 + 파일명 한 줄로 그려진다.
 * 데모 시드(`lib/demo/seed.ts`)가 의도적으로 `fileId` 를 비우므로 살아 있는 경로다.
 * 끊을 자리가 없는 이름을 넣어 그 줄에 자를 장치가 있는지 가른다.
 */
export const ReadOnlyNameOnlyLongFileName: Story = {
  decorators: [
    Story => (
      <div data-testid="frt318-nameonly-container" className="w-[545px]">
        <Story />
      </div>
    ),
  ],
  args: {
    block: {
      ...fileBlock,
      label: "증빙 자료",
      value: {
        type: "file",
        fileName: longUnbrokenFileName,
        description: "",
        evidenceType: "증빙 서류",
      },
    },
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await canvas.findByText(longUnbrokenFileName)

    expectWithinParent(canvasElement, "frt318-nameonly-container")
  },
}

let retryRequests = 0
const retryState: Story = {
  args: {
    block: {
      ...fileBlock,
      value: { type: "file", fileName: "증빙.pdf", fileId: "file-frt240-retry",
        mimeType: "application/pdf", url: "https://files.example/stale", description: "제출한 증빙", evidenceType: "증빙 서류" },
    },
  },
  beforeEach: () => { retryRequests = 0 },
  parameters: {
    msw: {
      handlers: [http.get("*/files/file-frt240-retry/download", () => {
        retryRequests += 1
        return retryRequests === 1
          ? HttpResponse.json({ message: "signed URL must stay private" }, { status: 500 })
          : HttpResponse.json({ data: "https://files.example/recovered" })
      })],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const retry = await canvas.findByRole("button", { name: "다운로드 링크 다시 시도" })
    expect(canvas.queryByRole("link")).toBeNull()
    expect(canvas.queryByText(/signed URL/)).toBeNull()
    await userEvent.click(retry)
    const link = await canvas.findByRole("link", { name: "증빙.pdf 열기" })
    expect(link).toHaveAttribute("href", "https://files.example/recovered")
    expect(canvas.queryByRole("button", { name: "다운로드 링크 다시 시도" })).toBeNull()
  },
}

export const DownloadRetry: Story = { ...retryState, args: { ...retryState.args, readOnly: false } }
export const ReadOnlyDownloadRetry: Story = { ...retryState, args: { ...retryState.args, readOnly: true } }

/** FRT-202: 저장된 URL만 있는 레거시도 기존 PDF 열기 동작을 제공한다. */
export const ReadOnlyLegacyPdf: Story = {
  args: {
    block: {
      ...fileBlock,
      value: { type: "file", fileName: "성적표.pdf", mimeType: "application/pdf",
        url: "https://files.example/%EC%84%B1%EC%A0%81%ED%91%9C.pdf?token=encoded%2Fvalue",
        description: "기존에 첨부한 성적표", evidenceType: "성적표" },
    },
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = await canvas.findByRole("link", { name: "성적표.pdf 열기" })
    expect(link).toHaveAttribute("href", "https://files.example/%EC%84%B1%EC%A0%81%ED%91%9C.pdf?token=encoded%2Fvalue")
    expect(link).toHaveAttribute("rel", "noreferrer noopener")
    expect(canvas.getByText("기존에 첨부한 성적표")).toBeVisible()
    expect(canvas.queryByRole("button")).toBeNull()
  },
}

/** MIME가 없으면 확장자를 추측하지 않고 일반 파일 다운로드를 제공한다. */
export const ReadOnlyLegacyWithoutMime: Story = {
  args: {
    block: {
      ...fileBlock,
      value: { type: "file", fileName: "포트폴리오.pdf", url: "https://files.example/portfolio.pdf",
        description: "파일 형식 정보 없이 저장된 첨부", evidenceType: "포트폴리오" },
    },
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(await canvas.findByRole("link", { name: "포트폴리오.pdf 다운로드" })).toHaveAttribute("href", "https://files.example/portfolio.pdf")
    expect(canvas.queryByText("PDF", { exact: true })).toBeNull()
  },
}

/** 안전하지 않은 저장 URL은 이름만 있는 기존 폴백을 유지한다. */
export const ReadOnlyLegacyUnsafeUrl: Story = {
  args: {
    block: {
      ...fileBlock,
      value: { type: "file", fileName: "검토 자료.png", mimeType: "image/png", url: "javascript:alert(1)",
        description: "", evidenceType: "기타" },
    },
    readOnly: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(await canvas.findByText("검토 자료.png")).toBeVisible()
    expect(canvas.queryByRole("link")).toBeNull()
    expect(canvas.queryByRole("img")).toBeNull()
  },
}
