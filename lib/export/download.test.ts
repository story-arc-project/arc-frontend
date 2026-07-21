import { describe, it, expect, vi, afterEach } from "vitest";

import { downloadBlob, resumeFileName } from "@/lib/export/download";

const DATE = new Date("2026-07-21T09:30:00+09:00");

describe("resumeFileName", () => {
  it("한국어 레쥬메는 이름과 생성일로 이름을 짓는다", () => {
    expect(
      resumeFileName({ name: "김서윤", language: "ko", ext: "pdf", now: DATE }),
    ).toBe("김서윤_레쥬메_20260721.pdf");
  });

  it("영문 레쥬메는 Resume 로 적고 공백을 밑줄로 바꾼다", () => {
    expect(
      resumeFileName({
        name: "Seo-yun Kim",
        language: "en",
        ext: "docx",
        now: DATE,
      }),
    ).toBe("Seo-yun_Kim_Resume_20260721.docx");
  });

  it("이름이 없으면 이름 자리를 비운다", () => {
    expect(
      resumeFileName({ name: undefined, language: "ko", ext: "pdf", now: DATE }),
    ).toBe("레쥬메_20260721.pdf");
    expect(
      resumeFileName({ name: "   ", language: "en", ext: "pdf", now: DATE }),
    ).toBe("Resume_20260721.pdf");
  });

  it("경로·예약 문자를 지운다", () => {
    expect(
      resumeFileName({
        name: 'a/b\\c:d*e?f"g<h>i|j',
        language: "en",
        ext: "pdf",
        now: DATE,
      }),
    ).toBe("abcdefghij_Resume_20260721.pdf");
  });

  it("점으로 시작하는 이름이 숨김 파일이 되지 않게 한다", () => {
    expect(
      resumeFileName({ name: "..", language: "ko", ext: "pdf", now: DATE }),
    ).toBe("레쥬메_20260721.pdf");
  });

  it("아주 긴 이름을 잘라낸다", () => {
    const out = resumeFileName({
      name: "가".repeat(200),
      language: "ko",
      ext: "pdf",
      now: DATE,
    });
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith("_레쥬메_20260721.pdf")).toBe(true);
  });
});

describe("downloadBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("앵커로 내려받고 객체 URL 을 회수한다", () => {
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    downloadBlob(new Blob(["x"]), "레쥬메.pdf");

    expect(anchor.download).toBe("레쥬메.pdf");
    expect(anchor.href).toContain("blob:fake");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    vi.unstubAllGlobals();
  });
});
