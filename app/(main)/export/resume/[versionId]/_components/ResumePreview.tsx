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
  // 섹션 제목·엔트리 안쪽 라벨을 레쥬메 언어로 고른다(FRT-147). 하위 컴포넌트는 언어를
  // 모르고 라벨 표만 받는다 — 12 곳이 각자 언어를 판정하면 규칙이 열두 벌로 갈라진다.
  const L = resumeSectionLabels(resume.meta?.language);

  return (
    <article className="resume-preview mx-auto max-w-[210mm] rounded-sm bg-surface p-10 shadow-sm">
      <PreviewPersonalInfo data={resume.인적사항} />
      <PreviewSummary labels={L} data={resume.자기소개_요약} />
      <PreviewEducation labels={L} data={resume.학력} />
      <PreviewCareer labels={L} data={resume.경력} />
      <PreviewProject labels={L} data={resume.프로젝트} />
      <PreviewActivity labels={L} data={resume.대외활동} />
      <PreviewClub labels={L} data={resume.동아리_학회} />
      <PreviewAward labels={L} data={resume.수상} />
      <PreviewPublication labels={L} data={resume.논문} />
      <PreviewCertification labels={L} data={resume.자격증} />
      <PreviewLanguage labels={L} data={resume.어학} />
      <PreviewSkills labels={L} data={resume.기술및역량} />
      <PreviewAdditionalInfo labels={L} data={resume.기타정보} />
    </article>
  );
}
