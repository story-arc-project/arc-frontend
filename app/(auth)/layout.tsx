import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col items-center px-4 pt-16 pb-16">
      <Link href="/landing" className="mb-8 flex items-center gap-2">
        <span className="text-heading-3 font-bold text-brand tracking-tight">ARC</span>
      </Link>
      {children}
    </div>
  );
}
