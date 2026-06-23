"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { getPortfolio } from "@/lib/demo/handlers";
import { DEMO_PORTFOLIO_CONTENT } from "@/lib/demo/portfolio-seed";
import { groupPosts } from "@/lib/demo/group-posts";
import type { Portfolio } from "@/types/portfolio";
import { PortfolioAbout } from "@/components/demo/portfolio/PortfolioAbout";
import { PortfolioExperienceGroups } from "@/components/demo/portfolio/PortfolioExperienceGroups";
import { PortfolioFooter } from "@/components/demo/portfolio/PortfolioFooter";
import { PortfolioGoals } from "@/components/demo/portfolio/PortfolioGoals";
import { PortfolioHero } from "@/components/demo/portfolio/PortfolioHero";
import { PortfolioNotFound } from "@/components/demo/portfolio/PortfolioNotFound";
import { PortfolioValues } from "@/components/demo/portfolio/PortfolioValues";

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

  const postGroups = useMemo(
    () => groupPosts(portfolio?.posts ?? [], DEMO_PORTFOLIO_CONTENT.experienceGroups),
    [portfolio],
  );

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
      <PortfolioHero
        profile={portfolio.profile}
        tagline={DEMO_PORTFOLIO_CONTENT.about.tagline}
        profileFacts={DEMO_PORTFOLIO_CONTENT.about.profileFacts}
      />
      <section id="about">
        <PortfolioAbout about={DEMO_PORTFOLIO_CONTENT.about} />
      </section>
      <section id="values" className="bg-surface">
        <PortfolioValues values={DEMO_PORTFOLIO_CONTENT.values} />
      </section>
      <section id="experiences">
        <PortfolioExperienceGroups groups={postGroups} portfolioId={portfolio.id} />
      </section>
      <section id="goals" className="bg-surface">
        <PortfolioGoals
          goals={DEMO_PORTFOLIO_CONTENT.goals}
          growthJourney={DEMO_PORTFOLIO_CONTENT.growthJourney}
        />
      </section>
      <PortfolioFooter />
    </main>
  );
}
