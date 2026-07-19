import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import UnsupportedSchemaNotice from "./UnsupportedSchemaNotice";

// globals:false 라 testing-library 자동 cleanup 미등록 → 수동 등록 필수.
afterEach(cleanup);

describe("UnsupportedSchemaNotice 목록 링크 (FRT-123 codex xhigh)", () => {
  it("basePath 가 없으면 유형별 fallbackHref 로 돌아간다", () => {
    render(<UnsupportedSchemaNotice basePath="" fallbackHref="/analysis/individual" />);
    expect(screen.getByRole("link", { name: "목록으로 돌아가기" })).toHaveAttribute(
      "href",
      "/analysis/individual",
    );
  });

  it("basePath 가 있으면 유형별 경로를 버리지 않고 앞에 붙인다 (데모 유형 맥락 보존)", () => {
    render(
      <UnsupportedSchemaNotice basePath="/demo" fallbackHref="/analysis/comprehensive" />,
    );
    // 회귀 전엔 `${basePath}/analysis`(제네릭 허브)로 새 유형 맥락을 잃었다.
    expect(screen.getByRole("link", { name: "목록으로 돌아가기" })).toHaveAttribute(
      "href",
      "/demo/analysis/comprehensive",
    );
  });
});
