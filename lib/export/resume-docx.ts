// ResumeDocument(IR) → Word(.docx).
//
// PDF 와 달리 폰트를 우리가 싣지 않는다 — Word 가 시스템 폰트로 렌더링한다.
// 그래서 사용자가 받은 뒤 직접 더 고칠 수 있다(FRT-112 가 DOCX 를 넣은 이유).

import {
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
  type ISectionOptions,
} from "docx";

import type { DocEntry, ResumeDocument } from "@/lib/export/resume-document";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// docx 의 길이 단위는 twip(1/1440 inch). A4 210mm 폭에서 좌우 15mm 여백을 뺀 본문 폭.
const PAGE_MARGIN_Y = 1134; // 20mm
const PAGE_MARGIN_X = 850; // 15mm
const CONTENT_WIDTH = 11906 - PAGE_MARGIN_X * 2;

// 한글이 Calibri 로 떨어지지 않도록 한국어 기본 폰트를 지정한다.
const FONT = "맑은 고딕";

function line(
  text: string,
  options: {
    size?: number;
    bold?: boolean;
    color?: string;
    spacingAfter?: number;
    spacingBefore?: number;
    indent?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    spacing: { after: options.spacingAfter ?? 40, before: options.spacingBefore },
    indent: options.indent ? { left: options.indent } : undefined,
    children: [
      new TextRun({
        text,
        bold: options.bold,
        size: options.size ?? 20, // half-point. 20 = 10pt
        color: options.color,
        font: FONT,
      }),
    ],
  });
}

/** 왼쪽 제목 + 오른쪽 기간을 한 줄에 놓는다(우측 탭 정렬). */
function titleWithMeta(title: string, meta: string | undefined): Paragraph {
  const children = [
    new TextRun({ text: title, bold: true, size: 21, font: FONT }),
  ];

  if (meta) {
    children.push(
      new TextRun({ text: "\t", font: FONT }),
      new TextRun({ text: meta, size: 18, color: "666666", font: FONT }),
    );
  }

  return new Paragraph({
    spacing: { after: 40 },
    tabStops: meta
      ? [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }]
      : undefined,
    children,
  });
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD", space: 4 },
    },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 20,
        font: FONT,
      }),
    ],
  });
}

function bulletLine(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 20 },
    children: [new TextRun({ text, size: 20, font: FONT })],
  });
}

function entryParagraphs(entry: DocEntry): Paragraph[] {
  const blocks: Paragraph[] = [];

  if (entry.title) {
    blocks.push(titleWithMeta(entry.title, entry.meta));
  } else if (entry.meta) {
    blocks.push(line(entry.meta, { size: 18, color: "666666" }));
  }

  if (entry.subtitle) {
    blocks.push(line(entry.subtitle, { size: 18, color: "555555" }));
  }
  if (entry.detail) {
    blocks.push(line(entry.detail, { size: 18, color: "777777" }));
  }
  if (entry.text) {
    blocks.push(line(entry.text));
  }

  for (const group of entry.bulletGroups ?? []) {
    if (group.label) {
      blocks.push(
        line(group.label, { size: 18, bold: true, color: "777777", spacingBefore: 60 }),
      );
    }
    blocks.push(...group.items.map(bulletLine));
  }

  for (const note of entry.notes ?? []) {
    blocks.push(
      line(note.label ? `${note.label}: ${note.text}` : note.text, {
        size: 18,
        color: "777777",
        spacingBefore: 40,
      }),
    );
  }

  // 항목 사이 숨 쉴 틈
  blocks.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
  return blocks;
}

function headerParagraphs(doc: ResumeDocument): Paragraph[] {
  const blocks: Paragraph[] = [];
  const { header } = doc;

  if (header.name) {
    blocks.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: header.name, bold: true, size: 32, font: FONT }),
        ],
      }),
    );
  }
  if (header.subName) {
    blocks.push(line(header.subName, { size: 20, color: "555555" }));
  }
  if (header.birth) {
    blocks.push(line(`생년월일 ${header.birth}`, { size: 18, color: "666666" }));
  }
  if (header.contacts.length > 0) {
    blocks.push(
      line(header.contacts.join("  ·  "), { size: 18, color: "555555" }),
    );
  }
  if (header.links.length > 0) {
    const text = header.links
      .map((l) => (l.label ? `${l.label}: ${l.url}` : l.url))
      .join("  ·  ");
    blocks.push(line(text, { size: 18, color: "555555" }));
  }

  return blocks;
}

export function buildResumeDocxFile(doc: ResumeDocument): Document {
  const children: Paragraph[] = [...headerParagraphs(doc)];

  for (const section of doc.sections) {
    children.push(sectionHeading(section.title));
    for (const entry of section.entries) {
      children.push(...entryParagraphs(entry));
    }
  }

  const properties: ISectionOptions = {
    properties: {
      page: {
        margin: {
          top: PAGE_MARGIN_Y,
          bottom: PAGE_MARGIN_Y,
          left: PAGE_MARGIN_X,
          right: PAGE_MARGIN_X,
        },
      },
    },
    children,
  };

  return new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: 20 } },
      },
    },
    sections: [properties],
  });
}

export async function renderResumeDocx(doc: ResumeDocument): Promise<Blob> {
  const blob = await Packer.toBlob(buildResumeDocxFile(doc));
  // Packer 가 돌려주는 MIME 이 환경에 따라 비어 있을 수 있어 명시적으로 다시 감싼다.
  return blob.type === DOCX_MIME ? blob : new Blob([blob], { type: DOCX_MIME });
}
