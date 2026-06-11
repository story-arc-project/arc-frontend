"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { requestPasswordReset, verifyResetCode, resetPassword } from "@/lib/api/auth-api";
import { passwordChecks, isPasswordValid } from "@/lib/auth/password";
import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import { PASSWORD_RESET_ENABLED, stepVariants, stepTransition } from "../constants";

/* ── Steps ───────────────────────────────────────────────── */
type ResetStep = "email" | "code" | "password";
const STEP_ORDER: ResetStep[] = ["email", "code", "password"];

/* ── Page ────────────────────────────────────────────────── */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const router = useRouter();
  const { shouldRedirect } = useRedirectIfAuthenticated();

  // 플래그 off(기본·BAC-2 미배포)면 라우트 자체를 막는다. 로그인 링크 숨김만으로는
  // 북마크/수동 URL 진입을 못 막아 깨진 흐름이 노출된다(Codex P2).
  useEffect(() => {
    if (!PASSWORD_RESET_ENABLED) router.replace("/login");
  }, [router]);

  const [step, setStep] = useState<ResetStep>("email");
  const [dir, setDir] = useState(1);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // 비밀번호 강도(공용 규칙) + 확인 일치
  const pwChecks = passwordChecks(password);
  const pwMatch = confirmPw.length > 0 && password === confirmPw;
  const pwValid = isPasswordValid(password) && pwMatch;

  function goTo(next: ResetStep, direction = 1) {
    setDir(direction);
    setStep(next);
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx <= 0) return;
    goTo(STEP_ORDER[idx - 1], -1);
  }

  // ── email: 재설정 코드 발송 ─────────────────────────────
  // 가입 여부와 무관하게 항상 코드 단계로 진행한다(enumeration 방지). 429만 별도 안내.
  async function handleRequestCode() {
    setIsLoading(true);
    setEmailError(null);
    try {
      await requestPasswordReset(email);
      setCode("");
      setCodeError(null);
      setResendNotice(null);
      goTo("code");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setEmailError("잠시 후 다시 시도해주세요.");
      } else {
        setEmailError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  // ── code: 코드 즉시 검증(소모하지 않음) ─────────────────
  async function handleVerifyCode() {
    setIsLoading(true);
    setCodeError(null);
    try {
      await verifyResetCode(email, code.trim());
      setPassword("");
      setConfirmPw("");
      setPwError(null);
      goTo("password");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 410) setCodeError("인증 코드가 만료되었어요. 재발송 후 다시 시도해주세요.");
        else if (e.status === 429) setCodeError("시도 횟수를 초과했어요. 잠시 후 다시 시도해주세요.");
        else if (e.status === 400 || e.status === 401 || e.code === "INVALID_CODE")
          setCodeError("인증 코드가 올바르지 않아요.");
        // 그 외(500/503/404 등)는 코드 문제가 아니므로 코드 오답으로 오인시키지 않는다.
        else setCodeError("일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      } else {
        setCodeError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  // 재발송은 자체 in-flight 상태로 막는다. 빠른 더블탭이 forgot-password 를 동시
  // 호출하면 백엔드가 코드를 새로 발급/무효화하거나 즉시 rate limit 될 수 있다(Codex P2).
  async function handleResendCode() {
    if (isResending) return;
    setIsResending(true);
    setResendNotice(null);
    setCodeError(null);
    try {
      await requestPasswordReset(email);
      setResendNotice("코드를 다시 보냈어요.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setResendNotice("5분 후 재발송 가능해요.");
      else setResendNotice("재발송에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsResending(false);
    }
  }

  // ── password: 코드 재검증 + 새 비밀번호 설정 ────────────
  async function handleReset() {
    setIsLoading(true);
    setPwError(null);
    try {
      await resetPassword(email, code.trim(), password);
      // 성공 배너는 로그인 화면에서 ?reset=1 로 표시한다(내비게이션 후에도 살아남음).
      router.push("/login?reset=1");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "WEAK_PASSWORD") {
          setPwError("더 강한 비밀번호를 시도해주세요.");
        } else if (e.status === 429) {
          // rate limit 은 새 코드로 해결되지 않는다 — 비번 단계를 버리지 않고 대기 안내.
          setPwError("시도 횟수를 초과했어요. 잠시 후 다시 시도해주세요.");
        } else if (e.status === 410 || e.code === "INVALID_CODE") {
          // 검증~설정 사이 코드가 만료·무효화된 경우에만 코드 단계로 되돌린다.
          setCodeError("인증 코드가 만료되었어요. 코드를 다시 받아주세요.");
          goTo("code", -1);
        } else {
          setPwError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
        }
      } else {
        setPwError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (shouldRedirect || !PASSWORD_RESET_ENABLED) return null;

  return (
    <div className="w-full max-w-lg">
      {/* Back */}
      <div className="h-8 mb-3 flex items-center">
        {step !== "email" && (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-body-sm text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          >
            ← 이전
          </button>
        )}
      </div>

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
            {/* ── email ─────────────────────────────── */}
            {step === "email" && (
              <div>
                <h1 className="text-heading-2 text-text-primary mb-1">비밀번호를 잊으셨나요?</h1>
                <p className="text-body text-text-secondary mb-8">
                  가입한 이메일로 재설정 코드를 보내드릴게요
                </p>

                <div className="flex flex-col gap-3">
                  <Input
                    label="이메일"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && email && !isLoading && handleRequestCode()}
                  />
                  {emailError && <p className="text-body-sm text-error">{emailError}</p>}
                  <Button onClick={handleRequestCode} disabled={!email || isLoading}>
                    {isLoading ? "보내는 중..." : "재설정 코드 받기"}
                  </Button>
                </div>

                <p className="mt-6 text-center text-body-sm text-text-secondary">
                  비밀번호가 기억나셨나요?{" "}
                  <Link href="/login" className="text-brand font-medium hover:underline">
                    로그인
                  </Link>
                </p>
              </div>
            )}

            {/* ── code ──────────────────────────────── */}
            {step === "code" && (
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
                    inputMode="numeric"
                    placeholder="코드 6자리 입력"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && code.trim() && !isLoading && handleVerifyCode()}
                  />
                  {codeError && <p className="text-body-sm text-error">{codeError}</p>}
                  <Button onClick={handleVerifyCode} disabled={!code.trim() || isLoading}>
                    {isLoading ? "확인 중..." : "확인"}
                  </Button>
                  {resendNotice && <p className="text-body-sm text-text-tertiary">{resendNotice}</p>}
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

            {/* ── password ──────────────────────────── */}
            {step === "password" && (
              <div>
                <h1 className="text-heading-2 text-text-primary mb-1">새 비밀번호를 설정해주세요</h1>
                <p className="text-body text-text-secondary mb-8">안전한 새 비밀번호로 바꿔요</p>

                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <Input
                      label="새 비밀번호"
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
                          <div
                            className={[
                              "w-1.5 h-1.5 rounded-full transition-colors duration-150",
                              c.pass ? "bg-success" : "bg-border",
                            ].join(" ")}
                          />
                          <span
                            className={[
                              "text-caption transition-colors duration-150",
                              c.pass ? "text-success" : "text-text-tertiary",
                            ].join(" ")}
                          >
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Input
                      label="새 비밀번호 확인"
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
                  {pwError && <p className="text-body-sm text-error">{pwError}</p>}
                  <Button onClick={handleReset} disabled={!pwValid || isLoading}>
                    {isLoading ? "변경 중..." : "비밀번호 변경하기"}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
