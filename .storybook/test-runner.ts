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
 * 넘침 검사를 도입한 시점(FRT-338)에 **이미** 넘치고 있던 스토리의 허용 폭(px).
 *
 * FRT-338 은 타이포 스케일 작업이라 이 넘침의 원인이 아니다(검사를 켜기만 하고 값은 그대로일 때 걸렸다).
 * 남의 결함을 그 김에 고치면 변경 범위가 흐려지므로, 부채를 숨기지 말고 여기 적어 두고 게이트는 살린다.
 * 목적은 **새로 생기는** 넘침을 잡는 것이다.
 *
 * 스토리를 통째로 건너뛰지 않고 **폭으로** 봐준다. 통째로 건너뛰면 그 스토리에서 새로 생기는
 * 넘침도, 알던 넘침이 더 벌어지는 것도 함께 눈감게 된다 — 부채를 적어 두려던 것이 검사 구멍이 된다.
 *
 * 관측된 내용: FeedbackModal 본문 래퍼 2곳이 각각 4px 넘친다 (scrollWidth 340 > clientWidth 336).
 * TODO(FRT-338 후속): 이 4px 의 원인을 찾아 고치고 이 목록을 비운다.
 */
const KNOWN_OVERFLOW_TOLERANCE_PX = new Map([["Features/Feedback/FeedbackModal", 4]]);

/**
 * TODO(FRT-338 후속): 폰 폭(390px)에서도 재야 한다. 지금은 각 스토리의 기본(데스크톱) 캔버스만 보므로
 * 폰에서만 생기는 넘침을 놓친다. 실제로 이 브랜치에서 390px 전수 측정을 해 보니 383개 중 9개가
 * 넘쳤는데, 9개 모두 FRT-338 **이전과 수치가 같아**(FileBlock 계열 +187 ×4, ImagePreview +362,
 * FeedbackModal +4 ×4) 이번 타이포 변경이 만든 것은 하나도 없었다. 남의 부채를 이 PR 에서
 * 고치지 않기로 했으므로 폰 폭 검사도 함께 미룬다 — 켜는 순간 기준선이 빨개져 게이트가 무의미해진다.
 */

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

    // FRT-338: 글자를 키우고 전역 word-break: keep-all 을 걸면 좁은 칸이 넓어지거나
    // 고정 높이 컨테이너(h-[44px] 등)가 넘칠 수 있다. 저장소에 비주얼 스냅숏 인프라가 없어
    // 넘침만 직접 잰다 — 타이포를 건드리는 변경의 레이아웃 회귀를 잡는 게 목적이다.
    // 가로만 본다: 세로는 스크롤이 정상인 자리가 많아 오탐이 크다.
    const tolerance = KNOWN_OVERFLOW_TOLERANCE_PX.get(context.title) ?? 0;

    const overflows = await page.evaluate(async (tolerancePx: number) => {
      // 폰트가 도착하기 전에 재면 안 된다. 스토리북은 Pretendard 를 외부 CDN 에서 받는데
      // (.storybook/preview-head.html), 러너에는 스택 첫 폰트("Apple SD Gothic Neo")도 없어
      // 그 사이 한글이 폴백 폰트로 그려진다 — 폴백은 더 넓어서 같은 코드가 한 번은 통과하고
      // 한 번은 넘친다. 실제로 CI 에서 커밋 하나를 두고 결과가 갈렸다(FRT-338).
      // 재는 시점을 폰트 로딩 뒤로 고정해 게이트를 동전 던지기에서 꺼낸다.
      await document.fonts.ready;

      // 스크롤 루트(html·body)를 함께 본다. 스토리 내용이 화면을 통째로 밀어내면 자손들은
      // 저마다 scrollWidth === clientWidth 로 멀쩡해 보이고, 넘치는 건 루트뿐이다.
      // "body *" 만 훑으면 이 게이트가 잡으려던 바로 그 경우가 빠져나간다.
      const roots: HTMLElement[] = [document.documentElement, document.body];
      const bad: string[] = [];
      for (const el of [...roots, ...Array.from(document.querySelectorAll<HTMLElement>("body *"))]) {
        // 스스로 스크롤·숨김을 처리하는 요소는 넘쳐도 정상이다.
        if (getComputedStyle(el).overflowX !== "visible") continue;
        // 1px 여유: 소수점 레이아웃에서 반올림으로 생기는 오탐을 거른다.
        // tolerancePx: 도입 시점에 이미 넘치던 스토리의 알려진 폭. 그보다 더 벌어지면 잡힌다.
        if (el.scrollWidth > el.clientWidth + 1 + tolerancePx) {
          const cls = typeof el.className === "string" ? el.className.trim() : "";
          const id = el.tagName.toLowerCase() + (cls ? `.${cls.split(/\s+/).join(".")}` : "");
          bad.push(`${id} (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth})`);
        }
      }
      return bad.slice(0, 10);
    }, tolerance);

    // 예외 검사는 **측정이 끝난 뒤** 한다. 위에서 document.fonts.ready 를 기다리는 동안, 또는 그
    // 평가가 도는 동안 터진 예외도 이 스토리의 것이다 — 대기 앞에서만 보면 그 창이 통째로 샌다.
    // 넘침보다 먼저 던진다: 예외는 화면이 제대로 그려지지 않았다는 더 근본적인 신호다.
    if (errors.length > 0) {
      const detail = errors.map((e) => e.message || String(e)).join("\n");
      throw new Error(
        `"${context.title} / ${context.name}" 스토리에서 잡히지 않은 런타임 예외 ${errors.length}건 발생:\n${detail}`,
      );
    }

    if (overflows.length > 0) {
      throw new Error(
        `"${context.title} / ${context.name}" 스토리에서 가로 넘침 ${overflows.length}건:\n${overflows.join("\n")}`,
      );
    }
  },
};

export default config;
