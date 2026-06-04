// test-storybook:ci 프리플라이트.
//
// test-storybook:ci는 build-storybook 산출물을 6006에 서빙하고 wait-on이 그 포트를 기다린다.
// 그런데 wait-on(tcp:..:6006)은 "포트가 열려 있는지"만 보므로, 다른 프로세스(예: 떠 있던
// storybook dev 서버, 이전 실행의 잔여 http-server)가 이미 6006을 점유하고 있으면 즉시
// 통과해 *우리 빌드가 아닌* 낡은 Storybook을 테스트한다. concurrently -k -s first는 먼저 끝난
// 명령의 종료코드를 채택하므로, 이 경우 빌드 실패가 가려진 false-pass가 발생할 수 있다.
//
// 이를 막기 위해 빌드 전에 포트가 비어 있는지 확인하고, 점유돼 있으면 즉시 실패한다.
// (CI 러너는 항상 비어 있으므로 정상 경로엔 영향 없음.)
import net from "node:net";

const port = Number(process.argv[2] ?? 6006);
const host = "127.0.0.1";

const socket = net.connect(port, host);

socket.once("connect", () => {
  socket.destroy();
  console.error(
    `⛔ 포트 ${port}이(가) 이미 사용 중입니다. test-storybook:ci는 이 포트에 빌드된 Storybook을 서빙합니다.\n` +
      `   다른 Storybook/http-server 프로세스를 종료한 뒤 다시 실행하세요 (낡은 빌드로 false-pass 방지).`,
  );
  process.exit(1);
});

socket.once("error", () => {
  // 연결 실패 = 아무도 듣고 있지 않음 = 포트 사용 가능.
  process.exit(0);
});
