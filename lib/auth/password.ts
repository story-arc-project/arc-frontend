// 비밀번호 강도 규칙 (BAC-9 정책과 동일: 영문+숫자 8자 이상).
// 회원가입(signup)·비밀번호 재설정(forgot-password) 화면이 공유한다.
// 후처리(서버 검증)는 백엔드 공용 검증이 담당하고, 여기서는 입력 단계의 시각적 피드백·게이트만 다룬다.

export interface PasswordCheck {
  label: string;
  pass: boolean;
}

/** 비밀번호 강도 체크리스트 — UI 강도 표시에 그대로 매핑한다. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: "8자 이상", pass: password.length >= 8 },
    { label: "영문 포함", pass: /[a-zA-Z]/.test(password) },
    { label: "숫자 포함", pass: /[0-9]/.test(password) },
  ];
}

/** 모든 규칙을 통과하면 true. (비밀번호 확인 일치 여부는 호출부에서 별도 판단) */
export function isPasswordValid(password: string): boolean {
  return passwordChecks(password).every((c) => c.pass);
}
