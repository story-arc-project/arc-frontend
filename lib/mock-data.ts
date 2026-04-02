import type { Folder, ExperienceWithFolder } from "@/types/archive";

export const MOCK_FOLDERS: Folder[] = [
  { id: "unclassified", name: "미분류", isSystem: true },
  { id: "folder-dev", name: "개발 관련", isSystem: false },
];

export const MOCK_EXPERIENCES: ExperienceWithFolder[] = [
  {
    id: "exp-1",
    user_id: "mock",
    templates_id: "sys-career",
    folderId: "folder-dev",
    raw_text: [
      { key: "company", label: "회사명", value: "카카오" },
      { key: "role", label: "직무/직책", value: "프론트엔드 개발자" },
      { key: "period", label: "근무 기간", value: "2023.03 ~ 2024.02" },
      { key: "description", label: "주요 업무", value: "웹 서비스 개발 및 유지보수" },
      { key: "motivation", label: "왜 이 활동을 했나요?", value: "" },
      { key: "takeaway", label: "무엇을 배웠나요?", value: "" },
    ],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-10T00:00:00Z",
  },
  {
    id: "exp-2",
    user_id: "mock",
    templates_id: "sys-activity",
    folderId: "unclassified",
    raw_text: [
      { key: "name", label: "활동명", value: "멋쟁이사자처럼 12기" },
      { key: "organization", label: "기관/단체명", value: "멋쟁이사자처럼" },
      { key: "period", label: "활동 기간", value: "2023.03 ~ 2023.11" },
      { key: "role", label: "역할", value: "프론트엔드 트랙" },
      { key: "description", label: "활동 내용", value: "" },
      { key: "motivation", label: "왜 이 활동을 했나요?", value: "" },
      { key: "takeaway", label: "무엇을 배웠나요?", value: "" },
    ],
    created_at: "2024-02-01T00:00:00Z",
    updated_at: "2024-02-01T00:00:00Z",
  },
];
