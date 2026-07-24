// 데모 모드 메모리 스토어.
// 브라우저 탭 단위로 휘발한다. 새로고침 시 모듈 재평가로 시드 상태로 자연 복귀한다.

import type { Experience, ExperienceSavePayload, ExperienceUpdatePayload } from "@/types/experience";
import type { LibraryDTO, LibraryUpsertPayload } from "@/lib/utils/library-mapper";
import type { PresetDTO, PresetUpsertPayload } from "@/lib/utils/preset-mapper";
import type { ResumeListItem, ResumeVersion } from "@/types/resume";
import type { Portfolio } from "@/types/portfolio";

import { buildPortfolio } from "@/lib/portfolio/build-portfolio";
import type { CoverLetterListItem, CoverLetterResult } from "@/types/cover-letter";
import {
  seedCoverLetter,
  seedCoverLetterListItem,
  seedExperiences,
  seedLibraries,
  seedLibraryMembership,
  seedResume,
  seedResumeListItem,
} from "./seed";
import { DEMO_PORTFOLIO_ID, DEMO_PORTFOLIO_PROFILE } from "./portfolio-seed";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let experiences: Experience[] = clone(seedExperiences);
let libraries: LibraryDTO[] = clone(seedLibraries);
const libraryMembership: Record<string, string[]> = clone(seedLibraryMembership);
const resume: ResumeVersion = clone(seedResume);
let resumeList: ResumeListItem[] = [clone(seedResumeListItem)];
const coverLetter: CoverLetterResult = clone(seedCoverLetter);
let coverLetterList: CoverLetterListItem[] = [clone(seedCoverLetterListItem)];

let nextId = 1000;

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Experience ─────────────────────────────────────────────

export const experienceStore = {
  list(): Experience[] {
    return clone(experiences);
  },

  get(id: string): Experience | undefined {
    const found = experiences.find((e) => e.id === id);
    return found ? clone(found) : undefined;
  },

  create(payload: ExperienceSavePayload): string {
    const id = genId("demo-exp");
    const now = nowIso();
    const created: Experience = {
      id,
      user_id: "demo-user",
      type: payload.type,
      importance: payload.importance ?? null,
      content: (payload.content ?? {}) as Record<string, unknown>,
      created_at: now,
      updated_at: now,
    };
    experiences = [created, ...experiences];
    return id;
  },

  update(id: string, payload: ExperienceUpdatePayload): void {
    experiences = experiences.map((e) => {
      if (e.id !== id) return e;
      const next: Experience = {
        ...e,
        importance: payload.importance !== undefined ? payload.importance : e.importance,
        content: payload.content !== undefined ? (payload.content as Record<string, unknown>) : e.content,
        updated_at: nowIso(),
      };
      return next;
    });
  },

  delete(id: string): void {
    experiences = experiences.filter((e) => e.id !== id);
    Object.keys(libraryMembership).forEach((libId) => {
      libraryMembership[libId] = libraryMembership[libId].filter((eid) => eid !== id);
    });
  },

  duplicate(id: string): string {
    const src = experiences.find((e) => e.id === id);
    if (!src) throw new Error("not found");
    const newId = genId("demo-exp");
    const now = nowIso();
    const copied: Experience = {
      ...clone(src),
      id: newId,
      created_at: now,
      updated_at: now,
    };
    experiences = [copied, ...experiences];
    return newId;
  },
};

// ─── Library ────────────────────────────────────────────────

export const libraryStore = {
  list(): LibraryDTO[] {
    return clone(libraries);
  },

  experiencesIn(libraryId: string): Experience[] {
    const ids = libraryMembership[libraryId] ?? [];
    return clone(experiences.filter((e) => ids.includes(e.id)));
  },

  create(payload: LibraryUpsertPayload): string {
    const id = genId("demo-lib");
    const dto: LibraryDTO = {
      id,
      name: payload.name ?? "새 라이브러리",
      color: payload.color ?? null,
      icon: payload.icon ?? null,
      is_system: payload.is_system ?? false,
      filter: payload.filter ?? null,
    };
    libraries = [...libraries, dto];
    if (!libraryMembership[id]) libraryMembership[id] = [];
    return id;
  },

  update(id: string, payload: LibraryUpsertPayload): void {
    libraries = libraries.map((lib) => {
      if (lib.id !== id) return lib;
      return {
        ...lib,
        name: payload.name ?? lib.name,
        color: payload.color !== undefined ? payload.color : lib.color,
        icon: payload.icon !== undefined ? payload.icon : lib.icon,
        is_system: payload.is_system ?? lib.is_system,
        filter: payload.filter !== undefined ? payload.filter : lib.filter,
      };
    });
  },

  delete(id: string): void {
    libraries = libraries.filter((lib) => lib.id !== id);
    delete libraryMembership[id];
  },

  addExperience(libraryId: string, experienceId: string): void {
    const list = libraryMembership[libraryId] ?? [];
    if (!list.includes(experienceId)) {
      libraryMembership[libraryId] = [...list, experienceId];
    }
  },

  removeExperience(libraryId: string, experienceId: string): void {
    const list = libraryMembership[libraryId] ?? [];
    libraryMembership[libraryId] = list.filter((id) => id !== experienceId);
  },
};

// ─── Preset ─────────────────────────────────────────────────
// 시드는 비어있다. 사용자가 폼에서 만든 프리셋만 메모리에 누적된다.

let presets: PresetDTO[] = [];

export const presetStore = {
  list(): PresetDTO[] {
    return clone(presets);
  },

  get(id: string): PresetDTO | undefined {
    const found = presets.find((p) => p.id === id);
    return found ? clone(found) : undefined;
  },

  create(payload: PresetUpsertPayload): PresetDTO {
    const id = genId("demo-preset");
    const now = nowIso();
    const dto: PresetDTO = {
      id,
      name: payload.name ?? "새 프리셋",
      description: payload.description ?? null,
      blocks: payload.blocks ?? [],
      is_favorite: payload.is_favorite ?? false,
      created_at: now,
      updated_at: now,
    };
    presets = [...presets, dto];
    return clone(dto);
  },

  update(id: string, payload: PresetUpsertPayload): PresetDTO {
    const idx = presets.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("not found");
    const merged: PresetDTO = {
      ...presets[idx],
      name: payload.name ?? presets[idx].name,
      description: payload.description !== undefined ? payload.description : presets[idx].description,
      blocks: payload.blocks ?? presets[idx].blocks,
      is_favorite: payload.is_favorite ?? presets[idx].is_favorite,
      updated_at: nowIso(),
    };
    presets = presets.map((p, i) => (i === idx ? merged : p));
    return clone(merged);
  },

  delete(id: string): void {
    presets = presets.filter((p) => p.id !== id);
  },

  duplicate(id: string): string {
    const src = presets.find((p) => p.id === id);
    if (!src) throw new Error("not found");
    const newId = genId("demo-preset");
    const now = nowIso();
    const copied: PresetDTO = {
      ...clone(src),
      id: newId,
      created_at: now,
      updated_at: now,
    };
    presets = [...presets, copied];
    return newId;
  },
};

// ─── Resume ─────────────────────────────────────────────────

export const resumeStore = {
  get(): ResumeVersion {
    return clone(resume);
  },
  // 목록은 최신순. 실제 API 와 달리 결과 내용은 시드 하나를 공유한다.
  list(): ResumeListItem[] {
    return clone(resumeList);
  },
  create(): string {
    const newId = genId("demo-resume");
    const now = nowIso();
    resumeList = [{ version_id: newId, created_at: now, updated_at: now }, ...resumeList];
    return newId;
  },
};

// ─── Cover letter (FRT-140) ─────────────────────────────────
//
// 레쥬메 데모와 같은 태도다 — 목록은 늘어나지만 본문은 시드 하나를 공유한다. 데모의 목적은
// "생성이 정말 되는가"가 아니라 **화면과 흐름을 걸어보는 것**이기 때문이다.

export const coverLetterStore = {
  get(): CoverLetterResult {
    return clone(coverLetter);
  },
  list(): CoverLetterListItem[] {
    return clone(coverLetterList);
  },
  create(title?: string): string {
    const newId = genId("demo-cover-letter");
    const now = nowIso();
    coverLetterList = [
      {
        id: newId,
        created_at: now,
        updated_at: now,
        ...(title ? { title } : {}),
        status: "completed",
      },
      ...coverLetterList,
    ];
    return newId;
  },
  remove(id: string): void {
    coverLetterList = coverLetterList.filter((c) => c.id !== id);
  },
};

// ─── Portfolio (read-only) ──────────────────────────────────

export const portfolioStore = {
  get(): Portfolio {
    return buildPortfolio(DEMO_PORTFOLIO_ID, experienceStore.list(), DEMO_PORTFOLIO_PROFILE);
  },
};
