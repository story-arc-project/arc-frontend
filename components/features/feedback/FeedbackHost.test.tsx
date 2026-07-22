import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FeedbackHost } from "./FeedbackHost";
import { useFeedbackTriggers } from "@/contexts/FeedbackTriggerContext";
import { FEEDBACK_PROMPT_DELAY_MS } from "@/lib/feedback/campaigns";
import type { FeedbackContext } from "@/lib/feedback/types";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const server = vi.hoisted(() => ({ markFeedbackPromptShown: vi.fn() }));
vi.mock("@/lib/api/feedback-api", () => ({
  markFeedbackPromptShown: server.markFeedbackPromptShown,
}));

const transport = vi.hoisted(() => ({ submitFeedback: vi.fn() }));
vi.mock("@/lib/feedback/transport", () => ({
  submitFeedback: transport.submitFeedback,
}));

const ANALYSIS: FeedbackContext = {
  analysisId: "an-1",
  analysisType: "keyword",
};

/** 신호를 손으로 쏘는 하네스 — 실제 호출부(대시보드·분석 생성)를 대신한다. */
function Triggers({ count = 3 }: { count?: number }) {
  const triggers = useFeedbackTriggers();
  return (
    <>
      <button onClick={() => triggers?.reportExperienceCount(count)}>
        경험보고
      </button>
      <button onClick={() => triggers?.reportAnalysisCompleted(ANALYSIS)}>
        분석보고
      </button>
    </>
  );
}

function renderHost(props: { count?: number } = {}) {
  return render(
    <FeedbackHost>
      <Triggers {...props} />
    </FeedbackHost>,
  );
}

/** 타이머를 흘리고, 그 사이 걸린 prompt-shown promise 까지 정착시킨다. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function fire(label: "경험보고" | "분석보고") {
  fireEvent.click(screen.getByText(label));
}

function modal() {
  return screen.queryByRole("dialog");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "true");
  server.markFeedbackPromptShown.mockResolvedValue({ created: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  nav.pathname = "/dashboard";
});

describe("FeedbackHost", () => {
  it("신호가 와도 지연이 지나기 전에는 띄우지 않는다", async () => {
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS - 1);

    expect(modal()).not.toBeInTheDocument();
    // 노출 기록도 아직 남기지 않는다 — 기록은 실제로 뜨는 순간과 일치해야 한다.
    expect(server.markFeedbackPromptShown).not.toHaveBeenCalled();
  });

  it("지연이 지나면 경험 트리거 문구로 띄운다", async () => {
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(modal()).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "ARC에 기록해 보니 어떠셨나요?" }),
    ).toBeInTheDocument();
    expect(server.markFeedbackPromptShown).toHaveBeenCalledWith(
      "analysis-satisfaction",
      "experience_threshold",
    );
  });

  it("임계 미만 경험 개수는 신호로 치지 않는다", async () => {
    renderHost({ count: 2 });
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(modal()).not.toBeInTheDocument();
    expect(server.markFeedbackPromptShown).not.toHaveBeenCalled();
  });

  it("임계 미만으로 한 번 보고된 뒤 임계에 도달하면 그때 띄운다", async () => {
    // 경험 2개인 목록을 보다가 하나를 더 저장하면 같은 화면이 3 을 다시 보고한다.
    // 임계 미만 신호가 자리를 차지해버리면 이 사용자는 영영 모달을 못 본다.
    const { rerender } = renderHost({ count: 2 });
    fire("경험보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);
    expect(modal()).not.toBeInTheDocument();

    rerender(
      <FeedbackHost>
        <Triggers count={3} />
      </FeedbackHost>,
    );
    fire("경험보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(modal()).toBeInTheDocument();
  });

  it("분석 완료는 경험 트리거를 이기고 자기 문구·컨텍스트로 뜬다", async () => {
    renderHost();
    fire("경험보고");
    fire("분석보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(
      screen.getByRole("heading", { name: "방금 이 분석, 도움이 됐나요?" }),
    ).toBeInTheDocument();
    expect(server.markFeedbackPromptShown).toHaveBeenCalledWith(
      "analysis-satisfaction",
      "analysis_completed",
    );
  });

  it("서버가 이미 노출됐다고 하면(created=false) 띄우지 않는다", async () => {
    server.markFeedbackPromptShown.mockResolvedValue({ created: false });
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(modal()).not.toBeInTheDocument();
  });

  it("입력 화면에서는 지연이 지나도 띄우지 않는다", async () => {
    nav.pathname = "/archive/new";
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

    expect(modal()).not.toBeInTheDocument();
    expect(server.markFeedbackPromptShown).not.toHaveBeenCalled();
  });

  it("경험 상세 편집 화면도 억제 대상이다", async () => {
    nav.pathname = "/archive/exp-1/edit";
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

    expect(modal()).not.toBeInTheDocument();
  });

  it("입력을 마치고 화면을 벗어나면 그때 지연 후 띄운다", async () => {
    nav.pathname = "/archive/new";
    const { rerender } = renderHost();
    fire("경험보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);
    expect(modal()).not.toBeInTheDocument();

    // 저장을 마치고 목록으로 — 보류된 신호가 여기서 살아난다.
    nav.pathname = "/archive";
    rerender(
      <FeedbackHost>
        <Triggers />
      </FeedbackHost>,
    );

    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(modal()).toBeInTheDocument();
  });

  it("떠 있는 동안 입력 화면으로 넘어가면 가리지 않고 물러났다가, 벗어나면 돌아온다", async () => {
    const { rerender } = renderHost();
    fire("경험보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);
    expect(modal()).toBeInTheDocument();

    // 목록에서 '새 경험 추가'를 눌러 입력으로 들어간 상황.
    nav.pathname = "/archive/new";
    rerender(
      <FeedbackHost>
        <Triggers />
      </FeedbackHost>,
    );
    expect(modal()).not.toBeInTheDocument();

    nav.pathname = "/archive";
    rerender(
      <FeedbackHost>
        <Triggers />
      </FeedbackHost>,
    );
    expect(modal()).toBeInTheDocument();
  });

  it("제출하면 전송 레이어로 payload 를 넘기고 모달을 닫는다", async () => {
    renderHost();
    fire("분석보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);

    fireEvent.click(screen.getByRole("radio", { name: "별 5점" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    expect(transport.submitFeedback).toHaveBeenCalledTimes(1);
    expect(transport.submitFeedback).toHaveBeenCalledWith({
      campaignId: "analysis-satisfaction",
      triggerSource: "analysis_completed",
      rating: 5,
      context: ANALYSIS,
    });
    expect(modal()).not.toBeInTheDocument();
  });

  it("그냥 닫으면 전송하지 않고, 신호가 다시 와도 재노출하지 않는다", async () => {
    renderHost();
    fire("경험보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);
    expect(modal()).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(transport.submitFeedback).not.toHaveBeenCalled();
    expect(modal()).not.toBeInTheDocument();

    // 같은 세션에서 트리거가 또 걸려도 다시 뜨지 않는다(마운트 수명 1회).
    fire("분석보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);
    expect(modal()).not.toBeInTheDocument();
  });

  it("플래그가 꺼져 있으면 노출 기록도 남기지 않고 아무 것도 뜨지 않는다", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEEDBACK_ENABLED", "");
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(modal()).not.toBeInTheDocument();
    expect(server.markFeedbackPromptShown).not.toHaveBeenCalled();
  });

  it("provider 로 감싼 자식은 그대로 렌더된다", () => {
    renderHost();
    expect(screen.getByText("경험보고")).toBeInTheDocument();
  });
});
