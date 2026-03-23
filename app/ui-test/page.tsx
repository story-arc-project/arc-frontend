import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

/* ── Section wrapper ─────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="text-[22px] font-bold text-text-primary mb-1">{title}</h2>
      <div className="w-10 h-0.5 bg-brand mb-6" />
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      {label && <p className="text-label text-text-secondary mb-2">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/* ── Color swatches ──────────────────────────────────────── */
const swatches = [
  { name: "Brand", bg: "bg-brand", text: "text-white" },
  { name: "Brand Light", bg: "bg-brand-light", text: "text-brand-dark" },
  { name: "Surface", bg: "bg-surface border border-border", text: "text-text-primary" },
  { name: "Surface 2", bg: "bg-surface-secondary", text: "text-text-primary" },
  { name: "Surface 3", bg: "bg-surface-tertiary", text: "text-text-primary" },
  { name: "Gray 950", bg: "bg-gray-950", text: "text-white" },
  { name: "Gray 500", bg: "bg-gray-500", text: "text-white" },
  { name: "Gray 200", bg: "bg-gray-200", text: "text-text-primary" },
  { name: "Gray 50", bg: "bg-gray-50 border border-border", text: "text-text-primary" },
  { name: "Error", bg: "bg-error", text: "text-white" },
  { name: "Success", bg: "bg-success", text: "text-white" },
  { name: "Warning", bg: "bg-warning", text: "text-white" },
];

/* ── Page ────────────────────────────────────────────────── */
export default function UITestPage() {
  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Header */}
      <div className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-bold text-text-primary">ARC</span>
            <span className="text-text-tertiary">/</span>
            <span className="text-[15px] text-text-secondary">UI 컴포넌트 테스트</span>
          </div>
          <Badge variant="brand">Dev Only</Badge>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-14">

        {/* ── Typography ─────────────────────────────────── */}
        <Section title="Typography">
          <div className="bg-surface border border-border rounded-xl p-8 space-y-4">
            <p className="text-display">Display — 48px Bold</p>
            <p className="text-heading-1">Heading 1 — 36px Bold</p>
            <p className="text-heading-2">Heading 2 — 28px Bold</p>
            <p className="text-heading-3">Heading 3 — 22px Semibold</p>
            <p className="text-title">Title — 18px Semibold</p>
            <p className="text-body-lg">Body Large — 17px Regular</p>
            <p className="text-body">Body — 15px Regular</p>
            <p className="text-body-sm">Body Small — 13px Regular</p>
            <p className="text-label">Label — 13px Medium</p>
            <p className="text-caption">Caption — 12px Regular, secondary color</p>
          </div>
        </Section>

        {/* ── Colors ─────────────────────────────────────── */}
        <Section title="Colors">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {swatches.map((s) => (
              <div key={s.name} className="flex flex-col gap-1.5">
                <div className={`h-14 rounded-lg ${s.bg} ${s.text} flex items-end p-2`} />
                <p className="text-[12px] text-text-secondary">{s.name}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Buttons ────────────────────────────────────── */}
        <Section title="Button">
          <div className="bg-surface border border-border rounded-xl p-8 space-y-6">
            <Row label="Variant">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </Row>
            <Row label="Size">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </Row>
            <Row label="Disabled">
              <Button variant="primary" disabled>Primary</Button>
              <Button variant="secondary" disabled>Secondary</Button>
              <Button variant="ghost" disabled>Ghost</Button>
            </Row>
            <Row label="Full Width">
              <div className="w-full">
                <Button fullWidth>Full Width Button</Button>
              </div>
            </Row>
          </div>
        </Section>

        {/* ── Cards ──────────────────────────────────────── */}
        <Section title="Card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {(["default", "bordered", "elevated", "filled"] as const).map((v) => (
              <Card key={v} variant={v}>
                <CardHeader>
                  <CardTitle>{v.charAt(0).toUpperCase() + v.slice(1)} Card</CardTitle>
                  <CardDescription>variant=&quot;{v}&quot; 카드입니다.</CardDescription>
                </CardHeader>
                <p className="text-body text-text-secondary">
                  카드 본문 영역입니다. 자유롭게 콘텐츠를 배치할 수 있어요.
                </p>
                <CardFooter className="justify-between mt-5">
                  <Badge>태그</Badge>
                  <Button size="sm" variant="secondary">액션</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </Section>

        {/* ── Input ──────────────────────────────────────── */}
        <Section title="Input">
          <div className="bg-surface border border-border rounded-xl p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input label="기본 입력" placeholder="텍스트를 입력하세요" />
              <Input label="힌트 있음" placeholder="이메일 주소" hint="로그인에 사용됩니다." />
              <Input
                label="에러 상태"
                placeholder="비밀번호"
                type="password"
                error="비밀번호가 일치하지 않습니다."
              />
              <Input label="비활성화" placeholder="편집 불가" disabled />
            </div>
          </div>
        </Section>

        {/* ── Textarea ───────────────────────────────────── */}
        <Section title="Textarea">
          <div className="bg-surface border border-border rounded-xl p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Textarea label="기본" placeholder="내용을 입력하세요" />
              <Textarea label="힌트 있음" placeholder="활동을 통해 무엇을 배웠나요?" hint="구체적으로 작성할수록 AI 분석 품질이 높아집니다." />
              <Textarea label="에러 상태" placeholder="내용을 입력하세요" error="내용을 입력해주세요." />
              <Textarea label="비활성화" placeholder="편집 불가" disabled />
            </div>
          </div>
        </Section>

        {/* ── Badges ─────────────────────────────────────── */}
        <Section title="Badge">
          <div className="bg-surface border border-border rounded-xl p-8">
            <Row>
              <Badge variant="default">Default</Badge>
              <Badge variant="brand">Brand</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="outline">Outline</Badge>
            </Row>
          </div>
        </Section>

        {/* ── Shadows ────────────────────────────────────── */}
        <Section title="Shadows">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
            {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
              <div
                key={s}
                className={`bg-surface rounded-lg p-6 flex items-center justify-center shadow-${s}`}
              >
                <span className="text-label text-text-secondary">shadow-{s}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Radius ─────────────────────────────────────── */}
        <Section title="Border Radius">
          <div className="flex flex-wrap gap-5">
            {(["xs", "sm", "md", "lg", "xl", "2xl", "full"] as const).map((r) => (
              <div
                key={r}
                className={`w-20 h-20 bg-brand-light border-2 border-brand flex items-center
                            justify-center rounded-${r}`}
              >
                <span className="text-[11px] font-medium text-brand-dark">{r}</span>
              </div>
            ))}
          </div>
        </Section>

      </main>
    </div>
  );
}
