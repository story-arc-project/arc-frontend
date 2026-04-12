import { api } from "./client";
import type {
  AnalysisHomeSummary,
  AnalysisSnapshot,
  AnalysisStatus,
  IndividualAnalysisResult,
  ComprehensiveAnalysisResult,
  KeywordAnalysisResult,
  KeywordSuggestion,
  BookmarkedSnapshot,
  SelectableExperience,
} from "@/types/analysis";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

async function mock<T>(loader: () => Promise<T>): Promise<T> {
  // simulate network delay
  await new Promise((r) => setTimeout(r, 300));
  return loader();
}

function mocks() {
  return import("./mocks/analysis");
}

// ─── Analysis Home ──────────────────────────────────────────

export function getAnalysisHomeSummary(): Promise<AnalysisHomeSummary> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockAnalysisHomeSummary);
  return api.get<AnalysisHomeSummary>("/api/analysis/home/summary");
}

// ─── Individual ─────────────────────────────────────────────

export function getIndividualAnalysisList(params?: {
  status?: string;
}): Promise<AnalysisSnapshot[]> {
  if (USE_MOCK)
    return mock(async () => {
      const { mockIndividualAnalysisList } = await mocks();
      if (params?.status && params.status !== "all")
        return mockIndividualAnalysisList.filter((s) => s.status === params.status);
      return mockIndividualAnalysisList;
    });
  const qs = params?.status && params.status !== "all" ? `?status=${params.status}` : "";
  return api.get<AnalysisSnapshot[]>(`/api/analysis/individual${qs}`);
}

export function getIndividualAnalysisResult(
  analysisId: string
): Promise<IndividualAnalysisResult> {
  if (USE_MOCK)
    return mock(async () => (await mocks()).mockIndividualAnalysisResult);
  return api.get<IndividualAnalysisResult>(
    `/api/analysis/individual/${analysisId}`
  );
}

// ─── Comprehensive ──────────────────────────────────────────

export function getComprehensiveList(): Promise<AnalysisSnapshot[]> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockComprehensiveList);
  return api.get<AnalysisSnapshot[]>("/api/analysis/comprehensive");
}

export function createComprehensiveAnalysis(request: {
  experienceIds: string[];
  scenario?: string;
}): Promise<{ analysisId: string }> {
  if (USE_MOCK)
    return mock(async () => ({ analysisId: "comp-new-" + Date.now() }));
  return api.post<{ analysisId: string }>(
    "/api/analysis/comprehensive",
    request
  );
}

export function getComprehensiveResult(
  analysisId: string
): Promise<ComprehensiveAnalysisResult> {
  if (USE_MOCK)
    return mock(async () => (await mocks()).mockComprehensiveResult);
  return api.get<ComprehensiveAnalysisResult>(
    `/api/analysis/comprehensive/${analysisId}`
  );
}

export function getAnalysisStatus(
  analysisId: string
): Promise<{ status: AnalysisStatus }> {
  if (USE_MOCK) return mock(async () => ({ status: "completed" as const }));
  return api.get<{ status: AnalysisStatus }>(
    `/api/analysis/status/${analysisId}`
  );
}

export function deleteComprehensiveAnalysis(
  analysisId: string
): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  return api.delete(`/api/analysis/comprehensive/${analysisId}`);
}

// ─── Keyword ────────────────────────────────────────────────

export function getKeywordSuggestions(): Promise<KeywordSuggestion[]> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockKeywordSuggestions);
  return api.get<KeywordSuggestion[]>("/api/analysis/keyword/suggestions");
}

export function getKeywordList(): Promise<AnalysisSnapshot[]> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockKeywordList);
  return api.get<AnalysisSnapshot[]>("/api/analysis/keyword");
}

export function createKeywordAnalysis(request: {
  keywords: { label: string; category: string }[];
  experienceIds?: string[];
  scenario?: string;
}): Promise<{ analysisId: string }> {
  if (USE_MOCK)
    return mock(async () => ({ analysisId: "kw-new-" + Date.now() }));
  return api.post<{ analysisId: string }>("/api/analysis/keyword", request);
}

export function getKeywordResult(
  analysisId: string
): Promise<KeywordAnalysisResult> {
  if (USE_MOCK) return mock(async () => (await mocks()).mockKeywordResult);
  return api.get<KeywordAnalysisResult>(
    `/api/analysis/keyword/${analysisId}`
  );
}

export function deleteKeywordAnalysis(analysisId: string): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  return api.delete(`/api/analysis/keyword/${analysisId}`);
}

// ─── Bookmarks ──────────────────────────────────────────────

export function getBookmarks(params?: {
  type?: string;
}): Promise<BookmarkedSnapshot[]> {
  if (USE_MOCK)
    return mock(async () => {
      const { mockBookmarks } = await mocks();
      if (params?.type && params.type !== "all")
        return mockBookmarks.filter((b) => b.type === params.type);
      return mockBookmarks;
    });
  const qs = params?.type && params.type !== "all" ? `?type=${params.type}` : "";
  return api.get<BookmarkedSnapshot[]>(`/api/analysis/bookmarks${qs}`);
}

export function addBookmark(analysisId: string): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  return api.post(`/api/analysis/bookmarks`, { analysisId });
}

export function removeBookmark(analysisId: string): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  return api.delete(`/api/analysis/bookmarks/${analysisId}`);
}

// ─── History ────────────────────────────────────────────────

export function getAnalysisHistory(params?: {
  type?: string;
  sort?: "newest" | "oldest";
}): Promise<AnalysisSnapshot[]> {
  if (USE_MOCK)
    return mock(async () => {
      const { mockHistory } = await mocks();
      let result = [...mockHistory];
      if (params?.type && params.type !== "all")
        result = result.filter((s) => s.type === params.type);
      if (params?.sort === "oldest") result.reverse();
      return result;
    });
  const qs = new URLSearchParams();
  if (params?.type && params.type !== "all") qs.set("type", params.type);
  if (params?.sort) qs.set("sort", params.sort);
  const query = qs.toString();
  return api.get<AnalysisSnapshot[]>(
    `/api/analysis/history${query ? `?${query}` : ""}`
  );
}

export function updateAnalysisMeta(
  analysisId: string,
  data: { title: string }
): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  return api.patch(`/api/analysis/${analysisId}`, data);
}

export function deleteAnalysis(analysisId: string): Promise<void> {
  if (USE_MOCK) return mock(async () => undefined);
  return api.delete(`/api/analysis/${analysisId}`);
}

// ─── Selectable Experiences ─────────────────────────────────

export function getSelectableExperiences(): Promise<SelectableExperience[]> {
  if (USE_MOCK)
    return mock(async () => (await mocks()).mockSelectableExperiences);
  return api.get("/api/analysis/experiences/selectable");
}
