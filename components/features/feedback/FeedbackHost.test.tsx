import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  useFeedbackTriggers,
  useSuppressFeedback,
} from "@/contexts/FeedbackTriggerContext";
import { FEEDBACK_PROMPT_DELAY_MS } from "@/lib/feedback/campaigns";
import type { FeedbackContext } from "@/lib/feedback/types";
import { FeedbackHost } from "./FeedbackHost";

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

  it.each(["/analysis/comprehensive/new", "/analysis/keyword/new"])(
    "분석 생성 화면(%s)도 억제 대상이다",
    async (pathname) => {
      // 경험을 고르는 중이거나 결과를 기다리는 로딩 화면이다.
      nav.pathname = pathname;
      renderHost();
      fire("경험보고");

      await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

      expect(modal()).not.toBeInTheDocument();
    },
  );

  it.each(["/analysis/comprehensive", "/analysis/keyword"])(
    "분석 목록(%s)도 억제 대상이다 — 결과를 아직 못 본 화면이다",
    async (pathname) => {
      // 완료는 목록에서 관측되지만(FRT-176), 캠페인이 묻는 건 "방금 이 분석, 도움이 됐나요?"다.
      // 결과를 열어보기 전에 물으면 단 한 번뿐인 노출 기회를 헛되이 쓴다.
      nav.pathname = pathname;
      renderHost();
      fire("분석보고");

      await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

      expect(modal()).not.toBeInTheDocument();
    },
  );

  it("목록에서 보류된 분석 완료 신호는 결과 화면으로 넘어가면 뜬다", async () => {
    // 억제는 신호를 버리지 않고 보류한다 — 그러지 않으면 그 방문에서 기회가 사라진다.
    nav.pathname = "/analysis/comprehensive";
    const { rerender } = renderHost();
    fire("분석보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);
    expect(modal()).not.toBeInTheDocument();

    nav.pathname = "/analysis/comprehensive/comp-1";
    rerender(
      <FeedbackHost>
        <Triggers />
      </FeedbackHost>,
    );
    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

    expect(modal()).toBeInTheDocument();
  });

  it("보류된 신호가 다른 분석 위에서 뜨면, 평가 대상을 그 화면의 분석으로 맞춘다", async () => {
    // 한 번의 갱신에서 여러 건이 완료되면 신호는 먼저 온 an-1 로 고정된다(덮지 않는 규칙).
    // 사용자가 comp-2 를 열면 "방금 이 분석"이라 물어놓고 payload 에는 an-1 이 실릴 수 있다.
    nav.pathname = "/analysis/comprehensive";
    const { rerender } = renderHost();
    fire("분석보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

    nav.pathname = "/analysis/comprehensive/comp-2";
    rerender(
      <FeedbackHost>
        <Triggers />
      </FeedbackHost>,
    );
    await advance(FEEDBACK_PROMPT_DELAY_MS);

    fireEvent.click(screen.getByRole("radio", { name: "별 4점" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    expect(transport.submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerSource: "analysis_completed",
        context: { analysisId: "comp-2", analysisType: "comprehensive" },
      }),
    );
  });

  it("모달이 뜬 뒤 다른 결과로 옮겨 보내면, 보낼 때 보던 결과로 나간다", async () => {
    // 귀속을 '뜨는 순간'에 얼려두면, 노출 기록을 기다리는 사이나 모달이 떠 있는 동안
    // 화면을 옮긴 사용자에게 화면은 C 인데 평가는 B 로 나가는 어긋남이 남는다.
    nav.pathname = "/analysis/comprehensive/comp-b";
    const { rerender } = renderHost();
    fire("분석보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);
    expect(modal()).toBeInTheDocument();

    nav.pathname = "/analysis/keyword/kw-c";
    rerender(
      <FeedbackHost>
        <Triggers />
      </FeedbackHost>,
    );

    fireEvent.click(screen.getByRole("radio", { name: "별 5점" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    expect(transport.submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { analysisId: "kw-c", analysisType: "keyword" },
      }),
    );
  });

  it("끝에 슬래시가 붙은 목록 경로도 억제한다", async () => {
    // next.config 가 skipTrailingSlashRedirect 를 켜 둬서 정규화가 보장되지 않는다.
    nav.pathname = "/analysis/comprehensive/";
    renderHost();
    fire("분석보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

    expect(modal()).not.toBeInTheDocument();
    expect(server.markFeedbackPromptShown).not.toHaveBeenCalled();
  });

  it("끝에 슬래시가 붙은 결과 경로도 그 분석으로 귀속한다", async () => {
    nav.pathname = "/analysis/keyword/kw-9/";
    renderHost();
    fire("분석보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);

    fireEvent.click(screen.getByRole("radio", { name: "별 5점" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    expect(transport.submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { analysisId: "kw-9", analysisType: "keyword" },
      }),
    );
  });

  it("결과 화면이 아닌 곳에서 뜨면 원래 완료 신호를 그대로 싣는다", async () => {
    nav.pathname = "/dashboard";
    renderHost();
    fire("분석보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);

    fireEvent.click(screen.getByRole("radio", { name: "별 3점" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    expect(transport.submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ context: ANALYSIS }),
    );
  });

  it("개별 분석 상세는 귀속 대상이 아니다 — 완료를 관측하지 않는 종류다", async () => {
    nav.pathname = "/analysis/individual/ind-1";
    renderHost();
    fire("분석보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);

    fireEvent.click(screen.getByRole("radio", { name: "별 2점" }));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    expect(transport.submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ context: ANALYSIS }),
    );
  });

  it("이력서 편집기도 억제 대상이다(미저장 편집 상태를 든 화면)", async () => {
    nav.pathname = "/export/resume/v-1";
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

    expect(modal()).not.toBeInTheDocument();
    expect(server.markFeedbackPromptShown).not.toHaveBeenCalled();
  });

  it("화면이 스스로 억제를 선언하면, 경로가 멀쩡해도 띄우지 않는다", async () => {
    // 목록과 같은 URL 위에 열리는 생성 모달처럼, 경로로는 보이지 않는 입력 흐름.
    function Busy({ open }: { open: boolean }) {
      useSuppressFeedback(open);
      return null;
    }
    const { rerender } = render(
      <FeedbackHost>
        <Triggers />
        <Busy open />
      </FeedbackHost>,
    );
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);
    expect(modal()).not.toBeInTheDocument();
    expect(server.markFeedbackPromptShown).not.toHaveBeenCalled();

    // 흐름이 끝나면 보류돼 있던 신호가 살아난다.
    rerender(
      <FeedbackHost>
        <Triggers />
        <Busy open={false} />
      </FeedbackHost>,
    );
    await advance(FEEDBACK_PROMPT_DELAY_MS);
    expect(modal()).toBeInTheDocument();
  });

  it("선언이 둘이면 마지막 하나가 내려갈 때까지 유지된다", async () => {
    function Busy({ open }: { open: boolean }) {
      useSuppressFeedback(open);
      return null;
    }
    const { rerender } = render(
      <FeedbackHost>
        <Triggers />
        <Busy open />
        <Busy open />
      </FeedbackHost>,
    );
    fire("경험보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS);
    expect(modal()).not.toBeInTheDocument();

    // 하나만 내려가면 아직 억제 상태여야 한다 — 키가 겹쳐 서로를 덮으면 여기서 뜬다.
    rerender(
      <FeedbackHost>
        <Triggers />
        <Busy open={false} />
        <Busy open />
      </FeedbackHost>,
    );
    await advance(FEEDBACK_PROMPT_DELAY_MS);
    expect(modal()).not.toBeInTheDocument();
  });

  it("설정 화면도 억제 대상이다(프로필 편집 폼)", async () => {
    nav.pathname = "/settings";
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS * 5);

    expect(modal()).not.toBeInTheDocument();
    expect(server.markFeedbackPromptShown).not.toHaveBeenCalled();
  });

  it("이력서 목록은 억제 대상이 아니다", async () => {
    nav.pathname = "/export";
    renderHost();
    fire("경험보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(modal()).toBeInTheDocument();
  });

  it("지연 도중 화면을 옮기면 새 화면 기준으로 지연을 다시 센다", async () => {
    // 트리거를 낸 화면에서 곧바로 떠나면, 살아남은 타이머가 이제 막 열린 화면 위에
    // 순식간에 모달을 띄운다 — 지연의 존재 이유가 무너지는 지점.
    const { rerender } = renderHost();
    fire("경험보고");
    await advance(FEEDBACK_PROMPT_DELAY_MS - 100);

    nav.pathname = "/analysis";
    rerender(
      <FeedbackHost>
        <Triggers />
      </FeedbackHost>,
    );

    // 옮긴 화면에서 아직 지연이 다 지나지 않았다.
    await advance(FEEDBACK_PROMPT_DELAY_MS - 100);
    expect(modal()).not.toBeInTheDocument();

    await advance(100);
    expect(modal()).toBeInTheDocument();
  });

  it("분석 결과 상세는 억제 대상이 아니다(완료 트리거가 뜨는 곳)", async () => {
    nav.pathname = "/analysis/keyword/an-1";
    renderHost();
    fire("분석보고");

    await advance(FEEDBACK_PROMPT_DELAY_MS);

    expect(modal()).toBeInTheDocument();
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
