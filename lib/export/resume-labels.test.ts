import { describe, it, expect } from "vitest";

import { resumeSectionLabels } from "@/lib/export/resume-labels";

describe("resumeSectionLabels", () => {
  it("국문 라벨이 현행 화면 문자열과 정확히 같다", () => {
    // 라벨 도입만으로 국문 출력이 바뀌면 안 된다. 이 값들은 Preview*/ResumeEditorPanel/
    // resume-document 에 하드코딩돼 있던 것을 그대로 옮긴 것이다.
    const ko = resumeSectionLabels("ko");
    expect(ko).toEqual({
      personalInfo: "인적사항",
      summary: "자기소개",
      education: "학력",
      career: "경력",
      project: "프로젝트",
      activity: "대외활동",
      club: "동아리 · 학회",
      award: "수상",
      certification: "자격증",
      language: "어학",
      skills: "기술 및 역량",
      additionalInfo: "기타정보",
      publication: "논문",
      achievements: "성과",
      techStack: "사용 기술",
      skillTech: "기술 스택",
      skillTools: "툴",
      skillSoft: "소프트 스킬",
      military: "병역",
      interests: "관심사",
      present: "현재",
    });
  });

  it("영문은 서구권 CV 제목을 쓴다", () => {
    const en = resumeSectionLabels("en");
    expect(en.career).toBe("Work Experience");
    expect(en.education).toBe("Education");
    expect(en.language).toBe("Languages");
    expect(en.skills).toBe("Skills");
    expect(en.publication).toBe("Publications");
    expect(en.additionalInfo).toBe("Additional Information");
    // 섹션 제목만 바꾸면 엔트리 안쪽에 "성과"·"기술 스택"이 한국어로 남는다.
    expect(en.achievements).toBe("Achievements");
    expect(en.techStack).toBe("Tech Stack");
    expect(en.skillTech).toBe("Technical");
    expect(en.military).toBe("Military Service");
    // 기간의 종료 자리도 라벨이다 — 여기가 비면 영문 CV 에 "2024-01 – 현재" 가 남는다.
    expect(en.present).toBe("Present");
  });

  it("언어를 모르면 국문으로 폴백한다", () => {
    // meta 가 없는 구 응답이 영문 제목을 보게 되면 안 된다.
    expect(resumeSectionLabels(null)).toEqual(resumeSectionLabels("ko"));
    expect(resumeSectionLabels(undefined)).toEqual(resumeSectionLabels("ko"));
  });

  it("두 언어가 같은 키 집합을 갖는다", () => {
    expect(Object.keys(resumeSectionLabels("en")).sort()).toEqual(
      Object.keys(resumeSectionLabels("ko")).sort(),
    );
  });
});
