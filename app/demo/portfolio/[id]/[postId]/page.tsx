"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { getPortfolio } from "@/lib/demo/handlers";
import type { Portfolio } from "@/types/portfolio";
import { PortfolioPostBody } from "@/components/demo/portfolio/PortfolioPostBody";
import { PortfolioPostNav } from "@/components/demo/portfolio/PortfolioPostNav";

export default function PortfolioPostPage() {
  const { id, postId } = useParams<{ id: string; postId: string }>();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  useEffect(() => {
    let active = true;
    getPortfolio(id).then((p) => {
      if (active) setPortfolio(p);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (!portfolio) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body text-text-tertiary">
        불러오는 중…
      </div>
    );
  }

  const index = portfolio.posts.findIndex((p) => p.id === postId);
  if (index === -1) {
    router.replace(`/demo/portfolio/${id}`);
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
