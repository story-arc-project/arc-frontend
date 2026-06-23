import { describe, expect, it } from "vitest";

import type { PortfolioPost } from "@/types/portfolio";

import type { DemoExperienceGroup } from "./content";
import { groupPosts } from "./group-posts";

function makePost(id: string): PortfolioPost {
  return {
    id,
    title: `Post ${id}`,
    period: "",
    category: "경험",
    summary: "",
    contribution: "",
    achievement: "",
    keywords: [],
  };
}

const groups: DemoExperienceGroup[] = [
  {
    libraryId: "lib-a",
    name: "그룹 A",
    tailwindColorClass: "bg-violet-500",
    postIds: ["p1", "p3"],
  },
  {
    libraryId: "lib-b",
    name: "그룹 B",
    tailwindColorClass: "bg-blue-500",
    postIds: ["p2"],
  },
];

const posts = [makePost("p1"), makePost("p2"), makePost("p3")];

describe("groupPosts", () => {
  it("assigns posts to matching groups", () => {
    const result = groupPosts(posts, groups);
    expect(result[0].group.libraryId).toBe("lib-a");
    expect(result[0].posts.map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(result[1].group.libraryId).toBe("lib-b");
    expect(result[1].posts.map((p) => p.id)).toEqual(["p2"]);
  });

  it("preserves post order from the posts array", () => {
    const shuffled = [makePost("p3"), makePost("p1")];
    const result = groupPosts(shuffled, [groups[0]]);
    expect(result[0].posts.map((p) => p.id)).toEqual(["p3", "p1"]);
  });

  it("returns empty posts array for groups with no matching posts", () => {
    const result = groupPosts([], groups);
    expect(result).toHaveLength(2);
    expect(result[0].posts).toHaveLength(0);
    expect(result[1].posts).toHaveLength(0);
  });

  it("does not emit ungrouped group when all posts are grouped", () => {
    const result = groupPosts(posts, groups);
    expect(result.some((r) => r.group.libraryId === "__ungrouped__")).toBe(false);
  });

  it("appends ungrouped posts as 기타 경험 when posts exist outside all groups", () => {
    const extraPost = makePost("p-extra");
    const result = groupPosts([...posts, extraPost], groups);
    const ungrouped = result.find((r) => r.group.libraryId === "__ungrouped__");
    expect(ungrouped).toBeDefined();
    expect(ungrouped?.posts.map((p) => p.id)).toEqual(["p-extra"]);
    expect(ungrouped?.group.name).toBe("기타 경험");
  });

  it("does not emit ungrouped group when there are no ungrouped posts", () => {
    const result = groupPosts(posts, groups);
    expect(result.find((r) => r.group.libraryId === "__ungrouped__")).toBeUndefined();
  });

  it("preserves group order from the groups array", () => {
    const result = groupPosts(posts, groups);
    expect(result[0].group.libraryId).toBe("lib-a");
    expect(result[1].group.libraryId).toBe("lib-b");
  });

  it("handles empty groups array — all posts become ungrouped", () => {
    const result = groupPosts(posts, []);
    expect(result).toHaveLength(1);
    expect(result[0].group.libraryId).toBe("__ungrouped__");
    expect(result[0].posts).toHaveLength(3);
  });
});
