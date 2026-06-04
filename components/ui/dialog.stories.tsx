import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Dialog } from "./dialog";
import { Button } from "./button";

const meta: Meta<typeof Dialog> = {
  title: "UI/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof Dialog>;

function ControlledDialogRender() {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        다이얼로그 열기
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="예시 다이얼로그"
      >
        <h2 className="text-title text-text-primary mb-2">다이얼로그 제목</h2>
        <p className="text-body text-text-secondary mb-4">
          이것은 예시 다이얼로그입니다. ESC 키를 누르거나 배경을 클릭하면 닫힙니다.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button variant="primary" onClick={() => setOpen(false)}>
            확인
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export const Controlled: Story = {
  render: () => <ControlledDialogRender />,
};

function OpenByDefaultRender() {
  const [open, setOpen] = useState<boolean>(true);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        다이얼로그 열기
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="기본으로 열린 다이얼로그"
      >
        <h2 className="text-title text-text-primary mb-2">기본으로 열림</h2>
        <p className="text-body text-text-secondary mb-4">
          이 스토리는 다이얼로그가 열린 상태로 마운트됩니다.
        </p>
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setOpen(false)}>
            닫기
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export const OpenByDefault: Story = {
  render: () => <OpenByDefaultRender />,
};

function DestructiveDialogRender() {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        삭제 확인
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="삭제 확인 다이얼로그"
      >
        <h2 className="text-title text-text-primary mb-2">정말 삭제하시겠습니까?</h2>
        <p className="text-body text-text-secondary mb-4">
          이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button variant="destructive" onClick={() => setOpen(false)}>
            삭제
          </Button>
        </div>
      </Dialog>
    </>
  );
}

export const Destructive: Story = {
  render: () => <DestructiveDialogRender />,
};
