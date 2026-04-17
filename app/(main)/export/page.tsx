"use client";

import { useState } from "react";
import { FileText, PenLine, IdCard } from "lucide-react";
import { TrackCard } from "./_components/TrackCard";
import { RecentResumeList } from "./_components/RecentResumeList";
import { CreateResumeModal } from "./_components/CreateResumeModal";

export default function ExportPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="min-h-[calc(100dvh-var(--gnb-h))] bg-surface px-4 py-8 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-heading-2 text-text-primary">익스포트</h1>
          <p className="text-body text-text-secondary mt-1">
            기록한 경험으로 레쥬메와 자기소개서 같은 결과물을 만들어요.
          </p>
        </header>

        <section>
          <h2 className="text-title text-text-primary mb-3">무엇을 만들까요?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TrackCard
              title="레쥬메"
              description="경험을 바탕으로 이력서 초안을 만들어요."
              icon={<FileText size={20} />}
              onClick={() => setCreateOpen(true)}
              actionLabel="새 레쥬메 만들기"
            />
            <TrackCard
              title="자기소개서"
              description="성장 스토리를 글로 다듬어요."
              icon={<PenLine size={20} />}
              disabled
              badgeText="Phase 1.5 예정"
            />
            <TrackCard
              title="명함"
              description="나를 한눈에 보여주는 명함을 만들어요."
              icon={<IdCard size={20} />}
              disabled
              badgeText="Phase 1.5 예정"
            />
          </div>
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-title text-text-primary">최근 만든 레쥬메</h2>
          </div>
          <RecentResumeList onCreateClick={() => setCreateOpen(true)} />
        </section>
      </div>

      <CreateResumeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
