"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Coins } from "lucide-react";
import { useRef } from "react";
import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import {
  CREDIT_PACKAGES,
  SIGNUP_GRANT_CREDITS,
  creditCost,
  creditRuns,
  formatKrw,
} from "@/lib/constants/credits";
import LandingDemo from "./_components/LandingDemo";

/* ── Shared animation ────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Mock UI frames ──────────────────────────────────────── */
function ArchiveMockup() {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-surface-tertiary border-b border-border px-5 py-3 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <span className="ml-2 text-[12px] text-text-tertiary">커리어 아카이브</span>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          {["인턴십", "공모전", "동아리", "수업"].map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-surface-brand text-brand-dark"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="space-y-2 pt-1">
          {[
            { title: "카카오 UX 인턴십", date: "2024.07", tag: "인턴십" },
            { title: "앱잼 최우수상", date: "2024.03", tag: "공모전" },
            { title: "GDSC 운영진", date: "2023.09", tag: "동아리" },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-secondary"
            >
              <div>
                <p className="text-[13px] font-semibold text-text-primary">{item.title}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">{item.date}</p>
              </div>
              <span className="text-[11px] text-text-secondary bg-surface px-2 py-0.5 rounded-full border border-border">
                {item.tag}
              </span>
            </div>
          ))}
        </div>
        <div className="pt-1">
          <div className="h-10 rounded-lg border border-dashed border-border flex items-center justify-center">
            <span className="text-[12px] text-text-tertiary">+ 새 경험 기록하기</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisMockup() {
  const bars = [72, 58, 85, 43, 66, 91, 54];
  const labels = ["기획", "개발", "디자인", "리더십", "협업", "분석", "커뮤니케이션"];
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-surface-tertiary border-b border-border px-5 py-3 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <span className="ml-2 text-[12px] text-text-tertiary">키워드 분석</span>
      </div>
      <div className="p-5">
        <p className="text-[12px] text-text-secondary mb-4">역량 키워드 분포</p>
        <div className="space-y-2.5">
          {bars.map((w, i) => (
            <div key={labels[i]} className="flex items-center gap-3">
              <span className="text-[11px] text-text-secondary w-20 text-right shrink-0">
                {labels[i]}
              </span>
              <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-brand rounded-full"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${w}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.07, ease: "easeOut" }}
                />
              </div>
              <span className="text-[11px] text-text-tertiary w-6 shrink-0">{w}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportMockup() {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="bg-surface-tertiary border-b border-border px-5 py-3 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <div className="w-3 h-3 rounded-full bg-gray-200" />
        <span className="ml-2 text-[12px] text-text-tertiary">이력서 생성</span>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex gap-2 mb-4">
          {["이력서", "자기소개서", "포트폴리오"].map((t, i) => (
            <span
              key={t}
              className={`text-[12px] font-medium px-3 py-1 rounded-full ${
                i === 0
                  ? "bg-brand text-white"
                  : "bg-surface-tertiary text-text-secondary"
              }`}
            >
              {t}
            </span>
          ))}
        </div>
        {["인적사항", "경력 · 활동", "수상 · 자격", "자기소개"].map((section, i) => (
          <div key={section} className="rounded-lg bg-surface-secondary px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-text-primary">{section}</span>
              <span className="text-[10px] text-brand font-medium">AI 작성됨</span>
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: i === 3 ? 2 : 1 }).map((_, j) => (
                <div
                  key={j}
                  className={`h-2 rounded-full bg-gray-200 ${j === 1 ? "w-3/4" : "w-full"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Nav ─────────────────────────────────────────────────── */
function Navbar() {
  return (
    <motion.header
      className="sticky top-0 z-50 bg-surface/90 backdrop-blur-sm border-b border-border"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <nav className="max-w-5xl mx-auto px-6 h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-heading-3 font-bold tracking-widest text-text-primary">ARC</span>
          <div className="hidden sm:flex items-center gap-7 text-body-lg text-text-secondary font-medium">
            <Link href="#features" className="hover:text-text-primary transition-colors">기능</Link>
            <Link href="#demo" className="hover:text-text-primary transition-colors">체험</Link>
            <Link href="#how" className="hover:text-text-primary transition-colors">사용법</Link>
            <Link href="#pricing" className="hover:text-text-primary transition-colors">요금</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="h-8 px-4 bg-brand text-white text-[13px] font-semibold rounded-lg
                       hover:bg-brand-dark transition-colors inline-flex items-center"
          >
            시작하기
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}

/* ── Hero ────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="pt-20 pb-10 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Text */}
        <div className="max-w-2xl mb-12">
          <motion.p
            className="text-[13px] font-semibold text-brand uppercase tracking-widest mb-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            AI 커리어 아카이빙
          </motion.p>
          <motion.h1
            className="text-[36px] sm:text-[54px] leading-[1.12] font-bold tracking-[-0.025em] text-text-primary mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            경험을 기록하면<br />
            AI가 이야기로<br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            >
              만들어드립니다
            </span>
          </motion.h1>
          <motion.p
            className="text-[17px] leading-[1.7] text-text-secondary mb-8 max-w-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            공모전, 동아리, 인턴십, 수업 — 모든 경험 조각을 아카이빙하면
            AI가 패턴을 분석하고 이력서·자소서 초안까지 완성해줍니다.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Link
              href="/signup"
              className="h-12 px-6 bg-brand text-white text-[15px] font-semibold rounded-lg
                         hover:bg-brand-dark transition-colors inline-flex items-center"
            >
              무료로 시작하기
            </Link>
            <Link
              href="/demo"
              className="h-12 px-6 text-text-primary text-[15px] font-medium rounded-lg
                         hover:bg-surface-tertiary transition-colors inline-flex items-center"
            >
              로그인 없이 체험하기 →
            </Link>
          </motion.div>
        </div>

        {/* Mockup */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white z-10 pointer-events-none" />
          <ArchiveMockup />
        </motion.div>
      </div>
    </section>
  );
}

/* ── Feature sections ────────────────────────────────────── */
function FeatureRow({
  eyebrow,
  title,
  desc,
  points,
  mockup,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  points: string[];
  mockup: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div
      className={`flex flex-col ${
        reverse ? "md:flex-row-reverse" : "md:flex-row"
      } gap-12 items-center py-20`}
    >
      {/* Text */}
      <div className="flex-1 min-w-0">
        <Reveal>
          <p className="text-[12px] font-bold text-brand uppercase tracking-widest mb-4">
            {eyebrow}
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="text-[26px] sm:text-[34px] font-bold tracking-[-0.015em] text-text-primary leading-[1.2] mb-4 whitespace-pre-line">
            {title}
          </h2>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="text-[16px] leading-[1.7] text-text-secondary mb-6">{desc}</p>
        </Reveal>
        <div className="space-y-3">
          {points.map((p, i) => (
            <Reveal key={p} delay={0.22 + i * 0.08}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-surface-brand flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-brand font-bold">✓</span>
                </span>
                <p className="text-[15px] text-text-secondary">{p}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Visual */}
      <Reveal delay={0.1} className="flex-1 min-w-0 w-full">
        {mockup}
      </Reveal>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="px-6 border-t border-border">
      <div className="max-w-5xl mx-auto divide-y divide-border">
        <FeatureRow
          eyebrow="아카이브"
          title={"경험을 쌓는 순간\n바로 기록하세요"}
          desc="활동이 끝난 직후 템플릿으로 빠르게 남기거나, AI와 대화하듯 자연스럽게 정리할 수 있어요. 기록의 허들을 최대한 낮췄습니다."
          points={[
            "유형별 맞춤 템플릿 (인턴십, 공모전, 동아리, 수업 등)",
            "AI 대화형 경험 추출 — 질문에 답하다 보면 완성",
            "언제든 수정·보완 가능한 초안 저장",
          ]}
          mockup={<ArchiveMockup />}
        />
        <FeatureRow
          eyebrow="분석"
          title={"내가 어떤 사람인지\n데이터로 확인하세요"}
          desc="쌓인 기록에서 반복되는 키워드와 역량 패턴을 자동으로 추출합니다. 스스로도 몰랐던 강점을 발견하게 됩니다."
          points={[
            "역량 키워드 자동 태깅 및 시각화",
            "활동 간 연결고리 분석 — 나만의 스토리라인 발견",
            "시기별 성장 흐름 리포트",
          ]}
          mockup={<AnalysisMockup />}
          reverse
        />
        <FeatureRow
          eyebrow="익스포트"
          title={"이력서·자소서를\n3초 만에 초안으로"}
          desc="아카이빙된 경험을 바탕으로 AI가 이력서와 자기소개서 초안을 자동으로 완성합니다. 스펙 목록이 아닌, 당신이라는 사람의 서사로."
          points={[
            "지원 직무에 맞게 경험 자동 선별 및 재구성",
            "워터마크 없는 PDF 다운로드",
            "자소서 항목별 AI 초안 + 직접 편집",
          ]}
          mockup={<ExportMockup />}
        />
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────── */
const steps = [
  { num: "1", title: "경험을 기록한다", desc: "활동이 끝나면 템플릿으로 빠르게 남깁니다. AI 대화로 더 쉽게." },
  { num: "2", title: "AI가 연결한다", desc: "키워드를 추출하고 활동 간 흐름을 분석해 스토리라인을 찾아냅니다." },
  { num: "3", title: "이야기가 완성된다", desc: "이력서·자소서 초안이 자동 생성됩니다. 스펙이 아닌 서사로." },
];

function HowItWorks() {
  return (
    <section id="how" className="py-24 px-6 bg-gray-950">
      <div className="max-w-5xl mx-auto">
        <Reveal className="text-center mb-16">
          <p className="text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-4">
            사용 방법
          </p>
          <h2 className="text-[26px] sm:text-[38px] font-bold tracking-[-0.02em] text-white">
            3단계로 완성되는 커리어 서사
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-800 rounded-xl overflow-hidden">
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.12}>
              <div className="bg-gray-950 p-8 h-full">
                <span className="text-[44px] font-bold text-gray-800 block mb-4 leading-none">
                  {s.num}
                </span>
                <h3 className="text-[18px] font-bold text-white mb-3">{s.title}</h3>
                <p className="text-[15px] leading-[1.65] text-gray-400">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ─────────────────────────────────────────────── */
function Pricing() {
  // 대표 환산은 config 값에서 파생 — 안정 id로 조회(배열 순서 비의존).
  // 차감량 자체는 노출하지 않고, "가입 크레딧으로 대표 작업 몇 편" 감만 준다.
  const resumeRuns = creditRuns(SIGNUP_GRANT_CREDITS, creditCost("resume"));

  return (
    <section id="pricing" className="py-24 px-6 border-t border-border">
      <div className="max-w-4xl mx-auto">
        <Reveal className="mb-10 max-w-2xl">
          <p className="text-[12px] font-bold text-brand uppercase tracking-widest mb-4">요금</p>
          <h2 className="text-[26px] sm:text-[38px] font-bold tracking-[-0.02em] text-text-primary mb-4">
            기록은 무료로, AI는 필요한 만큼만
          </h2>
          <p className="text-[16px] leading-[1.7] text-text-secondary break-keep">
            월 구독 없이, AI 분석과 문서 생성에만 크레딧을 써요. 기록과 보관은 언제나 무료입니다.
          </p>
        </Reveal>

        {/* 가치 제안 3열 — 라벨 · 강조 값 · 보조 설명 */}
        <Reveal delay={0.04} className="mb-10">
          <ul className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              { label: "월 구독료", value: "없음", desc: "필요한 만큼만 충전하세요" },
              { label: "기록·보관", value: "무료", desc: "기록은 계속 보관돼요" },
              {
                label: "가입 혜택",
                value: `${SIGNUP_GRANT_CREDITS} 크레딧`,
                desc: "가입 즉시 지급해요",
              },
            ].map((item) => (
              <li key={item.label} className="px-6 py-6 text-center sm:py-2">
                <p className="text-[13px] font-medium tracking-wide text-text-secondary">
                  {item.label}
                </p>
                <p className="mt-2 text-[30px] sm:text-[34px] font-bold tracking-[-0.02em] text-text-primary leading-none">
                  {item.value}
                </p>
                <p className="mt-2.5 text-[13px] leading-[1.6] text-text-secondary">
                  {item.desc}
                </p>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* 히어로 — 무료 크레딧 강조(가장 강한 정보) */}
        <Reveal delay={0.08}>
          <div className="rounded-2xl border border-border bg-surface-secondary p-8 sm:p-10">
            <div className="mb-4 inline-flex items-center justify-center w-11 h-11 rounded-full bg-surface-brand">
              <Coins className="w-5 h-5 text-brand" aria-hidden />
            </div>
            <p className="text-[13px] font-semibold text-brand mb-3">먼저 무료로 시작해 보세요</p>
            <p className="text-[24px] sm:text-[30px] font-bold tracking-[-0.02em] text-text-primary leading-[1.3]">
              가입하면 {SIGNUP_GRANT_CREDITS}크레딧을 무료로 드려요
            </p>
            <p className="text-[15px] leading-[1.7] text-text-secondary mt-3">
              이력서를 약 {resumeRuns}편 만들어 볼 수 있는 크레딧이에요.
              결제 없이 AI 분석과 문서 생성을 바로 경험할 수 있습니다.
            </p>
            <Link
              href="/signup"
              className="mt-7 inline-flex items-center justify-center h-12 px-7 rounded-lg bg-brand
                         text-white text-[15px] font-semibold hover:bg-brand-dark transition-colors"
            >
              {SIGNUP_GRANT_CREDITS}크레딧 받고 시작하기
            </Link>
          </div>
        </Reveal>

        {/* 충전 안내 — 단일 패널(카드 분리 아님) + 열 구분선 */}
        <Reveal delay={0.16} className="mt-10">
          <p className="text-[15px] leading-[1.7] text-text-secondary mb-5">
            무료 크레딧을 모두 사용한 뒤에도, 필요한 만큼 충전할 수 있어요.
          </p>
          <ul className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border">
            {CREDIT_PACKAGES.map((pkg) => (
              <li
                key={pkg.id}
                className={`relative px-2 py-7 text-center sm:px-3 ${
                  pkg.recommended
                    ? "z-10 rounded-xl bg-surface-brand ring-2 ring-inset ring-brand"
                    : ""
                }`}
              >
                {pkg.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    추천
                  </span>
                )}
                <Coins className="mx-auto mb-2 h-5 w-5 text-brand" aria-hidden />
                <p className="text-[20px] sm:text-[26px] font-bold tracking-[-0.02em] text-text-primary leading-none">
                  {pkg.credits}
                  <span className="ml-0.5 text-[13px] font-medium text-text-secondary">
                    크레딧
                  </span>
                </p>
                <p className="mt-3 text-[16px] sm:text-[19px] font-semibold text-text-primary">
                  {formatKrw(pkg.price)}
                </p>
                <p className="mt-3 text-[12px] sm:text-[13px] leading-[1.5] text-text-secondary break-keep">
                  이력서 약 {creditRuns(pkg.credits, creditCost("resume"))}개
                </p>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Final CTA ───────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-32 px-6 border-t border-border">
      <div className="max-w-3xl mx-auto text-center">
        <Reveal>
          <p className="text-[12px] font-bold text-brand uppercase tracking-widest mb-5">
            Story Arc
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-[30px] sm:text-[44px] font-bold tracking-[-0.025em] text-text-primary leading-[1.15] mb-5">
            당신의 경험에 숨어있는<br />흐름을 찾아드릴게요
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="text-[17px] text-text-secondary leading-[1.7] mb-10">
            이름 ARC는 <em>Story Arc</em>에서 왔습니다.<br />
            방주(Ark)처럼, 당신의 모든 경험 조각을 안전하게 담아둡니다.
          </p>
        </Reveal>
        <Reveal delay={0.28}>
          <Link
            href="/signup"
            className="h-14 px-10 bg-brand text-white text-[17px] font-bold rounded-xl
                       hover:bg-brand-dark transition-colors inline-flex items-center"
          >
            지금 무료로 시작하기 →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-border py-10 px-6 bg-surface-secondary">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <p className="text-[17px] font-bold text-text-primary">ARC</p>
          <p className="text-[13px] text-text-tertiary mt-1">포트폴리오 아카이빙 및 AI 연계 자동화 플랫폼</p>
        </div>
        <div className="flex gap-6 text-[14px] text-text-secondary">
          <Link href="#features" className="hover:text-text-primary transition-colors">기능</Link>
          <Link href="#pricing" className="hover:text-text-primary transition-colors">요금</Link>
          <Link href="/privacy" className="hover:text-text-primary transition-colors">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-text-primary transition-colors">이용약관</Link>
        </div>
      </div>
      <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-border">
        <p className="text-[13px] text-text-tertiary">
          © {new Date().getFullYear()} ARC. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function LandingPage() {
  const { shouldRedirect } = useRedirectIfAuthenticated();

  if (shouldRedirect) return null;

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <LandingDemo />
        <HowItWorks />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
