import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandIcon } from "@/components/BrandIcon";
import { AdBanner } from "@/components/ads/AdBanner";

export const metadata: Metadata = {
  title: "서비스 소개 · 사용설명 · 현장동선",
  description:
    "현장동선 사용 방법: 고객·매물·팀공유·사이트내공유·스와이프·네비 안내입니다.",
};

function GuideItem({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[#F9FAFB] px-3.5 py-3 ring-1 ring-inset ring-gray-100">
      <p className="text-[14px] font-bold text-gray-900">{title}</p>
      <div className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-gray-600">
        {children}
      </div>
    </div>
  );
}

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
            현장 고객부터
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
            <strong className="font-bold text-gray-800">모바일 웹 앱</strong>
            입니다. 고객 정보, 매물 메모, 방문 일정, 원클릭 전화·네비 연결을
            계정별로 정리할 수 있습니다.
          </p>
        </section>

        <section
          id="guide"
          className="scroll-mt-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
        >
          <h2 className="text-[16px] font-bold text-gray-900">사용설명</h2>
          <p className="mt-2 text-[13px] text-gray-500">
            자주 쓰는 화면 조작과 공유 기능을 짧게 정리했습니다.
          </p>
          <div className="mt-3 space-y-2.5">
            <GuideItem title="고객·매물·네비 리스트 스와이프">
              <p>
                카드를{" "}
                <strong className="font-bold text-gray-800">누른 채</strong>{" "}
                좌우로 밀면 삭제·종료가 나타납니다. (짧게 탭하면 상세로
                이동합니다)
              </p>
              <p>· 오른쪽 밀기 → 삭제</p>
              <p>· 왼쪽 밀기 → 종료(회색 처리 후 목록 하단)</p>
              <p>
                PC에서는 더블클릭이 아니라{" "}
                <strong className="font-bold text-gray-800">
                  마우스 누른 상태로 드래그
                </strong>
                하세요.
              </p>
            </GuideItem>

            <GuideItem title="카드 위 색 칩">
              <p>
                매물유형(원룸 등) · 거래유형(전세/월세/매매) · 보증금(억 구간)이
                각각 다른 색 박스로 표시됩니다. 금액은 「보증금」으로 표기합니다.
              </p>
            </GuideItem>

            <GuideItem title="팀공유 · 사이트내공유">
              <p>
                <strong className="font-bold text-gray-800">팀공유</strong>
                : 계정에서 공유 코드로 동료와 같은 업장 공간을 씁니다. 고객·매물은
                등록 시 「팀공유 유무」로 켤 수 있고, 리스트 칩을 눌러
                팀 공유하기/팀 공유 중을 바꿀 수 있습니다. 네비(방문 일정)는 일정 화면의
                「팀공유」로 따로 켭니다.
              </p>
              <p>
                <strong className="font-bold text-gray-800">사이트내공유</strong>
                : 고객·매물에서 「사이트내공유 유무」로 설정합니다. 현재는
                개발중으로 표시되며, 이후 사이트내공유중 / 사이트내공유 중단 중
                칩으로 전환할 수 있습니다. 켜 두면 조건이 맞는 현장동선내 공유
                매물·고객과 서로 매칭될 수 있습니다.
              </p>
            </GuideItem>

            <GuideItem title="고객 희망입주 · 기한">
              <p>
                고객 카드에 희망입주일이 있고, 시작일 기준 31일 전이면 호박색
                글씨로 기한이 표시됩니다.
              </p>
            </GuideItem>

            <GuideItem title="허위 등록 주의">
              <p>
                허위 매물·허위 고객을 등록하면 약관에 따라 계정이 정지될 수
                있습니다.
              </p>
            </GuideItem>
          </div>
        </section>

        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">주요 기능</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>고객·희망 조건·입주 일정 등록과 검색</li>
            <li>매물 주소·금액·관리비·비밀번호 등 현장 브리핑</li>
            <li>방문 일정과 매물 순서(동선) 구성</li>
            <li>전화·카카오내비·티맵·네이버지도·카카오맵 원클릭 연결</li>
            <li>팀공유·사이트내공유로 동료와 업무 데이터 공유</li>
            <li>계정별 클라우드 저장(다른 기기에서도 동일 계정으로 이용)</li>
          </ul>
        </section>

        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">누구에게 적합한가요?</h2>
          <p className="mt-2">
            고객 응대와 매물 임장을 자주 다니는 중개 보조·중개사·현장 스태프에게
            맞춰져 있습니다. 필수 사용 서비스가 아니며, 필요한 분만 선택해
            쓰시면 됩니다.
          </p>
        </section>

        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">비용과 광고</h2>
          <p className="mt-2">
            서비스 유지를 위해 Google AdSense 등 광고가 표시될 수 있으며, 승인
            전에는 광고가 나오지 않을 수 있습니다. 향후 유료 요금제·부가 기능이
            도입될 수 있습니다. 광고·개인정보 처리 내용은{" "}
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
            회원가입 후 바로 고객·매물을 등록할 수 있습니다. 이용 전 약관·면책
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
