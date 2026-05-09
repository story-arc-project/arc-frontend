// 데모 모드 메모리 스토어.
// 브라우저 탭 단위로 휘발한다. 새로고침 시 모듈 재평가로 시드 상태로 자연 복귀한다.

import type { Experience, ExperienceSavePayload, ExperienceUpdatePayload } from "@/types/experience";
import type { LibraryDTO, LibraryUpsertPayload } from "@/lib/utils/library-mapper";
import type { ResumeVersion } from "@/types/resume";

import {
  seedExperiences,
  seedLibraries,
  seedLibraryMembership,
  seedResume,
} from "./seed";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let experiences: Experience[] = clone(seedExperiences);
let libraries: LibraryDTO[] = clone(seedLibraries);
const libraryMembership: Record<string, string[]> = clone(seedLibraryMembership);
const resume: ResumeVersion = clone(seedResume);

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
    return experiences.find((e) => e.id === id);
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
    return experiences.filter((e) => ids.includes(e.id));
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

// ─── Resume (read-only) ─────────────────────────────────────

export const resumeStore = {
  get(): ResumeVersion {
    return clone(resume);
  },
};
