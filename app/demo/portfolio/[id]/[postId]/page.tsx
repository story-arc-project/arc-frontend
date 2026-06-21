"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getPortfolio } from "@/lib/demo/handlers";
import type { Portfolio } from "@/types/portfolio";
import { PortfolioPostBody } from "@/components/demo/portfolio/PortfolioPostBody";
import { PortfolioPostNav } from "@/components/demo/portfolio/PortfolioPostNav";
import { PortfolioNotFound } from "@/components/demo/portfolio/PortfolioNotFound";

export default function PortfolioPostPage() {
  const { id, postId } = useParams<{ id: string; postId: string }>();
  const router = useRouter();
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

  useEffect(() => {
    if (portfolio && !portfolio.posts.some((p) => p.id === postId)) {
      router.replace(`/demo/portfolio/${id}`);
    }
  }, [portfolio, postId, id, router]);

  if (notFound) {
    return <PortfolioNotFound />;
  }

  if (!portfolio) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-text-tertiary">
        불러오는 중…
      </div>
    );
  }

  const index = portfolio.posts.findIndex((p) => p.id === postId);
  if (index === -1) {
    return null;
  }

  const post = portfolio.posts[index];
  const prevPost = portfolio.posts[index - 1];
  const nextPost = portfolio.posts[index + 1];
  const base = `/demo/portfolio/${id}`;

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <PortfolioPostBody post={post} />
        <PortfolioPostNav
          indexHref={base}
          prev={prevPost ? { href: `${base}/${prevPost.id}`, title: prevPost.title } : undefined}
          next={nextPost ? { href: `${base}/${nextPost.id}`, title: nextPost.title } : undefined}
        />
      </div>
    </main>
  );
}
