import type { PortfolioPost } from "@/types/portfolio";

import type { DemoExperienceGroup } from "./content";

export interface PostGroup {
  group: DemoExperienceGroup;
  posts: PortfolioPost[];
}

/**
 * 포트폴리오 포스트를 경험 그룹별로 분류한다.
 *
 * - 그룹 순서는 groups 배열 순서를 따른다.
 * - 각 그룹 안에서의 포스트 순서는 posts 배열 순서를 따른다.
 * - 어느 그룹에도 속하지 않는 포스트가 있으면 libraryId "__ungrouped__" 그룹으로 추가한다.
 * - 언그룹 포스트가 없으면 해당 그룹은 생성하지 않는다.
 */
export function groupPosts(
  posts: PortfolioPost[],
  groups: DemoExperienceGroup[],
): PostGroup[] {
  const allGroupedIds = new Set(groups.flatMap((g) => g.postIds));

  const result: PostGroup[] = groups.map((group) => ({
    group,
    posts: posts.filter((p) => group.postIds.includes(p.id)),
  }));

  const ungroupedPosts = posts.filter((p) => !allGroupedIds.has(p.id));
  if (ungroupedPosts.length > 0) {
    result.push({
      group: {
        libraryId: "__ungrouped__",
        name: "기타 경험",
        tailwindColorClass: "bg-surface-brand",
        postIds: ungroupedPosts.map((p) => p.id),
      },
      posts: ungroupedPosts,
    });
  }

  return result;
}
