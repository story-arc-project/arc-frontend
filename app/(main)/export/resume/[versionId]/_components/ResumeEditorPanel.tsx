"use client";

import type { ResumeVersion } from "@/types/resume";
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
  const patch = <K extends keyof ResumeVersion>(
    key: K,
    value: ResumeVersion[K],
  ) => {
    onChange({ ...resume, [key]: value });
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionAccordion title="인적사항" defaultOpen>
        <PersonalInfoEditor
          value={resume.인적사항}
          onChange={(v) => patch("인적사항", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="자기소개">
        <SummaryEditor
          value={resume.자기소개_요약}
          onChange={(v) => patch("자기소개_요약", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="학력" itemCount={resume.학력.length}>
        <EducationListEditor
          value={resume.학력}
          onChange={(v) => patch("학력", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="경력" itemCount={resume.경력.length}>
        <CareerListEditor
          value={resume.경력}
          onChange={(v) => patch("경력", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="프로젝트" itemCount={resume.프로젝트.length}>
        <ProjectListEditor
          value={resume.프로젝트}
          onChange={(v) => patch("프로젝트", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="대외활동" itemCount={resume.대외활동.length}>
        <ActivityListEditor
          value={resume.대외활동}
          onChange={(v) => patch("대외활동", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="동아리 · 학회" itemCount={resume.동아리_학회.length}>
        <ClubListEditor
          value={resume.동아리_학회}
          onChange={(v) => patch("동아리_학회", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="수상" itemCount={resume.수상.length}>
        <AwardListEditor
          value={resume.수상}
          onChange={(v) => patch("수상", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="자격증" itemCount={resume.자격증.length}>
        <CertificationListEditor
          value={resume.자격증}
          onChange={(v) => patch("자격증", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="어학" itemCount={resume.어학.length}>
        <LanguageListEditor
          value={resume.어학}
          onChange={(v) => patch("어학", v)}
        />
      </SectionAccordion>

      <SectionAccordion title="기술 및 역량">
        <SkillsEditor
          value={resume.기술및역량}
          onChange={(v) => patch("기술및역량", v)}
        />
      </SectionAccordion>
    </div>
  );
}
