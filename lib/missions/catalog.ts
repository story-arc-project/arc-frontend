import type { MissionDefinition, MissionId } from "./types";
export const MISSIONS: MissionDefinition[] = [
  {
    id: "M1", title: "30분 심층 인터뷰", description: "실제 사용 경험을 인터뷰에서 들려주세요.", reward: 60, limit: "월 1회", verification: "실제 참여 후 확인", retroactive: false, kind: "external"
  },
  {
    id: "M2", title: "상세 사용 후기", description: "실제 사용 경험을 담은 공개 후기를 남겨주세요.", reward: 40, limit: "월 1회", verification: "후기 주소 제출·검토", retroactive: false, kind: "evidence"
  },
  {
    id: "M3", title: "친구 초대 성공", description: "가입 → 3일 활동 → 기록 2건 조건을 충족하면 완료돼요.", reward: 10, limit: "월 최대 20명", verification: "가입·3일 활동·기록 2건", retroactive: false, kind: "invite"
  },
  {
    id: "M4", title: "서비스 개선 설문", description: "서비스 개선을 위한 설문에 참여해 주세요.", reward: 20, limit: "새 설문마다", verification: "지정 설문 응답 완료", retroactive: false, kind: "external"
  },
  {
    id: "M5", title: "신규 기능 베타 테스트", description: "새 기능을 사용하고 의견을 들려주세요.", reward: 15, limit: "새 기능/테스트마다", verification: "과제 수행·의견 제출 확인", retroactive: false, kind: "external"
  },
  {
    id: "M6", title: "SNS 공유", description: "공개 게시물로 ARC 사용 경험을 공유해 주세요.", reward: 5, limit: "월 2회", verification: "공유 증빙 검토", retroactive: false, kind: "evidence"
  },
  {
    id: "M7", title: "프로필 100% 완성", description: "프로필을 완성해 주세요.", reward: 5, limit: "최초 1회", verification: "기존 서버 완성 기준", retroactive: true, kind: "automatic"
  },
  {
    id: "M8", title: "첫 아카이빙", description: "첫 기록을 저장해 보세요.", reward: 3, limit: "최초 1회", verification: "첫 기록 저장 완료", retroactive: true, kind: "automatic"
  },
  {
    id: "M9", title: "첫 AI 분석", description: "첫 AI 분석을 완료해 보세요.", reward: 2, limit: "최초 1회", verification: "첫 분석 성공", retroactive: true, kind: "automatic"
  },
  {
    id: "M10", title: "앱 알림 수신 동의", description: "앱 알림 수신을 설정해 주세요.", reward: 2, limit: "최초 1회", verification: "동의·수신 설정 확인", retroactive: true, kind: "automatic"
  },
];
export function getMission(id: MissionId): MissionDefinition {
  return MISSIONS.find(m => m.id === id)!;
}
