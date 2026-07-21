import { describe, it, expect } from "vitest";
import { Packer } from "docx";
import JSZip from "jszip";

import { buildResumeDocxFile, renderResumeDocx } from "@/lib/export/resume-docx";
import type { ResumeDocument } from "@/lib/export/resume-document";

const doc: ResumeDocument = {
  language: "ko",
  header: {
    name: "김서윤",
    subName: "Seo-yun Kim",
    birth: "2002-03-15",
    contacts: ["seo-yun@example.com", "010-0000-0000"],
    links: [{ label: "GitHub", url: "https://github.com/demo" }],
  },
  sections: [
    {
      title: "경력",
      entries: [
        {
          title: "한양대 NLP 연구실",
          subtitle: "학부 연구생 · 인턴",
          meta: "2025-09 – 2026-02",
          bulletGroups: [
            { items: ["레이블링 가이드라인 작성"] },
            { label: "성과", items: ["IAA 0.61 → 0.78 개선"] },
          ],
          notes: [{ label: "사용 기술", text: "PyTorch, KLUE-BERT" }],
        },
      ],
    },
    {
      title: "자기소개",
      entries: [{ text: "데이터로 문제를 푸는 사람입니다." }],
    },
  ],
};

// .docx 는 zip 이다 — 본문 XML(word/document.xml)을 꺼내 실제로 실린 텍스트를 본다.
async function xmlOf(document: ResumeDocument): Promise<string> {
  const bytes = await Packer.toBuffer(buildResumeDocxFile(document));
  const zip = await JSZip.loadAsync(bytes);
  const body = zip.file("word/document.xml");
  if (!body) throw new Error("word/document.xml 이 없다");
  return body.async("string");
}

describe("buildResumeDocxFile", () => {
  it("머리말의 이름·연락처·링크를 문서에 싣는다", async () => {
    const xml = await xmlOf(doc);

    expect(xml).toContain("김서윤");
    expect(xml).toContain("Seo-yun Kim");
    expect(xml).toContain("seo-yun@example.com");
    expect(xml).toContain("https://github.com/demo");
  });

  it("섹션 제목과 항목 본문을 모두 싣는다", async () => {
    const xml = await xmlOf(doc);

    expect(xml).toContain("경력");
    expect(xml).toContain("한양대 NLP 연구실");
    expect(xml).toContain("학부 연구생 · 인턴");
    expect(xml).toContain("2025-09");
    expect(xml).toContain("레이블링 가이드라인 작성");
    expect(xml).toContain("성과");
    expect(xml).toContain("IAA 0.61");
    expect(xml).toContain("사용 기술");
    expect(xml).toContain("PyTorch, KLUE-BERT");
    expect(xml).toContain("데이터로 문제를 푸는 사람입니다.");
  });

  it("섹션이 하나도 없어도 문서를 만든다", async () => {
    const xml = await xmlOf({
      language: "ko",
      header: { contacts: [], links: [] },
      sections: [],
    });

    expect(xml).toContain("<w:document");
  });
});

describe("renderResumeDocx", () => {
  it("내용이 있는 .docx 바이트를 돌려준다", async () => {
    const blob = await renderResumeDocx(doc);
    const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 2);

    expect(blob.size).toBeGreaterThan(0);
    // .docx 는 zip 컨테이너다 — 매직 넘버 "PK".
    expect(Array.from(head)).toEqual([0x50, 0x4b]);
  });
});
