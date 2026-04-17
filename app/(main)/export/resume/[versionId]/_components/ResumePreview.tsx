"use client";

import type { ResumeVersion } from "@/types/resume";
import { PreviewPersonalInfo } from "./preview/PreviewPersonalInfo";
import { PreviewSummary } from "./preview/PreviewSummary";
import { PreviewEducation } from "./preview/PreviewEducation";
import { PreviewCareer } from "./preview/PreviewCareer";
import { PreviewProject } from "./preview/PreviewProject";
import { PreviewActivity } from "./preview/PreviewActivity";
import { PreviewClub } from "./preview/PreviewClub";
import { PreviewAward } from "./preview/PreviewAward";
import { PreviewCertification } from "./preview/PreviewCertification";
import { PreviewLanguage } from "./preview/PreviewLanguage";
import { PreviewSkills } from "./preview/PreviewSkills";

interface ResumePreviewProps {
  resume: ResumeVersion;
}

export function ResumePreview({ resume }: ResumePreviewProps) {
  return (
    <article className="resume-preview mx-auto max-w-[210mm] rounded-sm bg-surface p-10 shadow-sm">
      <PreviewPersonalInfo data={resume.인적사항} />
      <PreviewSummary data={resume.자기소개_요약} />
      <PreviewEducation data={resume.학력} />
      <PreviewCareer data={resume.경력} />
      <PreviewProject data={resume.프로젝트} />
      <PreviewActivity data={resume.대외활동} />
      <PreviewClub data={resume.동아리_학회} />
      <PreviewAward data={resume.수상} />
      <PreviewCertification data={resume.자격증} />
      <PreviewLanguage data={resume.어학} />
      <PreviewSkills data={resume.기술및역량} />
    </article>
  );
}
