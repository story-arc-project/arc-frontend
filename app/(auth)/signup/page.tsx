"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input, Textarea } from "@/components/ui";
import { SocialLoginButtons } from "@/components/features/auth/SocialLoginButtons";

/* ── Types ───────────────────────────────────────────────── */
type Step = "start" | "password" | "verify" | "profile" | "nickname" | "q1" | "q2";
type InputMethod = "email" | "phone";

const ONBOARDING_STEPS: Step[] = ["profile", "nickname", "q1", "q2"];
const Q1_OPTIONS = ["진로", "스펙", "아직 모름"] as const;
const EDUCATION_OPTIONS = ["고등학생", "대학생", "대학원생", "졸업생"] as const;

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/* ── Animation ───────────────────────────────────────────── */
const stepVariants = {
  enter: (dir: number) => ({ x: dir * 36, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -36, opacity: 0 }),
};
const stepTransition = { duration: 0.26, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

/* ── Page ────────────────────────────────────────────────── */
export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("start");
  const [dir, setDir] = useState(1);

  // Auth fields
  const [inputMethod, setInputMethod] = useState<InputMethod>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Profile fields
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [education, setEducation] = useState<string | null>(null);
  const [school, setSchool] = useState("");
  const [department, setDepartment] = useState("");
  const needsSchool = education === "대학생" || education === "대학원생" || education === "졸업생";

  // Password strength
  const pwChecks = [
    { label: "8자 이상", pass: password.length >= 8 },
    { label: "영문 포함", pass: /[a-zA-Z]/.test(password) },
    { label: "숫자 포함", pass: /[0-9]/.test(password) },
  ];
  const pwMatch = confirmPw.length > 0 && password === confirmPw;
  const pwValid = pwChecks.every((c) => c.pass) && pwMatch;

  // Onboarding fields
  const [nickname, setNickname] = useState("");
  const [q1, setQ1] = useState<string | null>(null);
  const [q2, setQ2] = useState("");

  // Step order changes based on path
  const EMAIL_ORDER: Step[] = ["start", "password", "verify", "profile", "nickname", "q1", "q2"];
  const PHONE_ORDER: Step[] = ["start", "profile", "nickname", "q1", "q2"];
  const ORDER = inputMethod === "email" ? EMAIL_ORDER : PHONE_ORDER;

  function goTo(next: Step, direction = 1) {
    setDir(direction);
    setStep(next);
  }

  function goBack() {
    const idx = ORDER.indexOf(step);
    if (idx > 0) goTo(ORDER[idx - 1], -1);
  }

  function handleSocial(provider: string) {
    console.log("social:", provider); // API 연동 예정
    goTo("profile");
  }

  function handleFinish() {
    router.push("/dashboard"); // API 연동 예정
  }

  const identifier = inputMethod === "email" ? email : phone;
  const birthComplete = birthYear && birthMonth && birthDay;
  const profileComplete =
    birthComplete &&
    !!education &&
    (!needsSchool || (school.trim().length > 0 && department.trim().length > 0));
  const onboardingIndex = ONBOARDING_STEPS.indexOf(step);
  const isOnboarding = onboardingIndex >= 0;

  return (
    <div className="w-2/3 min-w-80 max-w-lg">
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
        className="bg-surface border border-border rounded-xl px-10 py-10 shadow-sm overflow-hidden"
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

                {/* Email / Phone tab */}
                <div className="flex bg-surface-secondary rounded-lg p-1 mb-4">
                  {(["email", "phone"] as InputMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setInputMethod(m)}
                      className={[
                        "flex-1 h-9 rounded-md text-body-sm font-semibold transition-all duration-150 cursor-pointer",
                        inputMethod === m
                          ? "bg-surface text-text-primary shadow-xs"
                          : "text-text-tertiary hover:text-text-secondary",
                      ].join(" ")}
                    >
                      {m === "email" ? "이메일" : "전화번호"}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3 mb-5">
                  {inputMethod === "email" ? (
                    <Input
                      label="이메일"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && email && goTo("password")}
                    />
                  ) : (
                    <Input
                      label="전화번호"
                      type="tel"
                      placeholder="010-0000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && phone && goTo("profile")}
                    />
                  )}
                  <Button
                    onClick={() => goTo(inputMethod === "email" ? "password" : "profile")}
                    disabled={!(inputMethod === "email" ? email : phone)}
                  >
                    {inputMethod === "email" ? "이메일로 계속하기" : "전화번호로 계속하기"}
                  </Button>
                </div>

                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 border-t border-border" />
                  <span className="text-caption text-text-tertiary">또는</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                <SocialLoginButtons onLogin={handleSocial} action="시작하기" />

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
                <p className="text-caption text-text-tertiary mb-1 truncate">{identifier}</p>
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
                      onKeyDown={(e) => e.key === "Enter" && pwValid && goTo("verify")}
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
                  {/* Password strength indicators */}
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
                  {/* Confirm password */}
                  <div className="relative">
                    <Input
                      label="비밀번호 확인"
                      type={showConfirmPw ? "text" : "password"}
                      placeholder="비밀번호를 다시 입력해주세요"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && pwValid && goTo("verify")}
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
                  <Button onClick={() => goTo("verify")} disabled={!pwValid}>
                    가입하기
                  </Button>
                </div>
              </div>
            )}

            {/* ── verify ───────────────────────────── */}
            {step === "verify" && (
              <div className="text-center py-2">
                <div className="text-display mb-5 leading-none">✉️</div>
                <h1 className="text-heading-2 text-text-primary mb-2">메일함을 확인해주세요</h1>
                <p className="text-body text-text-secondary mb-1">
                  <span className="font-medium text-text-primary">{identifier}</span>으로
                </p>
                <p className="text-body text-text-secondary mb-2">인증 링크를 보냈어요</p>
                <p className="text-body-sm text-text-tertiary mb-8">
                  인증 후 전체 기능을 사용할 수 있어요.<br />
                  지금 바로 시작하고 나중에 인증해도 괜찮아요.
                </p>
                <div className="flex flex-col gap-2.5">
                  <Button onClick={() => goTo("profile")}>일단 시작할게요</Button>
                  <button
                    type="button"
                    onClick={() => {}} // API 연동 예정
                    className="w-full h-12 rounded-md border border-border text-text-secondary
                               text-body font-medium hover:bg-surface-secondary transition-colors cursor-pointer"
                  >
                    인증 메일 재발송
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

                {/* 생년월일 */}
                <p className="text-label text-text-primary mb-2">생년월일</p>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    {
                      value: birthYear,
                      setter: setBirthYear,
                      placeholder: "년도",
                      options: YEARS.map((y) => ({ value: String(y), label: `${y}년` })),
                    },
                    {
                      value: birthMonth,
                      setter: setBirthMonth,
                      placeholder: "월",
                      options: MONTHS.map((m) => ({ value: String(m), label: `${m}월` })),
                    },
                    {
                      value: birthDay,
                      setter: setBirthDay,
                      placeholder: "일",
                      options: DAYS.map((d) => ({ value: String(d), label: `${d}일` })),
                    },
                  ].map((sel) => (
                    <select
                      key={sel.placeholder}
                      value={sel.value}
                      onChange={(e) => sel.setter(e.target.value)}
                      className={[
                        "h-12 w-full rounded-md border px-3",
                        "text-body outline-none transition-colors duration-150 bg-surface cursor-pointer",
                        sel.value
                          ? "border-border text-text-primary focus:border-brand focus:ring-2 focus:ring-brand/15"
                          : "border-border text-text-tertiary focus:border-brand focus:ring-2 focus:ring-brand/15",
                      ].join(" ")}
                    >
                      <option value="" disabled>{sel.placeholder}</option>
                      {sel.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ))}
                </div>

                {/* 학력 */}
                <p className="text-label text-text-primary mb-2">학력</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {EDUCATION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setEducation(opt);
                        if (opt === "고등학생") { setSchool(""); setDepartment(""); }
                      }}
                      className={[
                        "h-12 rounded-xl border-2 text-body font-semibold",
                        "transition-all duration-150 cursor-pointer",
                        education === opt
                          ? "border-brand bg-surface-brand text-brand"
                          : "border-border bg-surface text-text-primary hover:border-brand/40 hover:bg-surface-brand/30",
                      ].join(" ")}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {/* School / department — revealed for university options */}
                <AnimatePresence>
                  {needsSchool && (
                    <motion.div
                      key="school-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-3 pt-1 pb-4">
                        <Input
                          label="학교명"
                          type="text"
                          placeholder="예) 서울대학교"
                          value={school}
                          onChange={(e) => setSchool(e.target.value)}
                        />
                        <Input
                          label="학과 / 전공"
                          type="text"
                          placeholder="예) 컴퓨터공학과"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button onClick={() => goTo("nickname")} disabled={!profileComplete} fullWidth>
                  다음
                </Button>
              </div>
            )}

            {/* ── nickname ─────────────────────────── */}
            {step === "nickname" && (
              <div>
                <h1 className="text-heading-2 text-text-primary mb-1">어떻게 불러드릴까요?</h1>
                <p className="text-body text-text-secondary mb-8">
                  ARC 안에서 사용할 이름이에요
                </p>
                <div className="flex flex-col gap-3">
                  <Input
                    label="닉네임"
                    type="text"
                    placeholder="예) 지민, arc_user"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && nickname.trim() && goTo("q1")}
                  />
                  <Button onClick={() => goTo("q1")} disabled={!nickname.trim()}>
                    다음
                  </Button>
                </div>
              </div>
            )}

            {/* ── q1 ───────────────────────────────── */}
            {step === "q1" && (
              <div>
                <h1 className="text-heading-2 text-text-primary mb-1">
                  요즘 가장 고민되는 게 뭐예요?
                </h1>
                <p className="text-body text-text-secondary mb-8">
                  {nickname ? `${nickname}님, ` : ""}솔직하게 골라도 괜찮아요 😊
                </p>
                <div className="flex flex-col gap-2.5 mb-6">
                  {Q1_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setQ1(opt)}
                      className={[
                        "w-full h-14 rounded-xl border-2 text-title font-semibold",
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
                  가장 기억에 남는 활동이 있나요?
                </h1>
                <p className="text-body text-text-secondary mb-8">
                  짧게 적어도 괜찮아요 — 나중에 더 자세히 기록할 수 있어요
                </p>
                <div className="flex flex-col gap-3">
                  <Textarea
                    placeholder="예) 교내 UX 공모전에서 팀장을 맡아 앱을 기획했어요"
                    value={q2}
                    onChange={(e) => setQ2(e.target.value)}
                    rows={4}
                  />
                  <Button onClick={handleFinish}>
                    {q2.trim() ? "ARC 시작하기 🎉" : "나중에 채울게요 →"}
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
