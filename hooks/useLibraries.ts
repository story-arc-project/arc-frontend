"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  addExperienceToLibrary as apiAddExperienceToLibrary,
  createLibrary as apiCreateLibrary,
  deleteLibrary as apiDeleteLibrary,
  getLibraries,
  getLibraryExperiences,
  removeExperienceFromLibrary as apiRemoveExperienceFromLibrary,
  updateLibrary as apiUpdateLibrary,
} from "@/lib/api/library-api";
import {
  ALL_LIBRARY_ID,
  createAllLibrary,
  toLibrary,
} from "@/lib/utils/library-mapper";
import type { Library, LibraryFilter } from "@/types/archive";

interface UseLibrariesMutationInput {
  name: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
  filter?: LibraryFilter;
}

interface UseLibrariesUpdateInput {
  name?: string;
  color?: string;
  icon?: string;
  filter?: LibraryFilter;
}

export function useLibraries() {
  const [libraries, setLibraries] = useState<Library[]>([createAllLibrary()]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [loadingMembershipIds, setLoadingMembershipIds] = useState<Set<string>>(() => new Set());
  const [loadedMembershipIds, setLoadedMembershipIds] = useState<Set<string>>(() => new Set());
  const [membershipErrorIds, setMembershipErrorIds] = useState<Set<string>>(() => new Set());
  const loadedMembershipRef = useRef<Set<string>>(new Set());
  const refetchVersionRef = useRef(0);

  const refetch = useCallback(async () => {
    const version = ++refetchVersionRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const libraryDTOs = await getLibraries();
      if (version !== refetchVersionRef.current) return;

      const mappedLibraries = libraryDTOs
        .map((library) => toLibrary(library))
        .filter((library) => library.id !== ALL_LIBRARY_ID);

      loadedMembershipRef.current = new Set();
      setLoadedMembershipIds(new Set());
      setMembershipErrorIds(new Set());
      setLibraries([createAllLibrary(), ...mappedLibraries]);
    } catch (err) {
      if (version !== refetchVersionRef.current) return;
      setError(err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."));
    } finally {
      if (version === refetchVersionRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadLibraryMembership = useCallback(
    async (libraryId: string): Promise<void> => {
      if (libraryId === ALL_LIBRARY_ID) return;
      if (loadedMembershipRef.current.has(libraryId)) return;
      loadedMembershipRef.current.add(libraryId);
      // Pin this call to the refetch generation that started it. If a later
      // refetch bumps the version before we resolve, we drop our result so a
      // stale membership response can't overwrite fresh state.
      const version = refetchVersionRef.current;
      setLoadingMembershipIds((prev) => {
        const next = new Set(prev);
        next.add(libraryId);
        return next;
      });
      setMembershipErrorIds((prev) => {
        if (!prev.has(libraryId)) return prev;
        const next = new Set(prev);
        next.delete(libraryId);
        return next;
      });
      let succeeded = false;
      try {
        const data = await getLibraryExperiences(libraryId);
        if (version !== refetchVersionRef.current) return;
        const ids = data.contents.map((experience) => experience.id);
        setLibraries((prev) =>
          prev.map((library) =>
            library.id === libraryId ? { ...library, experienceIds: ids } : library,
          ),
        );
        succeeded = true;
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[useLibraries] loadLibraryMembership failed", libraryId, err);
        }
      } finally {
        if (version === refetchVersionRef.current) {
        setLoadingMembershipIds((prev) => {
          if (!prev.has(libraryId)) return prev;
          const next = new Set(prev);
          next.delete(libraryId);
          return next;
        });
        if (succeeded) {
          setLoadedMembershipIds((prev) => {
            if (prev.has(libraryId)) return prev;
            const next = new Set(prev);
            next.add(libraryId);
            return next;
          });
        } else {
          // Failure: do NOT mark as loaded — that would ship an empty library
          // as if it were real. Record the error so the UI can render a retry
          // affordance. The ref stays set so useEffect won't auto-loop; the
          // user must call retryLibraryMembership() to try again.
          setMembershipErrorIds((prev) => {
            if (prev.has(libraryId)) return prev;
            const next = new Set(prev);
            next.add(libraryId);
            return next;
          });
        }
        }
      }
    },
    [],
  );

  // Eager-load membership for every manual library so ExperienceCard can
  // render library-indicator badges and the "move to library" submenu's
  // checked state for non-active libraries. Without this, cards on the
  // default "전체" view never show which libraries an experience belongs to,
  // and clicking an already-member library in the submenu sends a duplicate
  // add request. Deduped via loadedMembershipRef, and re-triggered after
  // refetch() (which clears the ref) so create/update/delete stay in sync.
  useEffect(() => {
    libraries.forEach((library) => {
      if (library.id === ALL_LIBRARY_ID) return;
      if (library.filter) return;
      if (loadedMembershipRef.current.has(library.id)) return;
      void loadLibraryMembership(library.id);
    });
  }, [libraries, loadLibraryMembership]);

  const retryLibraryMembership = useCallback(
    async (libraryId: string): Promise<void> => {
      if (libraryId === ALL_LIBRARY_ID) return;
      loadedMembershipRef.current.delete(libraryId);
      setMembershipErrorIds((prev) => {
        if (!prev.has(libraryId)) return prev;
        const next = new Set(prev);
        next.delete(libraryId);
        return next;
      });
      await loadLibraryMembership(libraryId);
    },
    [loadLibraryMembership],
  );

  const createLibrary = useCallback(
    async (payload: UseLibrariesMutationInput): Promise<void> => {
      await apiCreateLibrary(payload);
      await refetch();
    },
    [refetch],
  );

  const updateLibrary = useCallback(
    async (id: string, payload: UseLibrariesUpdateInput): Promise<void> => {
      await apiUpdateLibrary(id, payload);
      await refetch();
    },
    [refetch],
  );

  const deleteLibrary = useCallback(
    async (id: string): Promise<void> => {
      await apiDeleteLibrary(id);
      await refetch();
    },
    [refetch],
  );

  const markMembershipLoaded = useCallback((libraryId: string) => {
    loadedMembershipRef.current.add(libraryId);
    setLoadedMembershipIds((prev) => {
      if (prev.has(libraryId)) return prev;
      const next = new Set(prev);
      next.add(libraryId);
      return next;
    });
    setMembershipErrorIds((prev) => {
      if (!prev.has(libraryId)) return prev;
      const next = new Set(prev);
      next.delete(libraryId);
      return next;
    });
  }, []);

  const addExperienceToLibrary = useCallback(
    async (libraryId: string, experienceId: string): Promise<void> => {
      await apiAddExperienceToLibrary(libraryId, experienceId);
      // Bump the version so any in-flight loadLibraryMembership() pinned to
      // the prior version drops its (now-stale) server snapshot instead of
      // stomping this optimistic add.
      refetchVersionRef.current += 1;
      setLibraries((prev) =>
        prev.map((library) => {
          if (library.id !== libraryId) return library;
          if (library.experienceIds.includes(experienceId)) return library;
          return { ...library, experienceIds: [...library.experienceIds, experienceId] };
        }),
      );
      markMembershipLoaded(libraryId);
    },
    [markMembershipLoaded],
  );

  const removeExperienceFromLibrary = useCallback(
    async (libraryId: string, experienceId: string): Promise<void> => {
      await apiRemoveExperienceFromLibrary(libraryId, experienceId);
      refetchVersionRef.current += 1;
      setLibraries((prev) =>
        prev.map((library) =>
          library.id === libraryId
            ? {
                ...library,
                experienceIds: library.experienceIds.filter((id) => id !== experienceId),
              }
            : library,
        ),
      );
      markMembershipLoaded(libraryId);
    },
    [markMembershipLoaded],
  );

  return {
    libraries,
    isLoading,
    error,
    refetch,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    addExperienceToLibrary,
    removeExperienceFromLibrary,
    loadLibraryMembership,
    retryLibraryMembership,
    loadingMembershipIds,
    loadedMembershipIds,
    membershipErrorIds,
  };
}
