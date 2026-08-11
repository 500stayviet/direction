import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandIcon } from "@/components/BrandIcon";
import { AdBanner } from "@/components/ads/AdBanner";

export const metadata: Metadata = {
  title: "서비스 소개 · 사용설명 · 현장동선",
  description:
    "현장동선 사용 방법: 고객·매물·방문 일정·팀 공유·조건 매칭·네비·광고 안내입니다.",
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
            입니다. 고객·매물·방문 일정(네비)·원클릭 전화·길안내를{" "}
            <strong className="font-bold text-gray-800">계정 단위</strong>로
            정리하고, 필요할 때만 동료와{" "}
            <strong className="font-bold text-gray-800">팀 공유</strong>할 수
            있습니다.
          </p>
        </section>

        <section
          id="guide"
          className="scroll-mt-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
        >
          <h2 className="text-[16px] font-bold text-gray-900">사용설명</h2>
          <p className="mt-2 text-[13px] text-gray-500">
            자주 쓰는 화면과 공유·매칭 기능을 짧게 정리했습니다.
          </p>
          <div className="mt-3 space-y-2.5">
            <GuideItem title="회원가입 · 내 정보">
              <p>
                아이디는{" "}
                <strong className="font-bold text-gray-800">중복 확인</strong>
                후 가입합니다. 삭제된 아이디는 다시 쓸 수 없습니다.
              </p>
              <p>
                업장명을 입력하면 「부동산」·「공인중개사사무소」가 없을 때{" "}
                <strong className="font-bold text-gray-800">
                  공인중개사사무소
                </strong>
                가 자동으로 붙습니다. 처음부터 비워 두면 기본 표기(현장동선)로
                두며, 억지로 접미사를 붙이지 않습니다.
              </p>
              <p>
                업장명·이름·전화번호는 매물 공유 문구 등에 쓰일 수 있으니,{" "}
                <Link
                  href="/account"
                  className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
                >
                  내 정보
                </Link>
                에서 확인해 주세요.
              </p>
            </GuideItem>

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
                PC에서는{" "}
                <strong className="font-bold text-gray-800">
                  마우스 누른 상태로 드래그
                </strong>
                하세요.
              </p>
            </GuideItem>

            <GuideItem title="카드 위 색 칩">
              <p>
                매물유형(원룸 등) · 거래유형(전세/월세/매매) · 보증금(억 구간)이
                각각 다른 색으로 표시됩니다. 금액은 「보증금」으로 표기합니다.
              </p>
            </GuideItem>

            <GuideItem title="팀 공유 (계정 → 공유 공간 → 항목별 공유)">
              <p>
                <strong className="font-bold text-gray-800">1) 계정</strong>
                이 기본입니다. 로그인한 본인 데이터부터 관리합니다.
              </p>
              <p>
                <strong className="font-bold text-gray-800">2) 공유 공간</strong>
                — 내 정보에서 공유 코드를 만들거나 입력해 동료와 같은 업장
                공간에 합류합니다. 공간 이름(예: 「성내」)은{" "}
                <strong className="font-bold text-gray-800">
                  구분용 이름일 뿐
                </strong>
                이며, 같은 지역 이름이어도 자동으로 전부 공유되지 않습니다.
                코드를 입력한 계정만 들어옵니다. 코드는 짧게(약 5분) 유효합니다.
              </p>
              <p>
                <strong className="font-bold text-gray-800">
                  3) 항목별 「팀 공유하기」
                </strong>
                — 공간에 들어와도{" "}
                <strong className="font-bold text-gray-800">
                  고객 리스트 · 매물 리스트 · 네비(방문 일정)
                </strong>
                에서 각각{" "}
                <strong className="font-bold text-gray-800">팀 공유하기</strong>
                를 누른 항목만 팀원에게 보입니다. 공간 합류만으로 전부 공개되지
                않습니다.
              </p>
            </GuideItem>

            <GuideItem title="사이트내공유 (준비 중)">
              <p>
                고객·매물의 사이트내공유는{" "}
                <strong className="font-bold text-gray-800">개발 중</strong>
                으로 표시됩니다. 이후 켜 두면 조건이 맞는 현장동선 내 다른 회원
                매물·고객과 매칭될 수 있도록 설계되어 있습니다.
              </p>
            </GuideItem>

            <GuideItem title="조건에 맞는 매물·고객">
              <p>
                고객 상세에는 「조건에 맞는 매물」, 매물 상세에는 「조건에 맞는
                고객」이 보입니다. 매칭 목록에서 ×로 삭제하면{" "}
                <strong className="font-bold text-gray-800">
                  해당 매물(또는 고객)이 리스트에서 영구적으로 제외
                </strong>
                됩니다. 단순 숨김이 아닙니다.
              </p>
            </GuideItem>

            <GuideItem title="방문 일정 · 동선 순서">
              <p>
                방문 일정에서 매물 도착 시간을 바꾸면 시간이 빠른 순으로
                정렬됩니다. 「N번 매물」을 눌러 같은 일정 안 매물 자리를 바꿀 수
                있습니다(슬롯의 시간은 유지).
              </p>
              <p>
                네비 화면에서 일정을 고르고 원클릭으로 전화·길안내를 시작합니다.
              </p>
            </GuideItem>

            <GuideItem title="중복 안내 · 삭제">
              <p>
                같은 전화(고객) 또는 같은 주소·호실(매물)을 다시 넣을 때 동일
                건이 있다는 안내가 뜹니다. 저장은 가능하지만 실수로 겹치지 않게
                확인하세요.
              </p>
              <p>
                삭제는 목록에서 바로 빠지며, 서버에는 복구·보호를 위해 소프트
                삭제될 수 있습니다. 팀 공유에 올라간 데이터는 탈퇴만으로 자동
                소멸되지 않을 수 있습니다.
              </p>
            </GuideItem>

            <GuideItem title="고객 희망입주 · 기한">
              <p>
                고객 카드에 희망입주일이 있고, 시작일 기준 31일 전이면 호박색
                글씨로 기한이 표시됩니다. 계약 마감이 가까운 고객은 홈에서
                안내될 수 있습니다.
              </p>
            </GuideItem>

            <GuideItem title="체험(데모) 데이터">
              <p>
                처음 로그인 시 체험용 고객·매물·일정이 생길 수 있습니다. 체험
                데이터는 실제 팀 공유 공간으로 넘어가지 않도록 분리되어
                있습니다.
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
            <li>조건에 맞는 매물·고객 매칭과 리스트 관리</li>
            <li>방문 일정·도착 시간 기준 동선 구성</li>
            <li>전화·티맵·네이버지도·카카오맵 등 원클릭 연결</li>
            <li>
              팀 공유: 공유 코드로 공간 합류 후, 리스트에서 「팀 공유하기」로
              항목별 공개
            </li>
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
            서비스 유지를 위해 Google AdSense 등 광고가 표시될 수 있으며, 승인·설정
            전에는 광고가 나오지 않을 수 있습니다. 광고는 주로 홈·소개 등 일반
            화면에 두고,{" "}
            <strong className="font-bold text-gray-800">
              네비(현장 리드) 진행 화면에는 넣지 않는 것
            </strong>
            을 원칙으로 합니다. 향후 유료 요금제·부가 기능이 도입될 수 있습니다.
            자세한 내용은{" "}
            <Link
              href="/terms"
              className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
            >
              약관 · 개인정보 · 광고
            </Link>
            를 확인해 주세요.
          </p>
        </section>

        <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <h2 className="text-[16px] font-bold text-gray-900">시작하기</h2>
          <p className="mt-2">
            회원가입 후 바로 고객·매물을 등록할 수 있습니다. 이용 전
            약관·개인정보·광고·면책 안내에 동의해 주세요.
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
