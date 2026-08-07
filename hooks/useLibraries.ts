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
  // 서버 응답을 기다리는 중인 쓰기 수(라이브러리별). 하나라도 있으면 방금 받아온
  // 서버 스냅샷이 그 쓰기를 아직 담고 있지 않을 수 있으므로 반영하면 안 된다.
  const pendingWritesRef = useRef<Map<string, number>>(new Map());
  const loadLibraryMembershipRef = useRef<(id: string) => Promise<void>>(async () => {});
  // 현재 목록의 미러. 멤버 여부 판정을 setLibraries 업데이터의 부수효과로 하면 React 가
  // 업데이터를 dispatch 시점에 동기 실행해 준다는 조건부 보장(eager state 최적화)에
  // 기대게 되는데, 이 훅에서는 그 최적화가 걸리지 않아 판정이 늘 초기값으로 읽혔다.
  // 제거는 서버로 나가지도 않고 화면에서만 사라졌다(FRT-234).
  const librariesRef = useRef<Library[]>(libraries);

  // 모든 목록 갱신은 이 함수 하나를 지난다 — 그래야 librariesRef 가 항상 최신을 가리킨다는
  // 불변식이 성립한다. setLibraries 를 직접 부르면 그 순간 ref 가 거짓말을 시작한다.
  const commitLibraries = useCallback((update: (prev: Library[]) => Library[]) => {
    const next = update(librariesRef.current);
    librariesRef.current = next;
    setLibraries(next);
  }, []);

  /** 업데이터 밖에서 멤버 여부를 판정한다. 라이브러리가 없으면 false. */
  const isMember = useCallback((libraryId: string, experienceId: string) => {
    const library = librariesRef.current.find((item) => item.id === libraryId);
    return library?.experienceIds.includes(experienceId) ?? false;
  }, []);

  const beginWrite = useCallback((libraryId: string) => {
    pendingWritesRef.current.set(libraryId, (pendingWritesRef.current.get(libraryId) ?? 0) + 1);
  }, []);

  const endWrite = useCallback((libraryId: string) => {
    const next = (pendingWritesRef.current.get(libraryId) ?? 1) - 1;
    if (next > 0) pendingWritesRef.current.set(libraryId, next);
    else pendingWritesRef.current.delete(libraryId);
  }, []);

  /** 두 카운터를 함께 올리고, 이 mutation 이 세운 라이브러리별 세대를 돌려준다. */
  const bumpMembershipVersion = useCallback((libraryId: string) => {
    membershipVersionRef.current += 1;
    const next = (membershipVersionsRef.current.get(libraryId) ?? 0) + 1;
    membershipVersionsRef.current.set(libraryId, next);
    return next;
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
      commitLibraries(() => [createAllLibrary(), ...mappedLibraries]);
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
  }, [commitLibraries]);

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
        commitLibraries((prev) =>
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
    [commitLibraries],
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
    async (libraryId: string, mutationVersion: number): Promise<boolean> => {
      if (libraryId === ALL_LIBRARY_ID) return true;
      try {
        const data = await getLibraryExperiences(libraryId);
        const ids = data.contents.map((experience) => experience.id);
        // Only apply when nothing else is racing this library. Two ways it can be:
        //   - the generation moved on → a later write already patched state and
        //     owns it, and our snapshot predates that write;
        //   - a write is still awaiting its response → the snapshot cannot
        //     contain it yet, so applying would erase an edit that goes on to
        //     succeed, with no signal to the user.
        // Either way we touch nothing — not even the loaded/error flags, since
        // another recovery may already have raised the retry affordance and
        // clearing it would present unreconciled state as loaded.
        if (
          mutationVersion !== (membershipVersionsRef.current.get(libraryId) ?? 0) ||
          (pendingWritesRef.current.get(libraryId) ?? 0) > 0
        ) {
          return true;
        }
        bumpMembershipVersion(libraryId);
        commitLibraries((prev) =>
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
    [bumpMembershipVersion, commitLibraries, markMembershipLoaded],
  );

  const addExperienceToLibrary = useCallback(
    async (libraryId: string, experienceId: string): Promise<void> => {
      // Flip local membership BEFORE awaiting so a second click on a slow
      // connection sees the updated state and short-circuits instead of
      // firing a duplicate POST. The check reads the mirror ref, not a side
      // effect of the updater — commitLibraries has already applied any
      // earlier click by the time we get here.
      const alreadyMember = isMember(libraryId, experienceId);
      const mutationVersion = bumpMembershipVersion(libraryId);
      commitLibraries((prev) =>
        prev.map((library) => {
          if (library.id !== libraryId) return library;
          if (library.experienceIds.includes(experienceId)) return library;
          return { ...library, experienceIds: [...library.experienceIds, experienceId] };
        }),
      );
      markMembershipLoaded(libraryId);
      if (alreadyMember) return;
      // Stop counting ourselves as pending before recovering, so the resync
      // guard sees only writes that are genuinely still outstanding.
      beginWrite(libraryId);
      let failure: unknown = null;
      try {
        await apiAddExperienceToLibrary(libraryId, experienceId);
      } catch (err) {
        failure = err;
      } finally {
        endWrite(libraryId);
      }
      if (failure) {
        // Overlapping toggles make naive rollback unsafe: another in-flight
        // remove may have already flipped state back. Resync from server.
        await resyncLibraryMembership(libraryId, mutationVersion);
        throw failure;
      }
    },
    [
      beginWrite,
      bumpMembershipVersion,
      commitLibraries,
      endWrite,
      isMember,
      markMembershipLoaded,
      resyncLibraryMembership,
    ],
  );

  const removeExperienceFromLibrary = useCallback(
    async (libraryId: string, experienceId: string): Promise<void> => {
      const wasMember = isMember(libraryId, experienceId);
      const mutationVersion = bumpMembershipVersion(libraryId);
      commitLibraries((prev) =>
        prev.map((library) => {
          if (library.id !== libraryId) return library;
          if (!library.experienceIds.includes(experienceId)) return library;
          return {
            ...library,
            experienceIds: library.experienceIds.filter((id) => id !== experienceId),
          };
        }),
      );
      markMembershipLoaded(libraryId);
      if (!wasMember) return;
      beginWrite(libraryId);
      let failure: unknown = null;
      try {
        await apiRemoveExperienceFromLibrary(libraryId, experienceId);
      } catch (err) {
        failure = err;
      } finally {
        endWrite(libraryId);
      }
      if (failure) {
        await resyncLibraryMembership(libraryId, mutationVersion);
        throw failure;
      }
    },
    [
      beginWrite,
      bumpMembershipVersion,
      commitLibraries,
      endWrite,
      isMember,
      markMembershipLoaded,
      resyncLibraryMembership,
    ],
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
