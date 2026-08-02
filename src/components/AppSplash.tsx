import { BrandIcon } from "@/components/BrandIcon";

/** 앱 최초 로딩·세션 확인 시 전체 화면 */
export function AppSplash() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-[#F9FAFB] px-6">
      <div className="flex flex-col items-center">
        <div className="overflow-hidden rounded-[36px] shadow-[0_16px_40px_rgba(49,130,246,0.28)]">
          <BrandIcon size={128} />
        </div>
        <p className="mt-6 text-[34px] font-extrabold tracking-tight text-[#191F28]">
          현장동선
        </p>
      </div>

      <p className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-[12px] font-medium tracking-wide text-gray-400">
        제공 미스터k
      </p>
    </div>
  );
}
