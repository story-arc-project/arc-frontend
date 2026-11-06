import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CoverLetterPreview } from "./CoverLetterPreview";
import type { CoverLetterResult } from "@/types/cover-letter";
afterEach(cleanup);
const result: CoverLetterResult = { answers: [{ question: "강점", cover_letter: "## 강점\n**수상 경력**입니다.", grounding: { grounded: false, unsupported_claims: ["*수상 경력*"], notes: "" }, max_chars: 10 }] };
it("cleans display while preserving raw count, limit and grounding", () => {
  const before = structuredClone(result);
  const { container } = render(<CoverLetterPreview result={result} />);
  expect(container.querySelector("mark")?.firstChild?.textContent).toBe("수상 경력");
  expect(container.querySelector(".whitespace-pre-wrap")?.textContent).not.toMatch(/[#*]/);
  expect(screen.getByText(`${result.answers[0].cover_letter.length}자 / 10자 — 제한을 넘었어요`)).toBeInTheDocument();
  expect(result).toEqual(before);
});
it("cleans edited bodies while disabling stale highlights", () => {
  const edited = { answers: [{ ...result.answers[0], cover_letter: "**고친 수상 경력**입니다." }] };
  const { container } = render(<CoverLetterPreview result={edited} original={result} />);
  expect(container.querySelector("mark")).toBeNull();
  expect(container.querySelector(".whitespace-pre-wrap")?.textContent).toBe("고친 수상 경력입니다.");
});
it("keeps empty and multiple answers", () => {
  const { rerender, container } = render(<CoverLetterPreview result={{ answers: [] }} />);
  expect(screen.getByText("보여줄 자기소개서 본문이 없어요.")).toBeInTheDocument();
  rerender(<CoverLetterPreview result={{ answers: [result.answers[0], { ...result.answers[0], question: "다음" }] }} />);
  expect(container.querySelectorAll("section")).toHaveLength(2);
});
