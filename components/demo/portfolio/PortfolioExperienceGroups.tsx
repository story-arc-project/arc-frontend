import type { PostGroup } from "@/lib/demo/group-posts";

import { PortfolioPostCard } from "./PortfolioPostCard";

interface PortfolioExperienceGroupsProps {
  groups: PostGroup[];
  portfolioId: string;
}

export function PortfolioExperienceGroups({ groups, portfolioId }: PortfolioExperienceGroupsProps) {
  const nonEmptyGroups = groups.filter((g) => g.posts.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="mb-4 text-title text-text-primary">경험 모음</h2>
      {nonEmptyGroups.length === 0 ? (
        <p className="text-body text-text-tertiary">아직 기록된 경험이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {nonEmptyGroups.map((pg) => (
            <div key={pg.group.libraryId}>
              <h3 className="mb-3 flex items-center gap-2 text-title text-text-primary">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${pg.group.tailwindColorClass}`}
                />
                {pg.group.name}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pg.posts.map((post) => (
                  <PortfolioPostCard
                    key={post.id}
                    post={post}
                    href={`/demo/portfolio/${portfolioId}/${post.id}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
