"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

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
    <div className="bg-white rounded-xl border border-border shadow-lg overflow-hidden">
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
    <div className="bg-white rounded-xl border border-border shadow-lg overflow-hidden">
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
    <div className="bg-white rounded-xl border border-border shadow-lg overflow-hidden">
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
      <nav className="max-w-5xl mx-auto px-6 h-[60px] flex items-center justify-between">
        <span className="text-[18px] font-bold tracking-tight text-text-primary">ARC</span>
        <div className="hidden sm:flex items-center gap-7 text-[14px] text-text-secondary font-medium">
          <Link href="#features" className="hover:text-text-primary transition-colors">기능</Link>
          <Link href="#how" className="hover:text-text-primary transition-colors">사용법</Link>
          <Link href="#pricing" className="hover:text-text-primary transition-colors">요금</Link>
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
            className="h-8 px-4 bg-gray-950 text-white text-[13px] font-semibold rounded-lg
                       hover:bg-gray-800 transition-colors inline-flex items-center"
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
              href="#features"
              className="h-12 px-6 text-text-primary text-[15px] font-medium rounded-lg
                         hover:bg-surface-tertiary transition-colors inline-flex items-center"
            >
              기능 살펴보기 →
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

/* ── Social proof ────────────────────────────────────────── */
function SocialProof() {
  const logos = ["카카오", "네이버", "토스", "라인", "쿠팡", "배달의민족"];
  return (
    <section className="py-12 px-6 border-y border-border">
      <div className="max-w-5xl mx-auto">
        <p className="text-[13px] text-text-tertiary text-center mb-8">
          다양한 기업의 현직자와 취준생이 사용하고 있어요
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {logos.map((logo) => (
            <span key={logo} className="text-[15px] font-semibold text-gray-300">
              {logo}
            </span>
          ))}
        </div>
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
            "Pro 플랜에서 워터마크 없이 PDF 다운로드",
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
  return (
    <section id="pricing" className="py-24 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <Reveal className="mb-14">
          <p className="text-[12px] font-bold text-brand uppercase tracking-widest mb-4">요금</p>
          <h2 className="text-[26px] sm:text-[38px] font-bold tracking-[-0.02em] text-text-primary">
            무료로 시작, 필요할 때 업그레이드
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Free */}
          <Reveal delay={0.08}>
            <div className="border border-border rounded-xl p-7 h-full flex flex-col">
              <p className="text-[13px] font-bold text-text-secondary uppercase tracking-wide mb-6">Free</p>
              <p className="text-[38px] font-bold text-text-primary mb-1">
                ₩0
              </p>
              <p className="text-[14px] text-text-tertiary mb-8">영원히 무료</p>
              <ul className="space-y-3 text-[14px] text-text-secondary flex-1">
                {["아카이브 기록 무제한", "기본 키워드 분석", "이력서 초안 (워터마크 포함)"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="text-success">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 flex items-center justify-center h-11 rounded-lg border border-border
                           text-text-primary font-semibold text-[14px] hover:bg-surface-tertiary transition-colors"
              >
                무료로 시작하기
              </Link>
            </div>
          </Reveal>

          {/* Pro */}
          <Reveal delay={0.14}>
            <div className="border-2 border-brand rounded-xl p-7 h-full flex flex-col relative">
              <div className="absolute -top-3 left-6">
                <span className="bg-brand text-white text-[11px] font-bold px-3 py-1 rounded-full">
                  추천
                </span>
              </div>
              <p className="text-[13px] font-bold text-brand uppercase tracking-wide mb-6">Pro</p>
              <p className="text-[38px] font-bold text-text-primary mb-1">₩9,900</p>
              <p className="text-[14px] text-text-tertiary mb-8">월 / 언제든 해지</p>
              <ul className="space-y-3 text-[14px] text-text-secondary flex-1">
                {[
                  "Free 플랜 모든 기능",
                  "AI 대화형 경험 추출",
                  "내러티브 엔진 (스토리라인 제안)",
                  "워터마크 없는 PDF 출력",
                  "진로 로드맵 설계",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="text-brand">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup?plan=pro"
                className="mt-8 flex items-center justify-center h-11 rounded-lg bg-brand
                           text-white font-semibold text-[14px] hover:bg-brand-dark transition-colors"
              >
                Pro 시작하기
              </Link>
            </div>
          </Reveal>

          {/* Team — coming soon */}
          <Reveal delay={0.2}>
            <div className="border border-border rounded-xl p-7 h-full flex flex-col opacity-60">
              <p className="text-[13px] font-bold text-text-secondary uppercase tracking-wide mb-6">Team</p>
              <p className="text-[38px] font-bold text-text-primary mb-1">곧 출시</p>
              <p className="text-[14px] text-text-tertiary mb-8">단체 · 학교 · 기업</p>
              <ul className="space-y-3 text-[14px] text-text-secondary flex-1">
                {["Pro 플랜 모든 기능", "팀 단위 대시보드", "관리자 통합 분석"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <span className="text-gray-300">✓</span>{f}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex items-center justify-center h-11 rounded-lg bg-surface-tertiary
                              text-text-disabled font-semibold text-[14px]">
                준비 중
              </div>
            </div>
          </Reveal>
        </div>
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
          <Link href="/ui-test" className="hover:text-text-primary transition-colors">UI 테스트</Link>
        </div>
      </div>
      <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-border">
        <p className="text-[13px] text-text-tertiary">© 2025 ARC. All rights reserved.</p>
      </div>
    </footer>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
