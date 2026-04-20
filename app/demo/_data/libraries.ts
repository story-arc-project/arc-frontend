import type { Library } from "@/types/archive";
import { ALL_LIBRARY_ID } from "@/lib/utils/library-mapper";

export const demoLibraries: Library[] = [
  {
    id: ALL_LIBRARY_ID,
    name: "전체",
    isSystem: true,
    experienceIds: [],
  },
  {
    id: "lib-marketing",
    name: "마케팅 커리어",
    color: "#fb8408",
    icon: "Target",
    isSystem: false,
    experienceIds: ["exp-1", "exp-3", "exp-4", "exp-6"],
  },
  {
    id: "lib-leadership",
    name: "리더십 증거",
    color: "#6b5dfb",
    icon: "Users",
    isSystem: false,
    experienceIds: ["exp-2", "exp-7", "exp-9"],
  },
  {
    id: "lib-analytics",
    name: "데이터 분석",
    color: "#12b886",
    icon: "BarChart3",
    isSystem: false,
    experienceIds: ["exp-4", "exp-6", "exp-1"],
  },
];
