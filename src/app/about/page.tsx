import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandIcon } from "@/components/BrandIcon";
import { AdBanner } from "@/components/ads/AdBanner";

export const metadata: Metadata = {
  title: "서비스 소개 · 현장동선",
  description:
    "현장동선은 부동산 중개 현장의 손님·매물·방문 일정·길안내를 한곳에서 다루는 무료 모바일 웹 도구입니다.",
};

export default function AboutPage() {
  return (
    <main className="pb-6">
      <PageHeader title="서비스 소개" backHref="/" />

      <div className="mb-5 flex items-start gap-3 px-1">
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-[0_8px_20px_rgba(49,130,246,0.28)]">
          <BrandIcon size={56} />
        </span>
        <div>
          <p className="text-[13px] font-bold text-[#3182F6]">현장동선</p>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-gray-900">
            현장 손님부터
            <br />
            동선까지 한곳에서
          </h1>
        </div>
      </div>

      <article className="space-y-5 text-[14px] leading-relaxed text-gray-600">
        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">무엇을 하나요?</h2>
          <p className="mt-2">
            현장동선은 부동산 중개 현장에서 반복되는 일을 줄이기 위한{" "}
            <strong className="font-bold text-gray-800">무료 모바일 웹 앱</strong>
            입니다. 손님 정보, 매물 메모, 방문 일정, 원클릭 전화·네비 연결을
            계정별로 정리할 수 있습니다.
          </p>
        </section>

        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">주요 기능</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>손님·희망 조건·입주 일정 등록과 검색</li>
            <li>매물 주소·금액·관리비·비밀번호 등 현장 브리핑</li>
            <li>방문 일정과 매물 순서(동선) 구성</li>
            <li>전화·카카오내비·티맵·네이버지도·카카오맵 원클릭 연결</li>
            <li>계정별 클라우드 저장(다른 기기에서도 동일 계정으로 이용)</li>
          </ul>
        </section>

        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">누구에게 적합한가요?</h2>
          <p className="mt-2">
            손님 응대와 매물 임장을 자주 다니는 중개 보조·중개사·현장 스태프에게
            맞춰져 있습니다. 필수 사용 서비스가 아니며, 필요한 분만 선택해
            쓰시면 됩니다.
          </p>
        </section>

        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">비용과 광고</h2>
          <p className="mt-2">
            기본 기능은 무료입니다. 서비스 유지를 위해 Google AdSense 등 광고가
            표시될 수 있으며, 승인 전에는 광고가 나오지 않을 수 있습니다. 광고·
            개인정보 처리 내용은{" "}
            <Link
              href="/terms"
              className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
            >
              약관 및 안내
            </Link>
            를 확인해 주세요.
          </p>
        </section>

        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">시작하기</h2>
          <p className="mt-2">
            회원가입 후 바로 손님·매물을 등록할 수 있습니다. 이용 전 약관·면책
            안내에 동의해 주세요.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/signup"
              className="flex min-h-[48px] items-center justify-center rounded-2xl bg-[#3182F6] text-[15px] font-bold text-white active:scale-95 transition-all duration-150"
            >
              회원가입
            </Link>
            <Link
              href="/terms"
              className="flex min-h-[48px] items-center justify-center rounded-2xl bg-gray-100 text-[15px] font-bold text-gray-800 active:scale-95 transition-all duration-150"
            >
              약관 보기
            </Link>
          </div>
        </section>
      </article>

      <AdBanner slot="about" className="mt-5" />
    </main>
  );
}
