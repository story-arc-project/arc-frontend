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
  // 멤버십 mutation 세대를 두 층위로 센다.
  // - 전역 카운터: 목록 재조회(refetch)는 "낙관적으로 바꾼 멤버십이 하나라도 있는가"만
  //   알면 되므로 라이브러리를 구분하지 않는다.
  // - 라이브러리별 카운터: 개별 GET 의 stale 판정용. 전역 하나로 판정하면 무관한
  //   라이브러리의 추가/삭제가 남의 정상 응답까지 버려 그 목록이 빈 채로 고정된다.
  const membershipVersionRef = useRef(0);
  const membershipVersionsRef = useRef<Map<string, number>>(new Map());
  const loadLibraryMembershipRef = useRef<(id: string) => Promise<void>>(async () => {});

  const bumpMembershipVersion = useCallback((libraryId: string) => {
    membershipVersionRef.current += 1;
    membershipVersionsRef.current.set(libraryId, (membershipVersionsRef.current.get(libraryId) ?? 0) + 1);
  }, []);

  const refetch = useCallback(async () => {
    const version = ++refetchVersionRef.current;
    const membershipVersion = membershipVersionRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const libraryDTOs = await getLibraries();
      if (version !== refetchVersionRef.current || membershipVersion !== membershipVersionRef.current) return;

      const mappedLibraries = libraryDTOs
        .map((library) => toLibrary(library))
        .filter((library) => library.id !== ALL_LIBRARY_ID);

      loadedMembershipRef.current = new Set();
      setLoadedMembershipIds(new Set());
      setMembershipErrorIds(new Set());
      setLibraries([createAllLibrary(), ...mappedLibraries]);
      mappedLibraries.forEach((library) => {
        if (!library.filter) void loadLibraryMembershipRef.current(library.id);
      });
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
      // Pin this call to the refetch generation and to *this library's* mutation
      // generation. A mutation on this library bumps its own counter, so an
      // in-flight GET that resolves afterwards is treated as stale and dropped —
      // preventing optimistic state from being overwritten. A mutation on some
      // other library leaves this counter untouched, so this response still lands.
      const version = refetchVersionRef.current;
      const membershipVersion = membershipVersionsRef.current.get(libraryId) ?? 0;
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
        if (
          version !== refetchVersionRef.current ||
          membershipVersion !== (membershipVersionsRef.current.get(libraryId) ?? 0)
        )
          return;
        const ids = data.contents.map((experience) => experience.id);
        setLibraries((prev) =>
          prev.map((library) =>
            library.id === libraryId ? { ...library, experienceIds: ids } : library,
          ),
        );
        succeeded = true;
      } catch {
        // error state tracked via setMembershipErrorIds below
      } finally {
        // Always clear the loading indicator. If a mutation on *this* library
        // bumped its version while we were in flight, the local state is already
        // authoritative (the mutation patched it); leaving loadingMembershipIds
        // set here would strand the library in a permanent "loading" state.
        setLoadingMembershipIds((prev) => {
          if (!prev.has(libraryId)) return prev;
          const next = new Set(prev);
          next.delete(libraryId);
          return next;
        });
        const stale =
          version !== refetchVersionRef.current ||
          membershipVersion !== (membershipVersionsRef.current.get(libraryId) ?? 0);
        if (stale || succeeded) {
          setLoadedMembershipIds((prev) => {
            if (prev.has(libraryId)) return prev;
            const next = new Set(prev);
            next.add(libraryId);
            return next;
          });
        } else {
          // Non-stale failure: do NOT mark as loaded — that would ship an
          // empty library as if it were real. Record the error so the UI can
          // render a retry affordance. The ref stays set so useEffect won't
          // auto-loop; the user must call retryLibraryMembership().
          setMembershipErrorIds((prev) => {
            if (prev.has(libraryId)) return prev;
            const next = new Set(prev);
            next.add(libraryId);
            return next;
          });
        }
      }
    },
    [],
  );

  loadLibraryMembershipRef.current = loadLibraryMembership;

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

  // Mutation resolves as soon as the server acknowledges the write. The
  // follow-up refetch runs best-effort in the background so a transient
  // GET failure does not masquerade as a write failure — which would
  // invite the user to retry and create duplicates (or repeat destructive
  // deletes).
  const createLibrary = useCallback(
    async (payload: UseLibrariesMutationInput): Promise<void> => {
      await apiCreateLibrary(payload);
      void refetch();
    },
    [refetch],
  );

  const updateLibrary = useCallback(
    async (id: string, payload: UseLibrariesUpdateInput): Promise<void> => {
      await apiUpdateLibrary(id, payload);
      void refetch();
    },
    [refetch],
  );

  const deleteLibrary = useCallback(
    async (id: string): Promise<void> => {
      await apiDeleteLibrary(id);
      void refetch();
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

  const resyncLibraryMembership = useCallback(
    async (libraryId: string): Promise<boolean> => {
      if (libraryId === ALL_LIBRARY_ID) return true;
      try {
        const data = await getLibraryExperiences(libraryId);
        const ids = data.contents.map((experience) => experience.id);
        bumpMembershipVersion(libraryId);
        setLibraries((prev) =>
          prev.map((library) =>
            library.id === libraryId ? { ...library, experienceIds: ids } : library,
          ),
        );
        markMembershipLoaded(libraryId);
        return true;
      } catch {
        // Resync failed: local state is now known-stale. Drop the loaded
        // marker and surface an error flag so the UI can expose a retry
        // affordance via retryLibraryMembership().
        loadedMembershipRef.current.delete(libraryId);
        setLoadedMembershipIds((prev) => {
          if (!prev.has(libraryId)) return prev;
          const next = new Set(prev);
          next.delete(libraryId);
          return next;
        });
        setMembershipErrorIds((prev) => {
          if (prev.has(libraryId)) return prev;
          const next = new Set(prev);
          next.add(libraryId);
          return next;
        });
        return false;
      }
    },
    [bumpMembershipVersion, markMembershipLoaded],
  );

  const addExperienceToLibrary = useCallback(
    async (libraryId: string, experienceId: string): Promise<void> => {
      // Flip local membership BEFORE awaiting so a second click on a slow
      // connection sees the updated state and short-circuits instead of
      // firing a duplicate POST.
      let alreadyMember = false;
      bumpMembershipVersion(libraryId);
      setLibraries((prev) =>
        prev.map((library) => {
          if (library.id !== libraryId) return library;
          if (library.experienceIds.includes(experienceId)) {
            alreadyMember = true;
            return library;
          }
          return { ...library, experienceIds: [...library.experienceIds, experienceId] };
        }),
      );
      markMembershipLoaded(libraryId);
      if (alreadyMember) return;
      try {
        await apiAddExperienceToLibrary(libraryId, experienceId);
      } catch (err) {
        // Overlapping toggles make naive rollback unsafe: another in-flight
        // remove may have already flipped state back. Resync from server.
        await resyncLibraryMembership(libraryId);
        throw err;
      }
    },
    [bumpMembershipVersion, markMembershipLoaded, resyncLibraryMembership],
  );

  const removeExperienceFromLibrary = useCallback(
    async (libraryId: string, experienceId: string): Promise<void> => {
      let wasMember = false;
      bumpMembershipVersion(libraryId);
      setLibraries((prev) =>
        prev.map((library) => {
          if (library.id !== libraryId) return library;
          if (!library.experienceIds.includes(experienceId)) return library;
          wasMember = true;
          return {
            ...library,
            experienceIds: library.experienceIds.filter((id) => id !== experienceId),
          };
        }),
      );
      markMembershipLoaded(libraryId);
      if (!wasMember) return;
      try {
        await apiRemoveExperienceFromLibrary(libraryId, experienceId);
      } catch (err) {
        await resyncLibraryMembership(libraryId);
        throw err;
      }
    },
    [bumpMembershipVersion, markMembershipLoaded, resyncLibraryMembership],
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
