// ResumeDocument(IR) → PDF.
//
// 브라우저 인쇄와 달리 여백·페이지 분할·파일명을 우리가 통제하고, 이미지가 아니라
// 텍스트로 그리므로 복사·검색·ATS 파싱이 된다(FRT-112 가 PDF 를 기본값으로 둔 이유).
// 이 모듈은 클릭 시점에 동적 import 되어 초기 번들에 들어가지 않는다.

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

import type { DocEntry, ResumeDocument } from "@/lib/export/resume-document";

// 한글 글리프가 있는 폰트를 직접 실어야 PDF 에서 글자가 깨지지 않는다.
// public/fonts 의 subset 파일을 런타임에 받아 쓰므로 JS 번들에는 들어가지 않는다.
let fontsRegistered = false;

function ensureFonts(): void {
  if (fontsRegistered) return;

  Font.register({
    family: "Pretendard",
    fonts: [
      { src: "/fonts/Pretendard-Regular.ttf", fontWeight: 400 },
      { src: "/fonts/Pretendard-Bold.ttf", fontWeight: 700 },
    ],
  });
  // 기본 하이프네이션은 한글 단어를 어색하게 쪼갠다 — 단어를 통째로 유지한다.
  Font.registerHyphenationCallback((word) => [word]);

  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Pretendard",
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#1a1a1a",
    // print.css 의 @page margin(20mm 15mm)과 같은 여백. 1mm ≈ 2.8346pt
    paddingVertical: 56.7,
    paddingHorizontal: 42.5,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  name: { fontSize: 19, fontWeight: 700 },
  subName: { fontSize: 10, color: "#555555", marginTop: 2 },
  birth: { fontSize: 8.5, color: "#666666" },
  contactLine: { fontSize: 8.5, color: "#555555", marginTop: 8 },
  linkLine: { fontSize: 8.5, color: "#555555", marginTop: 2 },

  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    letterSpacing: 0.6,
    borderBottomWidth: 0.7,
    borderBottomColor: "#dddddd",
    paddingBottom: 3,
    marginBottom: 7,
  },

  entry: { marginBottom: 8 },
  entryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  entryTitle: { fontSize: 10, fontWeight: 700, flexShrink: 1 },
  entryMeta: {
    fontSize: 8.5,
    color: "#666666",
    marginLeft: 12,
    flexShrink: 0,
  },
  entrySubtitle: { fontSize: 8.5, color: "#555555" },
  entryDetail: { fontSize: 8.5, color: "#777777" },
  entryText: { marginTop: 2 },

  bulletGroupLabel: {
    fontSize: 8.5,
    color: "#777777",
    fontWeight: 700,
    marginTop: 4,
  },
  bulletRow: { flexDirection: "row", marginTop: 1.5 },
  bulletDot: { width: 9, fontSize: 9.5 },
  bulletText: { flex: 1 },

  note: { fontSize: 8.5, color: "#777777", marginTop: 3 },
});

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

function Entry({ entry }: { entry: DocEntry }) {
  return (
    // 항목 전체에 wrap={false} 를 걸면 한 페이지보다 긴 항목(불릿이 많은 경력 등)이
    // 잘려 내용이 사라진다. 그래서 항목은 흐르게 두고, ①머리말(제목·기간·부제)만
    // 붙여 두어 반 토막 나지 않게 하고 ②minPresenceAhead 로 페이지 맨 아래에서
    // 제목만 남고 본문이 넘어가는 것을 막는다.
    <View style={styles.entry} minPresenceAhead={36}>
      <View wrap={false}>
        {(entry.title || entry.meta) && (
          <View style={styles.entryRow}>
            <Text style={styles.entryTitle}>{entry.title ?? ""}</Text>
            {entry.meta && <Text style={styles.entryMeta}>{entry.meta}</Text>}
          </View>
        )}
        {entry.subtitle && (
          <Text style={styles.entrySubtitle}>{entry.subtitle}</Text>
        )}
        {entry.detail && <Text style={styles.entryDetail}>{entry.detail}</Text>}
      </View>
      {entry.text && <Text style={styles.entryText}>{entry.text}</Text>}

      {(entry.bulletGroups ?? []).map((group, gi) => (
        <View key={gi}>
          {group.label && (
            <Text style={styles.bulletGroupLabel}>{group.label}</Text>
          )}
          {group.items.map((item, ii) => (
            <Bullet key={ii}>{item}</Bullet>
          ))}
        </View>
      ))}

      {(entry.notes ?? []).map((note, ni) => (
        <Text key={ni} style={styles.note}>
          {note.label ? `${note.label}: ${note.text}` : note.text}
        </Text>
      ))}
    </View>
  );
}

export function ResumePdfDocument({ doc }: { doc: ResumeDocument }) {
  const { header } = doc;
  const contactLine = header.contacts.join("  ·  ");
  const linkLine = header.links
    .map((l) => (l.label ? `${l.label}: ${l.url}` : l.url))
    .join("  ·  ");

  return (
    <Document title={header.name ? `${header.name} 레쥬메` : "레쥬메"}>
      <Page size="A4" style={styles.page}>
        <View>
          <View style={styles.headerRow}>
            <View>
              {header.name && <Text style={styles.name}>{header.name}</Text>}
              {header.subName && (
                <Text style={styles.subName}>{header.subName}</Text>
              )}
            </View>
            {header.birth && (
              <Text style={styles.birth}>생년월일 {header.birth}</Text>
            )}
          </View>
          {contactLine !== "" && (
            <Text style={styles.contactLine}>{contactLine}</Text>
          )}
          {linkLine !== "" && <Text style={styles.linkLine}>{linkLine}</Text>}
        </View>

        {doc.sections.map((section, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.entries.map((entry, ei) => (
              <Entry key={ei} entry={entry} />
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function renderResumePdf(doc: ResumeDocument): Promise<Blob> {
  ensureFonts();
  return pdf(<ResumePdfDocument doc={doc} />).toBlob();
}
