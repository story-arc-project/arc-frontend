"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getPortfolio } from "@/lib/demo/handlers";
import type { Portfolio } from "@/types/portfolio";
import { PortfolioHero } from "@/components/demo/portfolio/PortfolioHero";
import { PortfolioPostCard } from "@/components/demo/portfolio/PortfolioPostCard";
import { PortfolioFooter } from "@/components/demo/portfolio/PortfolioFooter";
import { PortfolioNotFound } from "@/components/demo/portfolio/PortfolioNotFound";

export default function PortfolioIndexPage() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    getPortfolio(id).then((p) => {
      if (!active) return;
      if (p) setPortfolio(p);
      else setNotFound(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (notFound) {
    return <PortfolioNotFound />;
  }

  if (!portfolio) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-text-tertiary">
        포트폴리오를 불러오는 중…
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-surface-secondary">
      <PortfolioHero profile={portfolio.profile} />
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="mb-4 text-title text-text-primary">대표 경험</h2>
        {portfolio.posts.length === 0 ? (
          <p className="text-body text-text-tertiary">아직 기록된 경험이 없어요.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {portfolio.posts.map((post) => (
              <PortfolioPostCard
                key={post.id}
                post={post}
                href={`/demo/portfolio/${portfolio.id}/${post.id}`}
              />
            ))}
          </div>
        )}
      </section>
      <PortfolioFooter />
    </main>
  );
}
