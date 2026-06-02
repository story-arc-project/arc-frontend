import { Card, CardHeader, CardTitle, Badge, Button } from "@/components/ui";

export function PlanCard() {
  return (
    <Card variant="default" padding="lg">
      <CardHeader>
        <CardTitle>현재 플랜</CardTitle>
      </CardHeader>
      <div className="flex items-center justify-between gap-4">
        <Badge variant="brand">Free</Badge>
        <span className="text-body-sm text-text-tertiary">무료 플랜 이용 중</span>
      </div>
      <p className="mt-4 text-body-sm text-text-secondary">
        더 많은 분석과 기능이 필요하신가요? Pro 업그레이드를 준비하고 있어요.
      </p>
      <Button variant="secondary" size="sm" fullWidth className="mt-3" disabled>
        Pro 업그레이드 (준비 중)
      </Button>
    </Card>
  );
}
