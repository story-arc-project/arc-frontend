export default function MainLayout({ children }: { children: React.ReactNode }) {
  // route 보호는 proxy.ts에서 httpOnly 쿠키 존재 여부로 처리
  return <>{children}</>;
}
