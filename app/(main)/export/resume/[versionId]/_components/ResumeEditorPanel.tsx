"use client";

import type { ResumeVersion } from "@/types/resume";
import { resumeSectionLabels } from "@/lib/export/resume-labels";
import { SectionAccordion } from "./SectionAccordion";
import { PersonalInfoEditor } from "./editors/PersonalInfoEditor";
import { SummaryEditor } from "./editors/SummaryEditor";
import { EducationListEditor } from "./editors/EducationListEditor";
import { CareerListEditor } from "./editors/CareerListEditor";
import { ProjectListEditor } from "./editors/ProjectListEditor";
import { ActivityListEditor } from "./editors/ActivityListEditor";
import { ClubListEditor } from "./editors/ClubListEditor";
import { AwardListEditor } from "./editors/AwardListEditor";
import { CertificationListEditor } from "./editors/CertificationListEditor";
import { LanguageListEditor } from "./editors/LanguageListEditor";
import { SkillsEditor } from "./editors/SkillsEditor";

interface Props {
  resume: ResumeVersion;
  onChange: (next: ResumeVersion) => void;
}

export function ResumeEditorPanel({ resume, onChange }: Props) {
  // 아코디언 제목도 프리뷰와 같은 라벨을 쓴다(FRT-147). 안쪽 입력 필드 라벨은
  // 이번 범위 밖이라 국문 그대로다 — 영문 편집은 D1 에 따라 아직 열리지 않는다.
  const L = resumeSectionLabels(resume.meta?.language);

  const patch = <K extends keyof ResumeVersion>(
    key: K,
    value: ResumeVersion[K],
  ) => {
    onChange({ ...resume, [key]: value });
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionAccordion title={L.personalInfo} defaultOpen>
        <PersonalInfoEditor
          value={resume.인적사항}
          onChange={(v) => patch("인적사항", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.summary}>
        <SummaryEditor
          value={resume.자기소개_요약}
          onChange={(v) => patch("자기소개_요약", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.education} itemCount={resume.학력.length}>
        <EducationListEditor
          value={resume.학력}
          onChange={(v) => patch("학력", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.career} itemCount={resume.경력.length}>
        <CareerListEditor
          value={resume.경력}
          onChange={(v) => patch("경력", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.project} itemCount={resume.프로젝트.length}>
        <ProjectListEditor
          value={resume.프로젝트}
          onChange={(v) => patch("프로젝트", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.activity} itemCount={resume.대외활동.length}>
        <ActivityListEditor
          value={resume.대외활동}
          onChange={(v) => patch("대외활동", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.club} itemCount={resume.동아리_학회.length}>
        <ClubListEditor
          value={resume.동아리_학회}
          onChange={(v) => patch("동아리_학회", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.award} itemCount={resume.수상.length}>
        <AwardListEditor
          value={resume.수상}
          onChange={(v) => patch("수상", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.certification} itemCount={resume.자격증.length}>
        <CertificationListEditor
          value={resume.자격증}
          onChange={(v) => patch("자격증", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.language} itemCount={resume.어학.length}>
        <LanguageListEditor
          value={resume.어학}
          onChange={(v) => patch("어학", v)}
        />
      </SectionAccordion>

      <SectionAccordion title={L.skills}>
        <SkillsEditor
          value={resume.기술및역량}
          onChange={(v) => patch("기술및역량", v)}
        />
      </SectionAccordion>
    </div>
  );
}
