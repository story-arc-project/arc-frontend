"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input } from "@/components/ui";
import { SocialLoginButtons } from "@/components/features/auth/SocialLoginButtons";
import { api, ApiError } from "@/lib/api";

/* ── Types ───────────────────────────────────────────────── */
type Step = "start" | "password" | "verify" | "profile" | "q1" | "q2";

interface VerifyEmailResponse {
  status: string;
  data: { user: { nickname: string; email: string }; onboarded: boolean; expire_at: string };
}

const ONBOARDING_STEPS: Step[] = ["profile", "q1", "q2"];
const STEP_ORDER: Step[] = ["start", "password", "verify", "profile", "q1", "q2"];
const Q1_OPTIONS = [
  "진로/방향성", "취업/인턴", "스펙/자격증",
  "대학원/진학", "창업", "학업/성적", "아직 모름",
] as const;
const INTEREST_OPTIONS = [
  "개발/엔지니어링", "디자인/UX", "데이터/AI", "기획/PM",
  "마케팅/콘텐츠", "경영/컨설팅", "금융/경제", "창업/스타트업",
  "의료/헬스케어", "교육", "미디어/엔터", "법률/공공",
  "연구/학문", "예술/문화", "환경/사회", "아직 모름",
] as const;

function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function formatBirth(digits: string): string {
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}. ${digits.slice(4)}`;
  return `${digits.slice(0, 4)}. ${digits.slice(4, 6)}. ${digits.slice(6)}`;
}

/* ── Animation ───────────────────────────────────────────── */
const stepVariants = {
  enter: (dir: number) => ({ x: dir * 36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -36, opacity: 0 }),
};
const stepTransition = { duration: 0.26, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

/* ── Page ────────────────────────────────────────────────── */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("start");
  const [dir, setDir] = useState(1);

  // Auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Profile fields
  const [birth, setBirth] = useState("");
  const [education, setEducation] = useState("");
  const [phone, setPhone] = useState("");

  // Password strength
  const pwChecks = [
    { label: "8자 이상", pass: password.length >= 8 },
    { label: "영문 포함", pass: /[a-zA-Z]/.test(password) },
    { label: "숫자 포함", pass: /[0-9]/.test(password) },
  ];
  const pwMatch = confirmPw.length > 0 && password === confirmPw;
  const pwValid = pwChecks.every((c) => c.pass) && pwMatch;

  // Onboarding fields
  const [name, setName] = useState("");
  const [q1, setQ1] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  // Verify fields
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);

  // 로그인 페이지에서 리다이렉트된 경우 URL 파라미터로 상태 복원
  useEffect(() => {
    const stepParam = searchParams.get("step") as Step | null;
    const emailParam = searchParams.get("email");
    // URLSearchParams.get()은 이미 디코딩된 값을 반환하므로 decodeURIComponent 불필요
    if (emailParam) setEmail(emailParam);
    if (stepParam && STEP_ORDER.includes(stepParam)) setStep(stepParam);
  }, [searchParams]);

  function toggleInterest(opt: string) {
    setInterests((prev) =>
      prev.includes(opt) ? prev.filter((i) => i !== opt) : [...prev, opt]
    );
  }

  function goTo(next: Step, direction = 1) {
    setDir(direction);
    setStep(next);
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) goTo(STEP_ORDER[idx - 1], -1);
  }

  async function handleSignup() {
    setIsLoading(true);
    setSignupError(null);

    try {
      await api.post("/auth/signup", { email, password }, { auth: false });
      goTo("verify");
    } catch (e) {
      if (e instanceof ApiError) setSignupError(e.message);
      else setSignupError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify() {
    setIsLoading(true);
    setVerifyError(null);

    try {
      const result = await api.post<VerifyEmailResponse>("/auth/verify-email", { email, code: verifyCode }, { auth: false });
      if (result.data.onboarded) {
        // 이미 온보딩 완료된 유저 (재인증 케이스) — FastAPI 쿠키가 이미 설정됨
        router.push("/dashboard");
      } else {
        goTo("profile");
      }
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 410) setVerifyError("인증 코드가 만료되었어요. 재발송 후 다시 시도해주세요.");
        else setVerifyError(e.message);
      } else {
        setVerifyError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    setResendError(null);
    try {
      await api.post("/auth/resend-verification", { email }, { auth: false });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 429) setResendError("5분 후 재발송 가능해요.");
        else if (e.status === 400) setResendError("이미 인증된 이메일이에요.");
        else setResendError(e.message);
      }
    }
  }

  function handleSocial(provider: string) {
    if (provider !== "google") {
      setSocialError("곧 지원 예정이에요");
      setTimeout(() => setSocialError(null), 3000);
      return;
    }
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setSocialError("Google 로그인을 사용할 수 없어요");
      return;
    }
    const redirectUri = `${window.location.origin}/callback/google`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async function handleFinish() {
    setIsLoading(true);

    try {
      const birthFormatted = `${birth.slice(0, 4)}-${birth.slice(4, 6)}-${birth.slice(6, 8)}`;
      await api.post("/auth/onboarding", {
        name,
        birth: birthFormatted,
        ...(education.trim() && { education }),
        ...(phone            && { phone }),
        ...(q1               && { worry: [q1] }),
        ...(interests.length > 0 && { interest: interests }),
      });
    } catch {
      // 온보딩 실패 시 세션 생성은 계속 진행 (데이터는 나중에 재입력 가능)
    }

    router.push("/dashboard");
    setIsLoading(false);
  }

  const birthValid =
    birth.length === 8 &&
    Number(birth.slice(4, 6)) >= 1 && Number(birth.slice(4, 6)) <= 12 &&
    Number(birth.slice(6, 8)) >= 1 && Number(birth.slice(6, 8)) <= 31;
  const profileComplete =
    name.trim().length > 0 &&
    birthValid &&
    phone.length === 11;
  const onboardingIndex = ONBOARDING_STEPS.indexOf(step);
  const isOnboarding = onboardingIndex >= 0;

  return (
    <div className="w-full max-w-lg">
      {/* Back */}
      <div className="h-8 mb-3 flex items-center">
        {step !== "start" && (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-body-sm text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          >
            ← 이전
          </button>
        )}
      </div>

      {/* Onboarding progress */}
      {isOnboarding && (
        <div className="flex items-center gap-1.5 mb-6">
          {ONBOARDING_STEPS.map((s, i) => (
            <div
              key={s}
              className={[
                "h-1 rounded-full transition-all duration-300",
                i <= onboardingIndex ? "bg-brand" : "bg-border",
                i === onboardingIndex ? "w-10" : "w-5",
              ].join(" ")}
            />
          ))}
        </div>
      )}

      {/* Card */}
      <motion.div
        layout
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="sm:bg-surface sm:border sm:border-border sm:rounded-xl sm:shadow-sm px-0 py-0 sm:px-10 sm:py-10 overflow-hidden"
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
          >

            {/* ── start ────────────────────────────── */}
            {step === "start" && (
              <div>
                <h1 className="text-heading-2 text-text-primary mb-1">시작해볼까요</h1>
                <p className="text-body text-text-secondary mb-6">
                  이메일 또는 소셜 계정으로 가입해요
                </p>

                <div className="flex flex-col gap-3 mb-5">
                  <Input
                    label="이메일"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && email && goTo("password")}
                  />
                  <Button
                    onClick={() => goTo("password")}
                    disabled={!email}
                  >
                    이메일로 계속하기
                  </Button>
                </div>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-caption text-text-tertiary">또는</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                <SocialLoginButtons onLogin={handleSocial} action="시작하기" />
                {socialError && (
                  <p className="mt-2 text-center text-body-sm text-text-tertiary">{socialError}</p>
                )}

                <p className="mt-6 text-center text-body-sm text-text-secondary">
                  이미 계정이 있으신가요?{" "}
                  <Link href="/login" className="text-brand font-medium hover:underline">
                    로그인
                  </Link>
                </p>
              </div>
            )}

            {/* ── password ─────────────────────────── */}
            {step === "password" && (
              <div>
                <p className="text-caption text-text-tertiary mb-1 truncate">{email}</p>
                <h1 className="text-heading-2 text-text-primary mb-1">비밀번호를 설정해주세요</h1>
                <p className="text-body text-text-secondary mb-8">8자 이상이면 충분해요</p>

                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Input
                      label="비밀번호"
                      type={showPw ? "text" : "password"}
                      placeholder="영문+숫자 8자 이상"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-[38px] text-caption text-text-tertiary
                                 hover:text-text-secondary transition-colors cursor-pointer select-none"
                    >
                      {showPw ? "숨기기" : "보기"}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="flex gap-3">
                      {pwChecks.map((c) => (
                        <div key={c.label} className="flex items-center gap-1">
                          <div className={[
                            "w-1.5 h-1.5 rounded-full transition-colors duration-150",
                            c.pass ? "bg-success" : "bg-border",
                          ].join(" ")} />
                          <span className={[
                            "text-caption transition-colors duration-150",
                            c.pass ? "text-success" : "text-text-tertiary",
                          ].join(" ")}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Input
                      label="비밀번호 확인"
                      type={showConfirmPw ? "text" : "password"}
                      placeholder="비밀번호를 다시 입력해주세요"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      error={confirmPw.length > 0 && !pwMatch ? "비밀번호가 일치하지 않아요" : undefined}
                      className="pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-3 top-[38px] text-caption text-text-tertiary
                                 hover:text-text-secondary transition-colors cursor-pointer select-none"
                    >
                      {showConfirmPw ? "숨기기" : "보기"}
                    </button>
                  </div>
                  {signupError && (
                    <p className="text-body-sm text-error">{signupError}</p>
                  )}
                  <Button onClick={handleSignup} disabled={!pwValid || isLoading}>
                    {isLoading ? "처리 중..." : "가입하기"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── verify ───────────────────────────── */}
            {step === "verify" && (
              <div>
                <div className="text-display mb-5 leading-none text-center">✉️</div>
                <h1 className="text-heading-2 text-text-primary mb-1">인증 코드를 입력해주세요</h1>
                <p className="text-body text-text-secondary mb-8">
                  <span className="font-medium text-text-primary">{email}</span>으로 코드를 보냈어요
                </p>

                <div className="flex flex-col gap-3">
                  <Input
                    label="인증 코드"
                    type="text"
                    placeholder="코드 6자리 입력"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verifyCode.trim() && handleVerify()}
                  />
                  {verifyError && (
                    <p className="text-body-sm text-error">{verifyError}</p>
                  )}
                  <Button onClick={handleVerify} disabled={!verifyCode.trim() || isLoading}>
                    {isLoading ? "확인 중..." : "확인"}
                  </Button>
                  {resendError && (
                    <p className="text-body-sm text-error">{resendError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="w-full h-12 rounded-md border border-border text-text-secondary
                               text-body font-medium hover:bg-surface-secondary transition-colors cursor-pointer"
                  >
                    코드 재발송
                  </button>
                </div>
              </div>
            )}

            {/* ── profile ──────────────────────────── */}
            {step === "profile" && (
              <div>
                <h1 className="text-heading-2 text-text-primary mb-1">기본 정보를 알려주세요</h1>
                <p className="text-body text-text-secondary mb-7">
                  맞춤 경험을 제공하는 데 사용돼요
                </p>

                {/* 이름 */}
                <div className="mb-5">
                  <Input
                    label="이름"
                    type="text"
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* 생년월일 */}
                <div className="mb-5">
                  <Input
                    label="생년월일"
                    type="text"
                    inputMode="numeric"
                    placeholder="YYYY. MM. DD"
                    value={formatBirth(birth)}
                    onChange={(e) => setBirth(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  />
                </div>

                {/* 전화번호 */}
                <div className="mb-5">
                  <Input
                    label="전화번호"
                    type="tel"
                    placeholder="010-0000-0000"
                    value={formatPhone(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  />
                </div>

                {/* 소속 (선택) */}
                <div className="mb-6">
                  <Input
                    label="소속"
                    type="text"
                    placeholder="예) 서울대학교 컴퓨터공학과, 삼성전자 재직 중"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                  />
                  <p className="mt-1.5 text-caption text-text-tertiary">선택 사항이에요</p>
                </div>

                <Button onClick={() => goTo("q1")} disabled={!profileComplete} fullWidth>
                  다음
                </Button>
              </div>
            )}

            {/* ── q1 ───────────────────────────────── */}
            {step === "q1" && (
              <div>
                <h1 className="text-heading-2 text-text-primary mb-1">
                  요즘 가장 고민되는 게 뭐예요?
                </h1>
                <p className="text-body text-text-secondary mb-8">
                  솔직하게 골라도 괜찮아요 😊
                </p>
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {Q1_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setQ1(opt)}
                      className={[
                        "h-12 rounded-xl border-2 text-body font-semibold",
                        "transition-all duration-150 cursor-pointer",
                        q1 === opt
                          ? "border-brand bg-surface-brand text-brand"
                          : "border-border bg-surface text-text-primary hover:border-brand/40 hover:bg-surface-brand/30",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2.5">
                  <Button onClick={() => goTo("q2")} disabled={!q1} className="flex-1 w-auto">
                    다음
                  </Button>
                  <button
                    type="button"
                    onClick={() => goTo("q2")}
                    className="h-12 px-5 rounded-md border border-border text-text-secondary
                               text-body font-medium hover:bg-surface-secondary transition-colors cursor-pointer"
                  >
                    건너뛰기
                  </button>
                </div>
              </div>
            )}

            {/* ── q2 ───────────────────────────────── */}
            {step === "q2" && (
              <div>
                <h1 className="text-heading-2 text-text-primary mb-1">
                  관심 있는 분야를 골라보세요
                </h1>
                <p className="text-body text-text-secondary mb-8">
                  복수 선택 가능해요
                </p>
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {INTEREST_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleInterest(opt)}
                      className={[
                        "h-12 rounded-xl border-2 text-body font-semibold",
                        "transition-all duration-150 cursor-pointer",
                        interests.includes(opt)
                          ? "border-brand bg-surface-brand text-brand"
                          : "border-border bg-surface text-text-primary hover:border-brand/40 hover:bg-surface-brand/30",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {signupError && (
                  <p className="text-body-sm text-error mb-2">{signupError}</p>
                )}
                <Button onClick={handleFinish} disabled={isLoading} fullWidth>
                  {isLoading ? "처리 중..." : interests.length > 0 ? "ARC 시작하기" : "나중에 채울게요 →"}
                </Button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
