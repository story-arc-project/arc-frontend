import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col items-center px-4 py-16">
      {/* 로고와 카드를 한 덩어리로 묶어 my-auto 로 세로 중앙에 놓는다.
          justify-center 를 쓰면 뷰포트보다 긴 화면(가입 '기본 정보' 스텝 등)의 위쪽이
          잘려 스크롤로도 볼 수 없게 되는데, auto 마진은 여유 공간이 없으면 0으로 떨어져
          상단 정렬로 되돌아가므로 잘림이 생기지 않는다. */}
      <div className="my-auto flex w-full flex-col items-center">
        <Link href="/landing" className="mb-8 flex items-center gap-2">
          <span className="text-heading-3 font-bold text-brand tracking-tight">ARC</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
