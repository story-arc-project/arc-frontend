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

/**
 * 넘침 검사를 도입한 시점(FRT-338)에 **이미** 넘치고 있던 스토리.
 *
 * FRT-338 은 타이포 스케일 작업이라 이 넘침의 원인이 아니다(검사를 켜기만 하고 값은 그대로일 때 걸렸다).
 * 남의 결함을 그 김에 고치면 변경 범위가 흐려지므로, 부채를 숨기지 말고 여기 적어 두고 게이트는 살린다.
 * 목적은 **새로 생기는** 넘침을 잡는 것이다.
 *
 * 관측된 내용: FeedbackModal 본문 래퍼가 4px 넘친다 (scrollWidth 340 > clientWidth 336).
 * TODO(FRT-338 후속): 이 4px 의 원인을 찾아 고치고 이 목록을 비운다.
 */
const KNOWN_OVERFLOW_TITLES = new Set(["Features/Feedback/FeedbackModal"]);

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

    // FRT-338: 글자를 키우고 전역 word-break: keep-all 을 걸면 좁은 칸이 넓어지거나
    // 고정 높이 컨테이너(h-[44px] 등)가 넘칠 수 있다. 저장소에 비주얼 스냅숏 인프라가 없어
    // 넘침만 직접 잰다 — 타이포를 건드리는 변경의 레이아웃 회귀를 잡는 게 목적이다.
    // 가로만 본다: 세로는 스크롤이 정상인 자리가 많아 오탐이 크다.
    if (KNOWN_OVERFLOW_TITLES.has(context.title)) return;

    const overflows = await page.evaluate(async () => {
      // 폰트가 도착하기 전에 재면 안 된다. 스토리북은 Pretendard 를 외부 CDN 에서 받는데
      // (.storybook/preview-head.html), 러너에는 스택 첫 폰트("Apple SD Gothic Neo")도 없어
      // 그 사이 한글이 폴백 폰트로 그려진다 — 폴백은 더 넓어서 같은 코드가 한 번은 통과하고
      // 한 번은 넘친다. 실제로 CI 에서 커밋 하나를 두고 결과가 갈렸다(FRT-338).
      // 재는 시점을 폰트 로딩 뒤로 고정해 게이트를 동전 던지기에서 꺼낸다.
      await document.fonts.ready;

      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        // 스스로 스크롤·숨김을 처리하는 요소는 넘쳐도 정상이다.
        if (getComputedStyle(el).overflowX !== "visible") continue;
        // 1px 여유: 소수점 레이아웃에서 반올림으로 생기는 오탐을 거른다.
        if (el.scrollWidth > el.clientWidth + 1) {
          const cls = typeof el.className === "string" ? el.className.trim() : "";
          const id = el.tagName.toLowerCase() + (cls ? `.${cls.split(/\s+/).join(".")}` : "");
          bad.push(`${id} (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`);
        }
      }
      return bad.slice(0, 10);
    });
    if (overflows.length > 0) {
      throw new Error(
        `"${context.title} / ${context.name}" 스토리에서 가로 넘침 ${overflows.length}건:\n${overflows.join("\n")}`,
      );
    }
  },
};

export default config;
