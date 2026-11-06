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

interface MembershipMutation {
  id: number;
  experienceId: string;
  present: boolean;
  status: "pending" | "succeeded" | "failed";
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
  const listRequestVersionRef = useRef(0);
  const latestListRequestRef = useRef<Promise<void> | null>(null);
  const hasLoadedListRef = useRef(false);
  const libraryWritesRef = useRef<Map<string, Promise<void>>>(new Map());
  const deletedLibraryIdsRef = useRef<Set<string>>(new Set());
  // 멤버십 mutation 세대를 두 층위로 센다.
  // - 전역 카운터: 목록 재조회(refetch)는 "낙관적으로 바꾼 멤버십이 하나라도 있는가"만
  //   알면 되므로 라이브러리를 구분하지 않는다.
  // - 라이브러리별 카운터: 개별 GET 의 stale 판정용. 전역 하나로 판정하면 무관한
  //   라이브러리의 추가/삭제가 남의 정상 응답까지 버려 그 목록이 빈 채로 고정된다.
  const membershipVersionRef = useRef(0);
  const membershipVersionsRef = useRef<Map<string, number>>(new Map());
  // Keep overlapping edits until a server snapshot has observed their completion.
  const membershipJournalRef = useRef<Map<string, MembershipMutation[]>>(new Map());
  const pairWritesRef = useRef<Map<string, Promise<void>>>(new Map());
  const recoveryVersionsRef = useRef<Map<string, number>>(new Map());
  const appliedRecoveryVersionsRef = useRef<Map<string, number>>(new Map());
  const activeRecoveriesRef = useRef<Map<string, number>>(new Map());
  const recoveryNeededRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
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

  /** 두 카운터를 함께 올리고, 이 mutation 이 세운 라이브러리별 세대를 돌려준다. */
  const bumpMembershipVersion = useCallback((libraryId: string) => {
    membershipVersionRef.current += 1;
    const next = (membershipVersionsRef.current.get(libraryId) ?? 0) + 1;
    membershipVersionsRef.current.set(libraryId, next);
    return next;
  }, []);

  const refetch = useCallback(() => {
    const request = (async () => {
      const listVersion = ++listRequestVersionRef.current;
      const membershipVersion = membershipVersionRef.current;
      setIsLoading(true);
      setError(null);

      try {
        const libraryDTOs = await getLibraries();
        if (!mountedRef.current || listVersion !== listRequestVersionRef.current || membershipVersion !== membershipVersionRef.current) return;

        const mappedLibraries = libraryDTOs
          .map((library) => toLibrary(library))
          .filter((library) => library.id !== ALL_LIBRARY_ID);

        // Only an accepted list replaces membership ownership. Merely starting a
        // list request must not invalidate GETs if CRUD later discards that list.
        refetchVersionRef.current += 1;
        hasLoadedListRef.current = true;
        loadedMembershipRef.current = new Set();
        // This accepted generation starts a fresh membership load. An earlier
        // recovery failure must not suppress the new GET's loaded marker.
        recoveryNeededRef.current.clear();
        setLoadedMembershipIds(new Set());
        setMembershipErrorIds(new Set());
        commitLibraries(() => [createAllLibrary(), ...mappedLibraries]);
        mappedLibraries.forEach((library) => {
          if (!library.filter) void loadLibraryMembershipRef.current(library.id);
        });
      } catch (err) {
        if (!mountedRef.current || listVersion !== listRequestVersionRef.current) return;
        setError(err instanceof Error ? err : new Error("알 수 없는 오류가 발생했어요."));
      } finally {
        if (mountedRef.current && listVersion === listRequestVersionRef.current) {
          setIsLoading(false);
        }
      }
    })();
    latestListRequestRef.current = request;
    return request;
  }, [commitLibraries]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => { mountedRef.current = false; };
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
          !mountedRef.current || version !== refetchVersionRef.current ||
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
        if (!mountedRef.current || !librariesRef.current.some((library) => library.id === libraryId)) return;
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
        if ((stale || succeeded) && !recoveryNeededRef.current.has(libraryId)) {
          setLoadedMembershipIds((prev) => {
            if (prev.has(libraryId)) return prev;
            const next = new Set(prev);
            next.add(libraryId);
            return next;
          });
        } else if (!stale && !succeeded) {
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

  // Acknowledged CRUD must not depend on a list GET: concurrent membership
  // edits can invalidate that snapshot. Invalidate list snapshots separately so
  // membership loads and FRT-235 recovery can finish against the same objects.
  const invalidateListSnapshot = useCallback(() => {
    listRequestVersionRef.current += 1;
    setIsLoading(false);
    if (hasLoadedListRef.current) setError(null);
  }, []);

  const enqueueLibraryWrite = useCallback(async (id: string, apply: () => Promise<void>): Promise<void> => {
    const previous = libraryWritesRef.current.get(id);
    const write = (async () => {
      if (previous) await previous;
      await apply();
    })();
    const settled = write.then(() => {}, () => {});
    libraryWritesRef.current.set(id, settled);
    try {
      await write;
    } finally {
      if (libraryWritesRef.current.get(id) === settled) libraryWritesRef.current.delete(id);
    }
  }, []);

  // All acknowledged CRUD must preserve the latest attempt to discover the
  // pre-existing list, including retries started while a write was pending.
  const waitForInitialList = useCallback(async () => {
    while (!hasLoadedListRef.current) {
      const pendingList = latestListRequestRef.current;
      await pendingList;
      if (pendingList === latestListRequestRef.current) break;
    }
  }, []);

  const createLibrary = useCallback(
    async (payload: UseLibrariesMutationInput): Promise<void> => {
      // The header can create while the initial list is loading. Wait for
      // that snapshot (including failure) before invalidating older snapshots.
      await waitForInitialList();
      const id = await apiCreateLibrary(payload);
      // Retry may have started while POST was pending. Until a list has ever
      // loaded, preserve that attempt too so existing libraries or retry errors
      // cannot disappear when the acknowledged library is added locally.
      await waitForInitialList();
      if (!mountedRef.current || deletedLibraryIdsRef.current.has(id)) return;
      invalidateListSnapshot();
      const alreadyPresent = librariesRef.current.some((library) => library.id === id);
      commitLibraries((prev) => prev.some((library) => library.id === id) ? prev : [...prev, {
        id,
        name: payload.name,
        color: payload.color,
        icon: payload.icon,
        isSystem: payload.isSystem ?? false,
        filter: payload.filter,
        experienceIds: [],
      }]);
      // A fresh manual library has no members. If a concurrent list already
      // observed it, preserve its existing load/error state and membership.
      if (!alreadyPresent && !payload.filter) markMembershipLoaded(id);
    },
    [commitLibraries, invalidateListSnapshot, markMembershipLoaded, waitForInitialList],
  );

  const updateLibrary = useCallback(
    (id: string, payload: UseLibrariesUpdateInput): Promise<void> => enqueueLibraryWrite(id, async () => {
      await apiUpdateLibrary(id, payload);
      await waitForInitialList();
      if (!mountedRef.current) return;
      invalidateListSnapshot();
      // PATCH ignores omitted fields. Preserve both omitted metadata and the
      // latest membership, including optimistic edits made while awaiting API.
      const patch = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
      commitLibraries((prev) => prev.map((library) => library.id === id ? { ...library, ...patch } : library));
    }),
    [commitLibraries, enqueueLibraryWrite, invalidateListSnapshot, waitForInitialList],
  );

  const deleteLibrary = useCallback(
    (id: string): Promise<void> => enqueueLibraryWrite(id, async () => {
      await apiDeleteLibrary(id);
      // A list can reveal a created ID before its POST acknowledgment arrives.
      // Remember successful deletion before waiting so that late create cannot
      // append the same server ID again, even during an initial-list retry.
      deletedLibraryIdsRef.current.add(id);
      await waitForInitialList();
      if (!mountedRef.current) return;
      invalidateListSnapshot();
      commitLibraries((prev) => prev.filter((library) => library.id !== id));
      loadedMembershipRef.current.delete(id);
      recoveryNeededRef.current.delete(id);
      for (const setState of [setLoadedMembershipIds, setLoadingMembershipIds, setMembershipErrorIds]) {
        setState((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }),
    [commitLibraries, enqueueLibraryWrite, invalidateListSnapshot, waitForInitialList],
  );

  const pruneMembershipJournal = useCallback((libraryId: string) => {
    if ((activeRecoveriesRef.current.get(libraryId) ?? 0) > 0) return;
    // Future GETs start after acknowledged writes, so only pending operations
    // can be missing from those snapshots. Do not retain a session-long log.
    const pending = (membershipJournalRef.current.get(libraryId) ?? [])
      .filter((mutation) => mutation.status === "pending");
    if (pending.length > 0) membershipJournalRef.current.set(libraryId, pending);
    else membershipJournalRef.current.delete(libraryId);
  }, []);

  const resyncLibraryMembership = useCallback(
    async (libraryId: string): Promise<void> => {
      if (libraryId === ALL_LIBRARY_ID || !mountedRef.current) return;
      const version = (recoveryVersionsRef.current.get(libraryId) ?? 0) + 1;
      recoveryVersionsRef.current.set(libraryId, version);
      activeRecoveriesRef.current.set(libraryId, (activeRecoveriesRef.current.get(libraryId) ?? 0) + 1);
      const refetchVersion = refetchVersionRef.current;
      const startedAt = membershipVersionRef.current;
      const pendingAtStart = new Set(
        (membershipJournalRef.current.get(libraryId) ?? [])
          .filter((mutation) => mutation.status === "pending")
          .map((mutation) => mutation.id),
      );
      try {
        const data = await getLibraryExperiences(libraryId);
        if (
          !mountedRef.current || !librariesRef.current.some((library) => library.id === libraryId) ||
          refetchVersion !== refetchVersionRef.current ||
          version < (appliedRecoveryVersionsRef.current.get(libraryId) ?? 0)
        ) return;

        // A GET may predate a pending write, even if that write has succeeded by
        // response time. Replay it (and all later edits), excluding failures.
        const journal = membershipJournalRef.current.get(libraryId) ?? [];
        const overlapping = journal.filter((mutation) =>
          mutation.id > startedAt || pendingAtStart.has(mutation.id),
        );
        const ids = new Set(data.contents.map((experience) => experience.id));
        for (const mutation of overlapping) {
          if (mutation.status === "failed") continue;
          if (mutation.present) ids.add(mutation.experienceId);
          else ids.delete(mutation.experienceId);
        }
        membershipJournalRef.current.set(libraryId, overlapping);
        appliedRecoveryVersionsRef.current.set(libraryId, version);
        bumpMembershipVersion(libraryId);
        commitLibraries((prev) => prev.map((library) =>
          library.id === libraryId ? { ...library, experienceIds: [...ids] } : library,
        ));
        // An older successful GET may fix data, but cannot clear the retry flag
        // raised by a newer recovery failure.
        if (version === recoveryVersionsRef.current.get(libraryId)) {
          recoveryNeededRef.current.delete(libraryId);
          markMembershipLoaded(libraryId);
        }
      } catch {
        if (
          !mountedRef.current || !librariesRef.current.some((library) => library.id === libraryId) ||
          refetchVersion !== refetchVersionRef.current ||
          version !== recoveryVersionsRef.current.get(libraryId)
        ) return;
        recoveryNeededRef.current.add(libraryId);
        loadedMembershipRef.current.delete(libraryId);
        setLoadedMembershipIds((prev) => {
          const next = new Set(prev);
          next.delete(libraryId);
          return next;
        });
        setMembershipErrorIds((prev) => new Set(prev).add(libraryId));
      } finally {
        const remaining = (activeRecoveriesRef.current.get(libraryId) ?? 1) - 1;
        if (remaining > 0) activeRecoveriesRef.current.set(libraryId, remaining);
        else {
          activeRecoveriesRef.current.delete(libraryId);
          if (mountedRef.current) {
            setLoadingMembershipIds((prev) => {
              if (!prev.has(libraryId)) return prev;
              const next = new Set(prev);
              next.delete(libraryId);
              return next;
            });
          }
        }
        pruneMembershipJournal(libraryId);
      }
    },
    [bumpMembershipVersion, commitLibraries, markMembershipLoaded, pruneMembershipJournal],
  );

  const retryLibraryMembership = useCallback(
    async (libraryId: string): Promise<void> => {
      if (libraryId === ALL_LIBRARY_ID || !mountedRef.current) return;
      // Retry uses the same journal replay as automatic recovery: a pending
      // optimistic write is not necessarily included in the new GET either.
      setLoadingMembershipIds((prev) => new Set(prev).add(libraryId));
      await resyncLibraryMembership(libraryId);
    },
    [resyncLibraryMembership],
  );

  const mutateMembership = useCallback(
    async (libraryId: string, experienceId: string, present: boolean): Promise<void> => {
      // Read the synchronous mirror so duplicate clicks are complete no-ops.
      if (!mountedRef.current || !librariesRef.current.some((library) => library.id === libraryId) || isMember(libraryId, experienceId) === present) return;
      bumpMembershipVersion(libraryId);
      const mutation: MembershipMutation = {
        id: membershipVersionRef.current,
        experienceId,
        present,
        status: "pending",
      };
      const journal = membershipJournalRef.current.get(libraryId) ?? [];
      journal.push(mutation);
      membershipJournalRef.current.set(libraryId, journal);
      commitLibraries((prev) => prev.map((library) => {
        if (library.id !== libraryId) return library;
        return {
          ...library,
          experienceIds: present
            ? [...library.experienceIds, experienceId]
            : library.experienceIds.filter((id) => id !== experienceId),
        };
      }));
      if (!recoveryNeededRef.current.has(libraryId)) markMembershipLoaded(libraryId);

      // Serialize only the same pair. Otherwise a slower add could commit after
      // its later remove and leave the server opposite to the user's last edit.
      const pair = JSON.stringify([libraryId, experienceId]);
      const previousWrite = pairWritesRef.current.get(pair);
      const write = (async () => {
        if (previousWrite) await previousWrite;
        try {
          if (present) await apiAddExperienceToLibrary(libraryId, experienceId);
          else await apiRemoveExperienceFromLibrary(libraryId, experienceId);
          mutation.status = "succeeded";
        } catch (err) {
          mutation.status = "failed";
          throw err;
        }
      })();
      // Queue settlement excludes recovery, so a slow GET never delays writes.
      // Already requested writes continue after unmount to preserve server order;
      // recovery and React state updates stop when the hook unmounts.
      const settledWrite = write.then(() => {}, () => {});
      pairWritesRef.current.set(pair, settledWrite);
      try {
        await write;
      } catch (err) {
        recoveryNeededRef.current.add(libraryId);
        await resyncLibraryMembership(libraryId);
        throw err;
      } finally {
        if (pairWritesRef.current.get(pair) === settledWrite) pairWritesRef.current.delete(pair);
        pruneMembershipJournal(libraryId);
      }
    },
    [bumpMembershipVersion, commitLibraries, isMember, markMembershipLoaded, pruneMembershipJournal, resyncLibraryMembership],
  );

  const addExperienceToLibrary = useCallback(
    (libraryId: string, experienceId: string) => mutateMembership(libraryId, experienceId, true),
    [mutateMembership],
  );

  const removeExperienceFromLibrary = useCallback(
    (libraryId: string, experienceId: string) => mutateMembership(libraryId, experienceId, false),
    [mutateMembership],
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
