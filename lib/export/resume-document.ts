// ResumeVersion → 렌더러 중립 문서 모델(IR).
//
// 화면 미리보기(`_components/preview/*`)·PDF·DOCX 세 곳이 각자 섹션 규칙을 갖게 두면
// 규칙이 세 벌로 갈라진다. 섹션 순서·빈 항목 판정·표기 규칙은 여기 한 곳에 두고
// 렌더러는 이 모델만 그린다.

import {
  compactStrings,
  formatEducationPeriod,
  formatGpa,
  formatPeriod,
  joinParts,
} from "@/lib/export/resume-format";
import {
  isEmptySection,
  type ResumeLanguage,
  type ResumeVersion,
} from "@/types/resume";

export interface DocBulletGroup {
  label?: string;
  items: string[];
}

export interface DocNote {
  label?: string;
  text: string;
}

export interface DocEntry {
  /** 항목 이름 — 회사명·학교명·프로젝트명 등. */
  title?: string;
  /** 항목 부제 — 부서·직위·역할 등을 가운뎃점으로 이은 줄. */
  subtitle?: string;
  /** 부제 아래 보조 정보 — 학점·비고. */
  detail?: string;
  /** 우측에 붙는 기간·시점. */
  meta?: string;
  /** 문단형 본문 — 자기소개, 수상 설명. */
  text?: string;
  bulletGroups?: DocBulletGroup[];
  /** 불릿 뒤에 붙는 라벨 달린 한 줄 — "사용 기술: …". */
  notes?: DocNote[];
}

export interface DocSection {
  title: string;
  entries: DocEntry[];
}

export interface ResumeDocumentHeader {
  name?: string;
  subName?: string;
  birth?: string;
  contacts: string[];
  links: { label?: string; url: string }[];
}

export interface ResumeDocument {
  header: ResumeDocumentHeader;
  sections: DocSection[];
  language: ResumeLanguage;
}

// ─── helpers ───────────────────────────────────────────────────────

function text(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? undefined : trimmed;
}

function bulletGroup(
  items: readonly string[] | null | undefined,
  label?: string,
): DocBulletGroup | null {
  const compacted = compactStrings(items);
  if (compacted.length === 0) return null;
  return label ? { label, items: compacted } : { items: compacted };
}

function withGroups(entry: DocEntry, groups: (DocBulletGroup | null)[]): DocEntry {
  const kept = groups.filter((g): g is DocBulletGroup => g !== null);
  return kept.length > 0 ? { ...entry, bulletGroups: kept } : entry;
}

/** 항목이 남아 있을 때만 섹션을 만든다 — 빈 섹션 제목이 문서에 뜨지 않게. */
function section(title: string, entries: DocEntry[]): DocSection | null {
  return entries.length > 0 ? { title, entries } : null;
}

/** 미리보기와 같은 규칙: 배열 자체가 비었거나 모든 항목이 비면 통째로 버린다. */
function usableItems<T>(items: T[] | null | undefined): T[] {
  if (!items || isEmptySection(items)) return [];
  return items.filter((item) => !isEmptySection(item));
}

// ─── build ─────────────────────────────────────────────────────────

export function buildResumeDocument(resume: ResumeVersion): ResumeDocument {
  const 인적사항 = resume.인적사항;
  const 요약 = text(resume.자기소개_요약);

  const header: ResumeDocumentHeader = {
    name: text(인적사항?.이름),
    subName: text(인적사항?.영문명),
    birth: text(인적사항?.생년월일),
    contacts: compactStrings([
      인적사항?.이메일 ?? "",
      인적사항?.전화번호 ?? "",
      인적사항?.주소 ?? "",
    ]),
    links: (인적사항?.링크 ?? [])
      .filter((link) => link && text(link.url))
      .map((link) => {
        const label = text(link.label);
        const url = (link.url ?? "").trim();
        return label ? { label, url } : { url };
      }),
  };

  const sections: (DocSection | null)[] = [
    section("자기소개", 요약 ? [{ text: 요약 }] : []),

    section(
      "학력",
      usableItems(resume.학력).map((edu) => ({
        title: text(edu.학교명),
        subtitle: text(joinParts([edu.학과, edu.전공구분, edu.학위, edu.졸업구분])),
        detail: text(
          [formatGpa(edu), text(edu.비고)].filter(Boolean).join("  ·  "),
        ),
        meta: text(formatEducationPeriod(edu)),
      })),
    ),

    section(
      "경력",
      usableItems(resume.경력).map((career) =>
        withGroups(
          {
            title: text(career.회사명),
            subtitle: text(joinParts([career.부서, career.직위, career.고용형태])),
            meta: text(
              formatPeriod(
                career.입사년월,
                career.퇴사년월,
                null,
                career.재직중,
              ),
            ),
          },
          [bulletGroup(career.담당업무), bulletGroup(career.성과, "성과")],
        ),
      ),
    ),

    section(
      "프로젝트",
      usableItems(resume.프로젝트).map((project) => {
        const entry = withGroups(
          {
            title: text(project.프로젝트명),
            subtitle: text(joinParts([project.소속기관, project.역할])),
            meta: text(
              formatPeriod(
                project.기간_시작,
                project.기간_종료,
                project.기간_원문,
              ),
            ),
          },
          [bulletGroup(project.내용), bulletGroup(project.성과, "성과")],
        );

        const tech = compactStrings(project.사용기술);
        return tech.length > 0
          ? { ...entry, notes: [{ label: "사용 기술", text: tech.join(", ") }] }
          : entry;
      }),
    ),

    section(
      "대외활동",
      usableItems(resume.대외활동).map((activity) =>
        withGroups(
          {
            title: text(activity.활동명),
            subtitle: text(joinParts([activity.기관, activity.역할])),
            meta: text(
              formatPeriod(
                activity.기간_시작,
                activity.기간_종료,
                activity.기간_원문,
                activity.진행중,
              ),
            ),
          },
          [bulletGroup(activity.활동내용), bulletGroup(activity.성과, "성과")],
        ),
      ),
    ),

    section(
      "동아리 · 학회",
      usableItems(resume.동아리_학회).map((club) =>
        withGroups(
          {
            title: text(club.단체명),
            subtitle: text(joinParts([club.구분, club.역할])),
            meta: text(club.기간_원문),
          },
          [bulletGroup(club.활동내용)],
        ),
      ),
    ),

    section(
      "수상",
      usableItems(resume.수상).map((award) => ({
        title: text(award.수상명),
        subtitle: text(award.수여기관),
        text: text(award.내용),
        meta: text(award.수상년월),
      })),
    ),

    section(
      "자격증",
      usableItems(resume.자격증).map((cert) => ({
        title: text(cert.자격증명),
        subtitle: text(joinParts([cert.발급기관, cert.자격구분])),
        meta: text(cert.취득년월),
      })),
    ),

    section(
      "어학",
      usableItems(resume.어학).map((lang) => ({
        title: text(lang.언어),
        subtitle: text(joinParts([lang.시험명, lang.점수등급])),
        meta: text(lang.취득년월),
      })),
    ),

    section("기술 및 역량", buildSkillEntries(resume)),
  ];

  return {
    header,
    sections: sections.filter((s): s is DocSection => s !== null),
    language: resume.meta?.language ?? "ko",
  };
}

function buildSkillEntries(resume: ResumeVersion): DocEntry[] {
  const skills = resume.기술및역량;
  if (!skills || isEmptySection(skills)) return [];

  return (
    [
      { title: "기술 스택", items: skills.기술스택 },
      { title: "툴", items: skills.툴 },
      { title: "소프트 스킬", items: skills.소프트스킬 },
    ] as const
  )
    .map(({ title, items }) => ({ title, values: compactStrings(items) }))
    .filter(({ values }) => values.length > 0)
    .map(({ title, values }) => ({ title, text: values.join(", ") }));
}
