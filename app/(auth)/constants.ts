/* ── Auth page shared constants ────────────────────────── */

/** FastAPI base URL for direct browser → API calls (login page) */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ── Social login error messages ──────────────────────── */
export const SOCIAL_ERROR_MESSAGES: Record<string, string> = {
  social_cancelled: "Google 로그인이 취소됐어요.",
  social_failed: "Google 로그인에 실패했어요. 다시 시도해주세요.",
  already_exists: "이미 이메일로 가입된 계정이에요. 이메일로 로그인해주세요.",
};

/* ── Signup steps ─────────────────────────────────────── */
export type Step = "start" | "password" | "verify" | "profile" | "q1" | "q2";

export const ONBOARDING_STEPS: Step[] = ["profile", "q1", "q2"];
export const STEP_ORDER: Step[] = ["start", "password", "verify", "profile", "q1", "q2"];

/* ── Onboarding options ───────────────────────────────── */
export const Q1_OPTIONS = [
  "진로/방향성", "취업/인턴", "스펙/자격증",
  "대학원/진학", "창업", "학업/성적", "아직 모름",
] as const;

export const INTEREST_OPTIONS = [
  "개발/엔지니어링", "디자인/UX", "데이터/AI", "기획/PM",
  "마케팅/콘텐츠", "경영/컨설팅", "금융/경제", "창업/스타트업",
  "의료/헬스케어", "교육", "미디어/엔터", "법률/공공",
  "연구/학문", "예술/문화", "환경/사회", "아직 모름",
] as const;

/* ── Shared animations ────────────────────────────────── */
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Login page stagger container */
export const loginContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const loginItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Signup page step transition */
export const stepVariants = {
  enter: (dir: number) => ({ x: dir * 36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -36, opacity: 0 }),
};

export const stepTransition = { duration: 0.26, ease: EASE_OUT };

/* ── Formatting helpers ───────────────────────────────── */
export function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function formatBirth(digits: string): string {
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}. ${digits.slice(4)}`;
  return `${digits.slice(0, 4)}. ${digits.slice(4, 6)}. ${digits.slice(6)}`;
}
