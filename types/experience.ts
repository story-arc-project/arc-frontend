// ─── Experience API Types ──────────────────────────────────────

import type { ApiSuccessResponse, ApiErrorResponse, ApiResponse } from "./api";

export type { ApiSuccessResponse, ApiErrorResponse, ApiResponse };

// Experience 엔티티 (API 응답 형태)
export interface Experience {
  id: string;
  user_id: string;
  type: string;
  importance: number | null;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// 목록 응답
export interface ExperienceListData {
  count: number;
  contents: Experience[];
}

// 생성 요청 body
export interface ExperienceSavePayload {
  type: string;
  importance?: number | null;
  content: Record<string, unknown>;
}

// 수정 요청 body (type 제외)
export interface ExperienceUpdatePayload {
  importance?: number | null;
  content?: Record<string, unknown>;
}
