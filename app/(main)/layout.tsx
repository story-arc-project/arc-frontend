import { GNB } from "@/components/layout/GNB";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // Route protection is handled via httpOnly cookie check in proxy.ts
  return (
    <>
      <GNB />
      <div className="pt-[var(--gnb-h)]">{children}</div>
    </>
  );
}
