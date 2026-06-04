import type { TestRunnerConfig } from "@storybook/test-runner";

/**
 * test-runner 실패 게이트.
 *
 * - `--failOnConsole`(package.json test-storybook 스크립트)가 브라우저 `console.error`를 실패로 처리한다.
 *   preview의 MSW `onUnhandledRequest`가 미가로챈 백엔드 요청을 console.error로 표면화하므로,
 *   마운트 시 미목킹 API 호출도 이 게이트에 함께 걸린다.
 * - 여기서는 `--failOnConsole`이 잡지 못하는 "잡히지 않은 런타임 예외(pageerror)"를 실패로 처리한다.
 *   (이벤트 핸들러/프라미스에서 throw된 에러는 console.error 없이 pageerror로만 뜰 수 있다.)
 *
 * test-runner는 한 워커에서 동일한 Playwright `page`를 재사용한다. preVisit마다 리스너를 새로 붙이면
 * 누적되어 한 에러가 여러 번 보고되므로, 리스너는 page당 한 번만 붙이고 에러는 page별 버킷에 모은다.
 * preVisit에서 버킷을 비우고 postVisit에서 검사하면, 각 스토리 구간의 에러만 해당 스토리에 귀속된다.
 */
const listenerAttached = new WeakSet<object>();
const errorsByPage = new WeakMap<object, Error[]>();

const config: TestRunnerConfig = {
  async preVisit(page) {
    if (!listenerAttached.has(page)) {
      listenerAttached.add(page);
      page.on("pageerror", (error) => {
        errorsByPage.get(page)?.push(error);
      });
    }
    errorsByPage.set(page, []);
  },
  async postVisit(page, context) {
    const errors = errorsByPage.get(page) ?? [];
    if (errors.length > 0) {
      const detail = errors.map((e) => e.message || String(e)).join("\n");
      throw new Error(
        `"${context.title} / ${context.name}" 스토리에서 잡히지 않은 런타임 예외 ${errors.length}건 발생:\n${detail}`,
      );
    }
  },
};

export default config;
