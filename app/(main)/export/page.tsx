"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, PenLine, IdCard, Globe } from "lucide-react";
import { useBasePath } from "@/lib/utils/use-base-path";
import {
  isCoverLetterEnabled,
  isResumeExperienceSelectionEnabled,
} from "@/lib/export/flags";
import { TrackCard } from "./_components/TrackCard";
import { RecentResumeList } from "./_components/RecentResumeList";
import { RecentCoverLetterList } from "./_components/RecentCoverLetterList";
import { CreateResumeModal } from "./_components/CreateResumeModal";

export default function ExportPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const base = useBasePath();
  const isDemo = base === "/demo";
  const router = useRouter();
  const coverLetterEnabled = isCoverLetterEnabled();
  const [generating, setGenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCreatePortfolio() {
    if (generating) return;
    setGenerating(true);
    timerRef.current = setTimeout(() => {
      // Inlined literal to keep demo seed module out of the main-app bundle
      router.push("/demo/portfolio/demo-portfolio-1");
    }, 600);
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-heading-2 text-text-primary">익스포트</h1>
          <p className="text-body text-text-secondary mt-1">
            기록한 경험으로 이력서와 자기소개서 같은 결과물을 만들어요.
          </p>
        </header>

        <section>
          <h2 className="text-title text-text-primary mb-3">무엇을 만들까요?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TrackCard
              title="이력서"
              description="경험을 바탕으로 이력서 초안을 만들어요."
              icon={<FileText size={20} />}
              onClick={() => setCreateOpen(true)}
              actionLabel="새 이력서 만들기"
            />
            {/* 게이트는 호출부인 이 페이지가 쥔다(FRT-108 교훈). 백엔드(BAC-62)에 자소서
                파이프라인이 아직 없어 기본은 잠긴 카드 그대로다. */}
            {coverLetterEnabled ? (
              <TrackCard
                title="자기소개서"
                description="문항을 넣으면 기록을 바탕으로 초안을 만들어요."
                icon={<PenLine size={20} />}
                href={`${base}/export/cover-letter/new`}
                actionLabel="새 자기소개서 만들기"
              />
            ) : (
              <TrackCard
                title="자기소개서"
                description="성장 스토리를 글로 다듬어요."
                icon={<PenLine size={20} />}
                disabled
                badgeText="Phase 1.5 예정"
              />
            )}
            <TrackCard
              title="명함"
              description="나를 한눈에 보여주는 명함을 만들어요."
              icon={<IdCard size={20} />}
              disabled
              badgeText="Phase 1.5 예정"
            />
            {isDemo && (
              <TrackCard
                title="e-포트폴리오"
                description="경험을 블로그처럼 연결된 포트폴리오로 정리해요."
                icon={<Globe size={20} />}
                onClick={handleCreatePortfolio}
                actionLabel={generating ? "생성 중…" : "e-포트폴리오 만들기"}
              />
            )}
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-title text-text-primary">최근 만든 이력서</h2>
          </div>
          <RecentResumeList
            onCreateClick={() => setCreateOpen(true)}
            reloadToken={reloadToken}
          />
        </section>

        {coverLetterEnabled && (
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-title text-text-primary">최근 만든 자기소개서</h2>
            </div>
            <RecentCoverLetterList
              onCreateClick={() => router.push(`${base}/export/cover-letter/new`)}
            />
          </section>
        )}
      </div>

      {/* 열었을 때만 마운트한다 — 경험 목록 fetch 가 익스포트 페이지 진입마다 일어나지 않게
          하고, 닫으면 언마운트로 선택 상태가 리셋된다(FRT-94 의 "리셋은 effect 가 아니라 언마운트로"). */}
      {createOpen && (
        <CreateResumeModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => setReloadToken((n) => n + 1)}
          // 게이트는 호출부인 이 페이지가 쥔다(FRT-108 교훈 — 컴포넌트 안에서 읽으면
          // 빌드타임 인라인 탓에 Storybook 에서 영영 false 다).
          experienceSelectionEnabled={isResumeExperienceSelectionEnabled()}
        />
      )}
    </div>
  );
}
