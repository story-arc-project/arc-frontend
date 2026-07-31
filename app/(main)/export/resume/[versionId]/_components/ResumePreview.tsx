"use client";

import type { ResumeVersion } from "@/types/resume";
import { resumeSectionLabels } from "@/lib/export/resume-labels";
import { PreviewPersonalInfo } from "./preview/PreviewPersonalInfo";
import { PreviewAdditionalInfo } from "./preview/PreviewAdditionalInfo";
import { PreviewPublication } from "./preview/PreviewPublication";
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
  // 섹션 제목은 레쥬메 언어를 따른다(FRT-147). 하위 컴포넌트는 언어를 모르고 제목만 받는다 —
  // 11 곳이 각자 언어를 판정하면 그때부터 규칙이 열한 벌로 갈라진다.
  const L = resumeSectionLabels(resume.meta?.language);

  return (
    <article className="resume-preview mx-auto max-w-[210mm] rounded-sm bg-surface p-10 shadow-sm">
      <PreviewPersonalInfo data={resume.인적사항} />
      <PreviewSummary title={L.summary} data={resume.자기소개_요약} />
      <PreviewEducation title={L.education} data={resume.학력} />
      <PreviewCareer title={L.career} data={resume.경력} />
      <PreviewProject title={L.project} data={resume.프로젝트} />
      <PreviewActivity title={L.activity} data={resume.대외활동} />
      <PreviewClub title={L.club} data={resume.동아리_학회} />
      <PreviewAward title={L.award} data={resume.수상} />
      <PreviewPublication title={L.publication} data={resume.논문} />
      <PreviewCertification title={L.certification} data={resume.자격증} />
      <PreviewLanguage title={L.language} data={resume.어학} />
      <PreviewSkills title={L.skills} data={resume.기술및역량} />
      <PreviewAdditionalInfo title={L.additionalInfo} data={resume.기타정보} />
    </article>
  );
}
