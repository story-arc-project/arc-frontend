export default function DemoBanner() {
  return (
    <div className="w-full bg-brand/5 border-b border-brand/20 text-brand-dark text-caption py-1 px-4 flex items-center justify-center gap-2">
      <span className="inline-flex items-center rounded-full bg-brand text-white font-semibold px-2 py-0.5 text-[10px] tracking-wider">
        DEMO
      </span>
      <span>예시 데이터로 구성된 프레젠테이션 화면입니다.</span>
    </div>
  );
}
