"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, DatePicker, Input, toast } from "@/components/ui";
import { SocialLoginButtons } from "@/components/features/auth/SocialLoginButtons";
import { createOAuthState } from "@/lib/auth/oauth-state";
import { api, ApiError } from "@/lib/api/client";
import { capture, markSignupCompletedIfUnseen, useFlowExit } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import { VerifyEmailResponse } from "@/types/auth";
import { ConsentStep } from "@/components/features/auth/ConsentStep";
import { type ConsentPayload } from "@/lib/auth/consent";
import {
  type Step,
  type AffiliationStatus,
  CONSENT_ENABLED,
  FIRST_ONBOARDING_STEP,
  ONBOARDING_STEPS,
  STEP_ORDER,
  Q1_OPTIONS,
  INTEREST_OPTIONS,
  AFFILIATION_OPTIONS,
  stepVariants,
  stepTransition,
  formatPhone,
} from "../constants";

/* ── Page ────────────────────────────────────────────────── */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  // 인증 사용자는 온보딩 단계(consent/profile/q1/q2)에서만 머무를 수 있다.
  // start/password/verify 등에서는 /signup?step=consent 으로 보내 흐름을 강제한다.
  const stepParam = searchParams.get("step") as Step | null;
  const isOnOnboardingStep = stepParam !== null && ONBOARDING_STEPS.includes(stepParam);
  const { shouldRedirect } = useRedirectIfAuthenticated({ allowOnboardingFlow: isOnOnboardingStep });
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

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
  const [affiliation, setAffiliation] = useState<AffiliationStatus | "">("");
  const [school, setSchool] = useState("");
  const [department, setDepartment] = useState("");
  const [company, setCompany] = useState("");
  const [desiredRole, setDesiredRole] = useState("");
  const [affiliationDetail, setAffiliationDetail] = useState("");
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
  const [worries, setWorries] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  // Verify fields
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  // 인증 흐름의 세대. 가입이 성공할 때마다 올라간다 — 재발송 응답이 자기 흐름의 것인지 판정한다.
  const verifyFlowId = useRef(0);
  const [isResending, setIsResending] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);

  // 로그인 페이지에서 리다이렉트된 경우 URL 파라미터로 상태 복원
  useEffect(() => {
    const stepParam = searchParams.get("step") as Step | null;
    const emailParam = searchParams.get("email");
    // URLSearchParams.get()은 이미 디코딩된 값을 반환하므로 decodeURIComponent 불필요
    if (emailParam) setEmail(emailParam);
    if (stepParam && STEP_ORDER.includes(stepParam)) {
      // 동의 활성 시, URL로 후속 온보딩 스텝(profile/q1/q2)에 직접 진입하는 것(stale 링크·수동 URL)을
      // consent 로 되돌려 동의 없이 프로필 단계로 들어가지 못하게 한다(서버 강제의 UX 보조).
      // 정상 흐름은 consent 제출 후 goTo 로 진행하므로 영향받지 않는다.
      const bypassesConsent =
        CONSENT_ENABLED && stepParam !== "consent" && ONBOARDING_STEPS.includes(stepParam);
      setStep(bypassesConsent ? "consent" : stepParam);
    }
  }, [searchParams]);

  // 이미 인증된 사용자가 verify 단계에 머무르지 않도록 강제 이탈 → 첫 온보딩 스텝(consent)
  useEffect(() => {
    if (step === "verify" && !isAuthLoading && isAuthenticated) {
      goTo(FIRST_ONBOARDING_STEP);
    }
  }, [step, isAuthenticated, isAuthLoading]);

  const onboardingIndex = ONBOARDING_STEPS.indexOf(step);
  const isOnboarding = onboardingIndex >= 0;

  // 온보딩 스텝을 **그리고 있다**고 온보딩 중인 사람인 건 아니다. 이미 마친 사용자가 stale
  // 링크·뒤로가기로 이 URL 에 닿으면 리다이렉트가 화면을 걷어낼 때까지 스텝이 잠깐 렌더되는데,
  // 그 찰나를 세면 스텝 조회가 부풀고 곧이어 이탈까지 한 건 남는다 — 아무도 헤맨 적 없는 자리에.
  //
  // 판정이 끝나기 전(isAuthLoading)에도 시작하지 않는다. 미리 시작해 두면 판정이 "자격 없음"으로
  // 끝나는 순간 그 비활성화가 **그대로 이탈로 발화한다**(떠난 게 아니라 애초에 못 들어온 건데도).
  // 계측 전용 축이라 진행 점(isOnboarding)과 분리한다 — 화면은 지금대로 둔다.
  const isOnboardingActive = isOnboarding && !isAuthLoading && !shouldRedirect;

  // FRT-107: 온보딩은 라우트가 하나(step state)라 스텝 진입이 **어떤 방법으로도** 관측되지
  // 않는다 — capture_pageview 를 켜더라도 URL 이 안 바뀐다. 어느 스텝에서 오래 머물고
  // 어디서 그만두는지는 이 두 이벤트에만 남는다.
  //
  // 같은 스텝이 연속으로 다시 발화하지 않게만 막는다(StrictMode 이중 마운트). 뒤로 갔다
  // 다시 온 재진입은 진짜 재조회라 그대로 센다 — 그게 "이 스텝에서 헤맸다"는 신호다.
  //
  // ⚠️ 아래 두 ref 는 값이 같아 보여도 **수명이 다르다.** 하나로 합치면, 흐름을 나갔다
  // 되돌아온 새 세션의 첫 스텝이 직전 세션의 값과 같다는 이유로 조회가 통째로 삼켜진다 —
  // 이탈만 남고 그에 대응하는 스텝 조회가 없는 데이터가 된다.
  //   · lastViewedStepRef      — 중복 방지. 흐름이 꺼지면 **비운다**(다음 진입은 새 세션이다).
  //   · lastOnboardingStepRef  — last_step 스냅샷. 이탈 발화가 읽어야 하므로 **절대 안 비운다**.
  const lastViewedStepRef = useRef<Step | null>(null);
  const lastOnboardingStepRef = useRef<Step | null>(null);
  useEffect(() => {
    if (!isOnboardingActive) {
      lastViewedStepRef.current = null;
      return;
    }
    // 스냅샷은 조회 발화 여부와 무관하게 갱신한다 — 중복이라 조회를 건너뛴 스텝도
    // 사용자가 머문 자리인 건 같다.
    lastOnboardingStepRef.current = step;
    if (lastViewedStepRef.current === step) return;
    lastViewedStepRef.current = step;
    capture("onboarding_step_viewed", { step, step_index: onboardingIndex });
  }, [step, isOnboardingActive, onboardingIndex]);

  const { markCompleted: markOnboardingCompleted } = useFlowExit({
    active: isOnboardingActive,
    onExit: (elapsedSeconds) => {
      capture(
        "onboarding_abandoned",
        {
          // ⚠️ `step` 이 아니다. 흐름을 끄면서 떠나는 경우(「← 이전」으로 온보딩 밖 스텝으로
          // 나가기) 발화는 한 틱 미뤄지는데, 그 사이 렌더가 이 콜백을 **이탈 후 step** 을 쥔
          // 것으로 갈아끼운다. 그대로 쓰면 last_step 이 온보딩에 있지도 않은 "verify" 가 되어
          // 정작 사용자가 그만둔 자리를 가린다. 마지막으로 **머물렀던** 스텝을 새겨 두고 쓴다.
          last_step: lastOnboardingStepRef.current ?? step,
          elapsed_seconds: elapsedSeconds,
        },
        // 온보딩 완료는 하드 내비게이션(window.location.assign)이라, 배치 큐에 담으면
        // 이탈이든 완료든 페이지와 함께 사라진다.
        { atUnload: true },
      );
    },
  });

  function toggleInterest(opt: string) {
    setInterests((prev) =>
      prev.includes(opt) ? prev.filter((i) => i !== opt) : [...prev, opt]
    );
  }

  function toggleWorry(opt: string) {
    setWorries((prev) =>
      prev.includes(opt) ? prev.filter((w) => w !== opt) : [...prev, opt]
    );
  }

  function goTo(next: Step, direction = 1) {
    setDir(direction);
    setStep(next);
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx <= 0) return;
    const prev = STEP_ORDER[idx - 1];
    // 인증된 사용자는 온보딩 흐름 밖(start/password/verify)으로 되돌아갈 수 없다.
    // isAuthLoading 중에도 차단해 레이스 컨디션을 방지한다.
    if ((isAuthenticated || isAuthLoading) && !ONBOARDING_STEPS.includes(prev)) return;
    goTo(prev, -1);
  }

  async function handleSignup() {
    setIsLoading(true);
    setSignupError(null);

    try {
      await api.post("/auth/signup", { email, password }, { auth: false });
      // 여기서부터 새 인증 흐름이다. 재발송 결과는 그 이메일에 매인 진술이라,
      // 「← 이전」으로 돌아가 다른 주소로 다시 가입하면(컴포넌트는 언마운트되지 않는다)
      // 재발송한 적 없는 새 주소 화면에 직전 결과가 그대로 남는다.
      // 세대를 올려 아직 비행 중인 재발송 응답까지 무효로 만든다.
      verifyFlowId.current += 1;
      setResendNotice(null);
      setResendError(null);
      setIsResending(false);
      goTo("verify");
    } catch (e) {
      if (e instanceof ApiError) {
        if(e.code === "EMAIL_ALREADY_EXISTS") setSignupError("이미 존재하는 이메일이에요.")
        else if(e.code === "WEAK_PASSWORD") setSignupError("더 강한 비밀번호를 시도해주세요.")
        else setSignupError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
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
        // 하드 내비게이션으로 AuthProvider를 재마운트·refetch해야 GNB 계정 메뉴가 노출된다.
        window.location.assign("/dashboard");
      } else {
        // 신규 가입(미온보딩)의 이메일 인증 완료 = 가입 완료 확정 지점.
        // onboarded=true 분기는 기존 사용자 재인증이라 signup 으로 잡지 않는다.
        // 온보딩 중도 이탈 후 재인증도 onboarded=false 로 이 분기를 다시 타므로 마커로 막는다.
        if (await markSignupCompletedIfUnseen(email)) {
          capture("signup_completed", { method: "email" });
        }
        goTo(FIRST_ONBOARDING_STEP);
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

  async function handleConsent(payload: ConsentPayload) {
    setIsLoading(true);
    setConsentError(null);

    try {
      await api.post("/auth/consent", payload, { auth: true });
      goTo("profile");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "AUTH_TOKEN_EXPIRED" || e.code === "AUTH_MISSING_COOKIES" || e.code === "AUTH_TOKEN_INVALID") {
          setConsentError("로그인 정보가 만료되었어요. 다시 로그인해주세요.");
        } else {
          setConsentError(e.message);
        }
      } else {
        setConsentError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  // 재발송은 자체 in-flight 상태로 막는다. 빠른 더블탭이 resend-verification 을 동시
  // 호출하면 백엔드가 코드를 새로 발급/무효화하거나 즉시 rate limit 될 수 있다.
  async function handleResendCode() {
    if (isResending) return;
    const flowId = verifyFlowId.current;
    setIsResending(true);
    // 성공·실패 슬롯을 함께 비운다. 한쪽만 비우면 직전 회차 결과가 이번 결과와 나란히 남는다.
    setResendError(null);
    setResendNotice(null);

    // 결과를 곧바로 쓰지 않고 모아 둔다 — 화면에 반영할 자격은 아래 세대 판정이 정한다.
    let notice: string | null = null;
    let error: string | null = null;
    try {
      await api.post("/auth/resend-verification", { email }, { auth: false });
      notice = "코드를 다시 보냈어요.";
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 429) error = "5분 후 재발송 가능해요.";
        else if (e.status === 400) error = "이미 인증된 이메일이에요.";
        else error = e.message;
      } else {
        // client.ts 의 request() 는 fetch reject(네트워크 단절 등)를 ApiError 로 감싸지 않고
        // 그대로 던진다. else 가 없으면 아무 안내도 뜨지 않는다.
        error = "네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
      }
    }

    // 응답을 기다리는 동안 「← 이전」으로 빠져나가 다른 이메일로 다시 가입했을 수 있다.
    // 그 경우 이 결과는 이미 사라진 흐름의 것이라 새 화면에 찍으면 거짓 안내가 된다.
    // 새 흐름이 isResending 까지 초기화하므로 여기서는 아무것도 되돌리지 않는다.
    if (verifyFlowId.current !== flowId) return;
    setResendNotice(notice);
    setResendError(error);
    setIsResending(false);
  }

  // 이메일로 계속(가입 경로 선택) — 소셜과 갈라 채널별 전환 차이를 본다.
  function handleEmailContinue() {
    if (!email) return;
    capture("signup_method_selected", { method: "email" });
    goTo("password");
  }

  function handleSocial() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setSocialError("Google 로그인을 사용할 수 없어요");
      return;
    }
    capture("signup_method_selected", { method: "google" });
    const redirectUri = `${window.location.origin}/callback/google`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state: createOAuthState(),
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async function handleFinish() {
    setIsLoading(true);

    try {
      await api.post("/auth/onboarding", {
        name,
        birth,
        ...(affiliation && { affiliation }),
        ...(affiliation === "student"   && school.trim()            && { school }),
        ...(affiliation === "student"   && department.trim()        && { department }),
        ...(affiliation === "employed"  && company.trim()           && { company }),
        ...(affiliation === "jobseeker" && desiredRole.trim()       && { desiredRole }),
        ...(affiliation === "other"     && affiliationDetail.trim() && { affiliationDetail }),
        ...(phone             && { phone }),
        ...(worries.length > 0   && { worry: worries }),
        ...(interests.length > 0 && { interest: interests }),
      }, { auth: false });
      // 온보딩 완료 확정 지점(성공 응답). DUPLICATE_ONBOARDING(이미 완료 재진입)은
      // 아래 catch 에서 별도 처리하며 중복 발화하지 않는다.
      capture("onboarding_completed", {});
      // 여기서부터 이 온보딩은 이탈이 아니다(FRT-107). 아래 하드 내비게이션이 pagehide 를
      // 부르므로, 이 표시가 먼저 서야 완료가 이탈로도 집계되지 않는다.
      markOnboardingCompleted();
      // 하드 내비게이션으로 AuthProvider를 재마운트·refetch해야 온보딩 직후 GNB 계정 메뉴가 노출된다.
      window.location.assign("/dashboard");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "AUTH_TOKEN_EXPIRED") {
          toast.error("세션이 만료되었어요. 다시 로그인해주세요.");
        } else if (e.code === "AUTH_MISSING_COOKIES" || e.code === "AUTH_TOKEN_INVALID") {
          toast.error("로그인 정보가 정확하지 않아요. 다시 로그인해주세요.")
        } else if (e.code === "DUPLICATE_ONBOARDING") {
          // 이미 온보딩 완료 — 대시보드로 이동 (하드 내비게이션으로 auth 재동기화)
          // 완료 이벤트는 중복이라 안 쏘지만 이탈도 아니다. 표시를 안 세우면 이 재진입이
          // 곧바로 onboarding_abandoned 로 잡혀 이탈률이 부풀어 오른다(FRT-107).
          markOnboardingCompleted();
          window.location.assign("/dashboard");
        } else if (e.code === "INVALID_INPUT") {
          toast.error("입력 정보를 다시 확인해주세요.");
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const birthValid = /^\d{4}-\d{2}-\d{2}$/.test(birth);
  const profileComplete =
    name.trim().length > 0 &&
    birthValid &&
    phone.length === 11;
  if (shouldRedirect) return null;

  return (
    <div className="w-full max-w-lg">
      {/* Back */}
      <div className="h-8 mb-3 flex items-center">
        {step !== "start" && !((isAuthenticated || isAuthLoading) && step === FIRST_ONBOARDING_STEP) && (
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
                    onKeyDown={(e) => e.key === "Enter" && handleEmailContinue()}
                  />
                  <Button
                    onClick={handleEmailContinue}
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
                  <p role="alert" aria-live="polite" className="mt-2 text-center text-body-sm text-text-tertiary">{socialError}</p>
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
                  <Input
                    label="비밀번호"
                    type={showPw ? "text" : "password"}
                    placeholder="영문+숫자 8자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-14"
                    rightAddon={
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="text-caption text-text-tertiary
                                   hover:text-text-secondary transition-colors cursor-pointer select-none"
                      >
                        {showPw ? "숨기기" : "보기"}
                      </button>
                    }
                  />
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
                  <Input
                    label="비밀번호 확인"
                    type={showConfirmPw ? "text" : "password"}
                    placeholder="비밀번호를 다시 입력해주세요"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    error={confirmPw.length > 0 && !pwMatch ? "비밀번호가 일치하지 않아요" : undefined}
                    className="pr-14"
                    rightAddon={
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw((v) => !v)}
                        className="text-caption text-text-tertiary
                                   hover:text-text-secondary transition-colors cursor-pointer select-none"
                      >
                        {showConfirmPw ? "숨기기" : "보기"}
                      </button>
                    }
                  />
                  {/* 가입 실패는 「가입하기」에 포커스가 머문 채 비동기로 나타난다.
                      역할이 없으면 스크린리더에는 아무 일도 일어나지 않은 것과 같다(FRT-282). */}
                  {signupError && (
                    <p role="alert" aria-live="polite" className="text-body-sm text-error">{signupError}</p>
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
                    <p role="alert" aria-live="polite" className="text-body-sm text-error">{verifyError}</p>
                  )}
                  <Button onClick={handleVerify} disabled={!verifyCode.trim() || isLoading}>
                    {isLoading ? "확인 중..." : "확인"}
                  </Button>
                  {/* 재발송 결과는 버튼에 포커스가 머문 채 비동기로 나타난다.
                      역할을 주지 않으면 스크린리더 사용자에게는 아무 일도 일어나지 않은 것과 같다. */}
                  {resendError && (
                    <p role="alert" aria-live="polite" className="text-body-sm text-error">{resendError}</p>
                  )}
                  {resendNotice && (
                    <p role="status" aria-live="polite" className="text-body-sm text-text-tertiary">{resendNotice}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading || isResending}
                    className="w-full h-12 rounded-md border border-border text-text-secondary
                               text-body font-medium hover:bg-surface-secondary transition-colors cursor-pointer
                               disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    {isResending ? "보내는 중..." : "코드 재발송"}
                  </button>
                </div>
              </div>
            )}

            {/* ── consent ──────────────────────────── */}
            {step === "consent" && (
              <ConsentStep onSubmit={handleConsent} isLoading={isLoading} error={consentError} />
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
                  <DatePicker
                    label="생년월일"
                    value={birth}
                    onChange={(e) => setBirth(e.target.value)}
                  />
                </div>

                {/* 전화번호 */}
                <div className="mb-5">
                  <Input
                    label="전화번호"
                    type="tel"
                    placeholder="010-0000-0000"
                    hint="필수 입력이에요"
                    value={formatPhone(phone)}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  />
                </div>

                {/* 현재 상태 (선택) */}
                {/* 선택 여부가 색상으로만 바뀌면 스크린리더에는 아무것도 전달되지 않는다(FRT-296).
                    다시 눌러 해제되는 토글이라 radio 가 아니라 aria-pressed 로 상태를 노출한다.
                    묶음 이름이 없으면 "무엇에 대한 선택인지"가 여전히 들리지 않아 group 으로 감싼다. */}
                <div
                  className="mb-5"
                  role="group"
                  aria-labelledby="signup-affiliation-label"
                  aria-describedby="signup-affiliation-hint"
                >
                  <span
                    id="signup-affiliation-label"
                    className="block text-label text-text-primary mb-2"
                  >
                    현재 상태
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {AFFILIATION_OPTIONS.map((opt) => {
                      const active = affiliation === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setAffiliation(active ? "" : opt.value);
                            setSchool("");
                            setDepartment("");
                            setCompany("");
                            setDesiredRole("");
                            setAffiliationDetail("");
                          }}
                          className={[
                            "h-11 rounded-xl border-2 text-body-sm font-semibold",
                            "transition-all duration-150 cursor-pointer",
                            active
                              ? "border-brand bg-surface-brand text-brand"
                              : "border-border bg-surface text-text-primary hover:border-brand/40 hover:bg-surface-brand/30",
                          ].join(" ")}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p
                    id="signup-affiliation-hint"
                    className="mt-1.5 text-caption text-text-tertiary"
                  >
                    선택 사항이에요
                  </p>
                </div>

                {/* 상태별 조건부 입력 */}
                {affiliation === "student" && (
                  <>
                    <div className="mb-5">
                      <Input
                        label="학교"
                        type="text"
                        placeholder="예) 서울대학교"
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                      />
                    </div>
                    <div className="mb-6">
                      <Input
                        label="학과"
                        type="text"
                        placeholder="예) 컴퓨터공학과"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {affiliation === "employed" && (
                  <div className="mb-6">
                    <Input
                      label="직장명"
                      type="text"
                      placeholder="예) 삼성전자"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                )}

                {affiliation === "jobseeker" && (
                  <div className="mb-6">
                    <Input
                      label="관심 직무/분야"
                      type="text"
                      placeholder="예) 백엔드 개발, 프로덕트 기획"
                      value={desiredRole}
                      onChange={(e) => setDesiredRole(e.target.value)}
                    />
                  </div>
                )}

                {affiliation === "other" && (
                  <div className="mb-6">
                    <Input
                      label="소속"
                      type="text"
                      placeholder="현재 소속을 자유롭게 입력해주세요"
                      value={affiliationDetail}
                      onChange={(e) => setAffiliationDetail(e.target.value)}
                    />
                  </div>
                )}

                <Button onClick={() => goTo("q1")} disabled={!profileComplete} fullWidth>
                  다음
                </Button>
              </div>
            )}

            {/* ── q1 ───────────────────────────────── */}
            {step === "q1" && (
              <div>
                <h1 id="signup-q1-heading" className="text-heading-2 text-text-primary mb-1">
                  요즘 가장 고민되는 게 뭐예요?
                </h1>
                <p id="signup-q1-hint" className="text-body text-text-secondary mb-8">
                  복수 선택 가능해요 · 솔직하게 골라도 괜찮아요 😊
                </p>
                <div
                  className="grid grid-cols-2 gap-2.5 mb-6"
                  role="group"
                  aria-labelledby="signup-q1-heading"
                  aria-describedby="signup-q1-hint"
                >
                  {Q1_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={worries.includes(opt)}
                      onClick={() => toggleWorry(opt)}
                      className={[
                        "h-12 rounded-xl border-2 text-body font-semibold",
                        "transition-all duration-150 cursor-pointer",
                        worries.includes(opt)
                          ? "border-brand bg-surface-brand text-brand"
                          : "border-border bg-surface text-text-primary hover:border-brand/40 hover:bg-surface-brand/30",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2.5">
                  <Button onClick={() => goTo("q2")} className="flex-1 w-auto">
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
                <h1 id="signup-q2-heading" className="text-heading-2 text-text-primary mb-1">
                  관심 있는 분야를 골라보세요
                </h1>
                <p id="signup-q2-hint" className="text-body text-text-secondary mb-8">
                  복수 선택 가능해요
                </p>
                <div
                  className="grid grid-cols-2 gap-2.5 mb-6"
                  role="group"
                  aria-labelledby="signup-q2-heading"
                  aria-describedby="signup-q2-hint"
                >
                  {INTEREST_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={interests.includes(opt)}
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
