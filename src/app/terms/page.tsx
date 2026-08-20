"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE, siteMailtoHref } from "@/lib/constants/site";

type Tab = "service" | "privacy" | "ads" | "disclaimer";

const TABS: { id: Tab; label: string }[] = [
  { id: "service", label: "이용약관" },
  { id: "privacy", label: "개인정보" },
  { id: "ads", label: "광고" },
  { id: "disclaimer", label: "면책" },
];

function tabFromSearch(raw: string | null): Tab {
  if (raw === "privacy" || raw === "ads" || raw === "disclaimer") return raw;
  return "service";
}

function termsBackHref(from: string | null): string {
  if (from === "signup") return "/signup";
  if (from === "login") return "/login";
  return "/";
}

const REVISION = "시행일 2026. 8. 1. · 개정 2026. 8. 16.";

function BusinessOperatorBlock() {
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-3 text-[12px] leading-relaxed text-gray-600">
      <p className="font-bold text-gray-800">사업자 정보</p>
      <ul className="mt-1.5 space-y-0.5">
        <li>
          서비스명 {SITE.serviceName} · 상호 {SITE.companyName}
        </li>
        <li>대표자 {SITE.representative}</li>
        <li>사업자등록번호 {SITE.businessNumber}</li>
        <li>사업장 주소 {SITE.address}</li>
        <li>
          고객센터{" "}
          <a
            href={siteMailtoHref()}
            className="font-semibold text-[#3182F6] underline-offset-2 hover:underline"
          >
            {SITE.contactEmail}
          </a>
        </li>
      </ul>
    </div>
  );
}

export default function TermsPage() {
  return (
    <Suspense
      fallback={
        <main className="pb-4">
          <PageHeader title="약관 및 안내" backHref="/" />
        </main>
      }
    >
      <TermsPageInner />
    </Suspense>
  );
}

function TermsPageInner() {
  const searchParams = useSearchParams();
  const backHref = termsBackHref(searchParams.get("from"));
  const [tab, setTab] = useState<Tab>(() =>
    tabFromSearch(searchParams.get("tab"))
  );

  return (
    <main className="pb-4">
      <PageHeader title="약관 및 안내" backHref={backHref} />

      <div className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-gray-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "min-h-[40px] rounded-xl text-[12px] font-bold transition-all duration-150 active:scale-95",
              tab === item.id
                ? "bg-white text-[#3182F6] shadow-sm"
                : "text-gray-500",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <article className="space-y-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        {tab === "service" && <ServiceTerms />}
        {tab === "privacy" && <PrivacyTerms />}
        {tab === "ads" && <AdsTerms />}
        {tab === "disclaimer" && <DisclaimerTerms />}
      </article>

      <p className="mt-4 px-1 text-center text-[12px] leading-relaxed text-gray-400">
        본 문서는 서비스 이용 조건을 안내하기 위한 것이며,
        <br />
        법률 자문을 대체하지 않습니다.
      </p>

      <p className="mt-3 text-center text-[12px]">
        <Link
          href="/about"
          className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
        >
          서비스 소개 보기
        </Link>
        {" · "}
        <Link
          href="/about#guide"
          className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
        >
          사용설명
        </Link>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/signup"
          className="flex min-h-[48px] items-center justify-center rounded-2xl bg-[#3182F6] text-[15px] font-bold text-white active:scale-95 transition-all duration-150"
        >
          회원가입
        </Link>
        <Link
          href="/login"
          className="flex min-h-[48px] items-center justify-center rounded-2xl bg-gray-100 text-[15px] font-bold text-gray-800 active:scale-95 transition-all duration-150"
        >
          로그인
        </Link>
      </div>

      <SiteFooter showNavLinks={false} className="mt-6" />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
      <div className="space-y-2 text-[13px] leading-relaxed text-gray-600">
        {children}
      </div>
    </section>
  );
}

function ServiceTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">{REVISION}</p>
      <BusinessOperatorBlock />
      <Section title="1. 서비스 성격">
        <p>
          {SITE.serviceName}(이하 “본 서비스”)은 부동산 중개 현장 업무를 돕는{" "}
          <strong className="font-bold text-gray-800">업무 편의 도구</strong>
          (모바일 웹)입니다. 고객·매물·방문 일정(네비)·전화·길안내 연결·조건
          매칭·팀 공유를 정리하는 선택적 도구이며, 누구나 의무적으로 써야 하는
          서비스가 아닙니다. 서비스 운영을 위해 광고가 표시될 수 있으며, 향후
          유료 요금제·부가 기능이 도입될 수 있습니다. 본 서비스는{" "}
          <strong className="font-bold text-gray-800">{SITE.companyName}</strong>
          (대표 {SITE.representative})가 제공합니다.
        </p>
      </Section>
      <Section title="2. 이용 자격 및 동의">
        <p>
          회원가입·로그인·팀 공유(공유 코드 생성·참여)·「팀 공유하기」
          사용·서비스 이용을 시작하면 본 약관·개인정보 안내·광고 안내·면책
          내용에 동의한 것으로 봅니다. 동의하지 않으면 이용을 중단해 주세요.
        </p>
      </Section>
      <Section title="3. 계정 · 업장명 · 최소 입력">
        <p>
          아이디는 중복 확인을 거쳐 가입하며,{" "}
          <strong className="font-bold text-gray-800">
            탈퇴·삭제 처리된 아이디는 재사용할 수 없습니다
          </strong>
          (동일 아이디 재가입 차단). 계정 정보와 고객·매물·일정 등 입력
          데이터의 정확성·수집 적법성·보관·백업 및 외부 전달 결과는 이용자
          책임입니다.
        </p>
        <p>
          업장명을 입력하면 「부동산」 또는 「공인중개사사무소」가 포함되지 않은
          경우 서비스가 「공인중개사사무소」를 붙여 저장·표시할 수 있습니다.
          업장명을 입력하지 않은 경우 기본 표기를 쓰며, 미입력 상태를 억지로
          바꾸지 않습니다. 프로필 이름(표시 이름)을 바꾸면 본인이 등록한
          항목의 「등록자」 표시가 함께 갱신될 수 있습니다.
        </p>
        <p>
          본 서비스는{" "}
          <strong className="font-bold text-gray-800">
            주민등록번호 등 고유식별정보를 받지 않습니다.
          </strong>{" "}
          업무상 필요할 수 있는 항목은 주로{" "}
          <strong className="font-bold text-gray-800">
            이름(또는 명칭)·전화번호·주소(구·동·지번 본번 등)·호실
          </strong>
          이며, 호실은 필수가 아닙니다. 유출이 우려되면 실명 대신 명칭으로
          관리하고, 불필요한 상세 정보는 입력하지 마세요. 전화·네비·외부 앱
          연동 결과와 매물 공유 문구·수신자 선택에 따른 결과도 이용자 책임입니다.
        </p>
        <p>
          고객·매물 화면에서{" "}
          <strong className="font-bold text-gray-800">
            메시지 붙여넣기, 대화(마이크), 사진
          </strong>
          으로 칸을 채울 수 있습니다. 「반영하기」는{" "}
          <strong className="font-bold text-gray-800">화면에만 넣고</strong>,
          「고객등록하기」·「매물등록하기」(수정 시 저장)를 눌러야 클라우드에
          저장됩니다. 칸이 비어 있으면 등록이 막힐 수 있으니, 반영 뒤 내용을
          확인해 주세요.
        </p>
      </Section>
      <Section title="4. 팀 공유 (계정 → 공간 → 항목)">
        <p>
          팀 공유는{" "}
          <strong className="font-bold text-gray-800">
            지역·상호 이름 자동 공유가 아닙니다.
          </strong>{" "}
          순서는 다음과 같습니다.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="font-bold text-gray-800">계정</strong> — 로그인
            계정의 데이터가 기본입니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">공유 공간</strong> —
            공유 코드를 생성·입력한 계정만 같은 공간에 합류합니다. 공간
            이름(예: 「성내」)은 구분용 라벨이며, 동일 명칭이라도 코드 없이
            자동 합류되지 않습니다. 공유 코드는 짧은 시간만 유효할 수 있습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">항목별 공유</strong> —
            공간에 합류한 뒤에도 고객·매물·네비(방문 일정)에서 이용자가 「팀
            공유하기」를{" "}
            <strong className="font-bold text-gray-800">켠 항목만</strong>{" "}
            팀원에게 공개됩니다. 공유를 끄면 팀원 목록에서 보이지 않을 수
            있습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">공유 해제</strong> — 「팀
            공유하기」 끄기는{" "}
            <strong className="font-bold text-gray-800">등록자(소유자)</strong>
            만 할 수 있습니다. 팀원이 타인 공유 항목을 누르면 안내만 표시될 수
            있습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">팀원 목록에서의 삭제</strong>{" "}
            — 팀원이 다른 사람 공유 항목을 「삭제」하면, 원본을 지우는 것이
            아니라{" "}
            <strong className="font-bold text-gray-800">
              본인 화면에서만 숨김
            </strong>
            처리될 수 있습니다. 소유자 데이터와 다른 팀원 화면은 유지될 수
            있으며, 다시 공유되면 목록에 다시 나타날 수 있습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">팀 나가기</strong> —
            앱에서 「바로 나가기」로 즉시 탈퇴되지 않을 수 있습니다. 운영
            안내에 따라{" "}
            <strong className="font-bold text-gray-800">이메일 문의</strong>
            로 요청해 주세요. 관리자가 팀원 한 명만 나가게 처리하면 해당
            이용자의 공유는 팀에서 해제되고, 남은 인원이 1명 이하면 공간이
            해체될 수 있습니다.
          </li>
        </ul>
        <p>
          한 번 팀 공유된 데이터는{" "}
          <strong className="font-bold text-gray-800">
            업장(공유 공간)의 업무 데이터
          </strong>
          로 취급될 수 있습니다. 등록자는 “작성자”로 표시될 수 있으나, 개인
          탈퇴만으로 자동 소멸되지 않고 공유 공간에 남을 수 있습니다. 앱이
          화면에 있는 동안 공유·변경이 실시간으로 반영되도록 동기화할 수
          있습니다(백그라운드 푸시 알림을 보장하지는 않습니다). 팀 공유
          시작(코드 생성·참여) 및 「팀 공유하기」 사용은 본 조항에 대한
          동의로 봅니다.
        </p>
      </Section>
      <Section title="5. 조건 매칭 · 알림 · 삭제">
        <p>
          고객·매물 상세의 「조건에 맞는 매물/고객」은 유형·금액 범위·입주
          기간·대출·보증보험·주차·엘리베이터·애완 등 입력된 조건을 바탕으로
          후보를 보여 주는 편의 기능입니다. 매칭 결과의 완전성·정확성을
          보증하지 않으며, 최종 등록·선택·계약 판단은 이용자 책임입니다.
          「{SITE.serviceName}내(사이트) 공유」 매칭 등 일부 기능은{" "}
          <strong className="font-bold text-gray-800">준비 중</strong>일 수
          있습니다.
        </p>
        <p>
          팀 공유로 새로 들어온 항목은 읽음·미확인 표시(하단 숫자 등)가 계정에
          저장되어{" "}
          <strong className="font-bold text-gray-800">
            같은 계정으로 쓰는 기기 간
          </strong>
          맞춰질 수 있습니다. 조건 매칭 목록에서 항목을 제외하거나 리스트에서
          삭제하면 화면에서 바로 반영되며, 서버에는 복구·분쟁·업장 보호를 위해{" "}
          <strong className="font-bold text-gray-800">소프트 삭제</strong> 등으로
          남을 수 있습니다.
        </p>
        <p>
          고객 희망입주일·매물 임대희망일의{" "}
          <strong className="font-bold text-gray-800">시작일 기준 정확히 45일 전</strong>
          인 날에 카드·홈에서 기한 안내가 뜰 수 있습니다. 원터치 네비에 넘기는
          주소는 시 이름을{" "}
          <strong className="font-bold text-gray-800">서울특별시</strong>로 맞춰
          외부 앱에 전달될 수 있습니다. 목록 카드에는 앞에 붙은 「서울」을 빼고
          보여 줄 수 있습니다.
        </p>
      </Section>
      <Section title="6. 회원 탈퇴·악의적 삭제">
        <p>
          회원 탈퇴는{" "}
          <strong className="font-bold text-gray-800">
            해당 계정의 로그인·이용 종료
          </strong>
          를 의미합니다. 이미 팀 공유에 포함된 업무 데이터의 영구 파기를
          의미하지 않으며, 운영·복구·분쟁 대응을 위해 법령이 허용하는 범위에서
          보관·복원될 수 있습니다. 탈퇴 아이디는 재가입에 쓸 수 없습니다.
          이용자가 고의·악의로 업장 업무 데이터를 영구 소멸시키려는 행위에는{" "}
          <strong className="font-bold text-gray-800">동의하지 않으며</strong>,
          소프트 삭제·복원·이용 제한 등 보호 조치를 할 수 있습니다. 다만 관련
          법령에 따른 정당한 요청·보관 기간 경과 후 파기 등 예외는 별도로
          적용될 수 있습니다.
        </p>
      </Section>
      <Section title="7. 계정 정지 · 운영 조치">
        <p>
          약관 위반·허위 등록·부정 이용·신고 조사 등이 확인되거나 운영상
          필요하다고 판단되면, 운영자(슈퍼관리자·직원)는 계정을{" "}
          <strong className="font-bold text-gray-800">정지</strong>할 수
          있습니다. 정지 시에도{" "}
          <strong className="font-bold text-gray-800">로그인은 가능할 수</strong>{" "}
          있으나,{" "}
          <strong className="font-bold text-gray-800">
            홈 외 기능 이용이 제한
          </strong>
          되고 화면에 정지 사유와 관리자 문의 안내가 표시될 수 있습니다. 정지는
          데이터·아이디의 즉시 삭제를 의미하지 않으며, 사유가 해소되면 정지를
          해제할 수 있습니다.
        </p>
        <p>
          운영자는 서비스 보호·복구·분쟁·법령 대응을 위해 소프트 삭제된
          고객·매물·네비의 조회·복원(원래 계정 또는 다른 계정으로의 이전),
          탈퇴 계정 복구, 팀원 나가기 처리 등을 할 수 있습니다. 복원·열람은
          권한(슈퍼/직원)에 따라 범위가 다를 수 있으며, 전화·호실 등 민감
          표시는 마스킹될 수 있습니다.
        </p>
      </Section>
      <Section title="8. 금지 행위">
        <p>
          다음 행위를 금합니다. 위반이 확인되면 사전 통지 없이 이용을 제한하거나
          계정을 정지할 수 있으며, 그로 인한 분쟁·손해의 책임은 해당 이용자에게
          있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="font-bold text-gray-800">
              허위 매물·허위 고객(또는 허위·조작된 연락처·조건·현황)을 등록하는
              행위
            </strong>
            — 확인 시 계정 정지·이용 제한 조치가 취해질 수 있습니다.
          </li>
          <li>
            타인의 정보를 무단으로 수집·이용하거나, 허위·과장 매물·연락처로
            타인을 속이거나 오인하게 하는 행위
          </li>
          <li>
            공유 공간 데이터를 무단으로 외부 유출하거나, 악의적으로 삭제·변조해
            업장 업무를 방해하는 행위
          </li>
          <li>
            공유 코드·멤버 초대를 부정하게 유포하거나, 허락 없이 타 업장
            공간에 침입하려는 행위
          </li>
          <li>
            본 서비스·운영자·다른 이용자를 비방·모욕하거나, 명예를 훼손하거나,
            악의적으로 서비스 이미지·신뢰를 해치는 행위
          </li>
          <li>
            계정·시스템 무단 접근, 해킹, 데이터 무단 수집(스크래핑 등), 서비스
            장애·과부하를 유발하는 행위
          </li>
          <li>
            서비스 기능·보안·광고를 우회·조작하거나, 리버스 엔지니어링·복제·재판매
            등 부정한 목적의 이용
          </li>
          <li>
            본 서비스를 불법·부정한 목적에 사용하거나, 광고를 부정 클릭·유도하는
            행위
          </li>
        </ul>
      </Section>
      <Section title="9. 서비스 변경·중단">
        <p>
          운영상 필요에 따라 기능을 변경·중단하거나 제공을 종료할 수 있으며,
          유료화가 도입되는 경우 요금·제공 범위는 별도 안내할 수 있습니다. 이에
          대해 별도의 보상 의무를 부담하지 않습니다(관련 법령이 달리 정하는
          경우 제외). 사이트내공유 등 일부 기능은 준비 중일 수 있으며, 제공
          시점·범위는 달라질 수 있습니다.
        </p>
      </Section>
    </>
  );
}

function PrivacyTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">{REVISION}</p>
      <BusinessOperatorBlock />
      <Section title="1. 개인정보 처리자">
        <p>
          개인정보 처리자는 상호{" "}
          <strong className="font-bold text-gray-800">{SITE.companyName}</strong>
          , 대표자 {SITE.representative}, 사업자등록번호 {SITE.businessNumber},
          사업장 주소 {SITE.address}입니다. 문의는{" "}
          <a
            href={siteMailtoHref()}
            className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
          >
            {SITE.contactEmail}
          </a>
          로 할 수 있습니다. {SITE.serviceName} 서비스의 개인정보는 아래와 같이
          처리됩니다.
        </p>
      </Section>
      <Section title="2. 저장·처리 방식">
        <p>
          계정 인증 및 고객·매물·일정 등 업무 데이터는{" "}
          <strong className="font-bold text-gray-800">
            클라우드 데이터베이스(Supabase)
          </strong>
          에 저장됩니다. 로그인 세션·화면 상태·목록 캐시는 브라우저(로컬
          저장소·세션 저장소·쿠키)에 보관될 수 있습니다. 앱이 열려 있는 동안
          팀 공유·목록 변경을 반영하기 위해 실시간 동기화가 사용될 수 있습니다.
        </p>
        <p>
          팀 공유에 참여하고 「팀 공유하기」를 켠 항목은 같은 공유 공간의
          멤버와 함께 조회·처리될 수 있습니다. 팀 공유에 참여하지 않았거나
          항목 공유를 켜지 않은 데이터는 기본적으로 계정별로 분리됩니다.
        </p>
      </Section>
      <Section title="3. 수집·이용 항목">
        <p>
          본 서비스는{" "}
          <strong className="font-bold text-gray-800">
            주민등록번호를 수집하지 않습니다.
          </strong>
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="font-bold text-gray-800">계정</strong> — 아이디,
            비밀번호, 비밀번호 힌트(필수), 업장명·이름·전화번호(선택). 업장명은
            표시·매물 공유 안내용으로 정규화(접미사 보정)될 수 있습니다. 선택
            정보는 매물 공유 시 연락 안내 등에 사용될 수 있습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">업무 입력</strong> —
            이용자가 직접 넣는 고객·매물 관련{" "}
            <strong className="font-bold text-gray-800">
              이름 또는 명칭, 전화번호, 주소(구·동·지번 본번 등), 호실(선택),
              거래·입주·대출·보증보험·주차·엘리베이터·애완 등 조건, 일정·메모,
              팀 공유·사이트내공유 설정
            </strong>{" "}
            등. 호실은 필수가 아닙니다. 메시지 붙여넣기·대화(마이크)·사진으로
            칸을 채운 뒤 「등록하기」로 저장한 내용도 같습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">빠른 입력 보조</strong> —
            대화 입력은 기기·브라우저의 음성인식을 쓰며, 음성은 해당
            브라우저·운영체제 제공자 쪽으로 처리될 수 있습니다. 사진 입력은
            기기에서 글자를 읽고, 메시지·사진에서 규칙으로 채우지 못한 짧은
            잔여는 입력 보조를 위해 외부 AI(DeepSeek)로 보낼 수 있습니다.{" "}
            <strong className="font-bold text-gray-800">
              마이크 대화는 그 AI로 보내지 않습니다.
            </strong>{" "}
            마이크·사진 허용 안내는 앱에서 묻고, 허용 기록은 브라우저에 일정
            기간 남을 수 있습니다. 파서 개선을 위해 메시지·사진 원문(전화번호
            등은 가림)과 칸 채움 결과가 운영 서버에 모일 수 있으며, 마이크
            대화는 그 수집에 넣지 않습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">공유 공간</strong> —
            공유 코드 생성·참여 기록, 멤버십(역할), 공간 이름, 항목별 팀 공유
            여부. 삭제 계정 기록(재가입 차단용 아이디 등)이 남을 수 있습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">이용 환경 설정</strong> —
            팀 공유 신규 알림의 읽음/미확인, 팀원 화면에서의 항목 숨김 등 UI
            선호가 계정에 저장되어 같은 계정으로 로그인하는 기기(폰·PC 등)에서
            맞춰질 수 있습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">운영·보안</strong> —
            계정 정지 여부·정지 사유·정지/해제 시각, 감사 로그(관리자 조치
            기록), 소프트 삭제·복원 이력 등이 서비스 보호·분쟁 대응 목적으로
            처리될 수 있습니다.
          </li>
        </ul>
        <p>
          유출이 우려되면 실명 대신 명칭을 쓰고, 필요 최소 범위만 입력하세요.
          입력하지 않은 정보는 저장되지 않습니다.
        </p>
      </Section>
      <Section title="4. 이용 목적">
        <p>수집·저장된 정보는 다음 목적에 이용됩니다.</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>회원 식별·로그인·비밀번호 힌트 확인·탈퇴 아이디 재사용 차단</li>
          <li>
            고객·매물·네비 업무 기록, 조건 매칭, 팀 공유·동기화, 메시지·대화·사진
            입력 보조(칸 채움)
          </li>
          <li>신규 공유 알림·읽음 상태·목록 숨김 등 이용 편의</li>
          <li>
            약관 위반·부정 이용 대응, 계정 정지·해제, 소프트 삭제 복원, 팀
            운영 지원
          </li>
          <li>서비스 안정·보안·장애 대응, 법령상 의무 이행</li>
          <li>광고 게재 시 광고·측정(「광고」 탭)</li>
        </ul>
      </Section>
      <Section title="5. 팀 공유·탈퇴·삭제·정지 시 처리">
        <p>
          팀 공유 공간의 데이터는 업장 업무 자산으로 취급될 수 있으며, 회원
          탈퇴 후에도 공유 공간·운영상 보관(복구·분쟁·법령 대응) 목적 범위에서
          남을 수 있습니다. 계정 탈퇴는 로그인 불가 처리를 포함하며, 이미
          공유된 데이터의 즉시·영구 삭제를 자동으로 보장하지 않습니다.
        </p>
        <p>
          목록에서의 삭제는{" "}
          <strong className="font-bold text-gray-800">소프트 삭제</strong> 등
          방식으로 처리될 수 있으며, 운영자가 일정 기간 조회·복원할 수
          있습니다. 팀원이 타인 공유 항목을 목록에서 제외하는 경우{" "}
          <strong className="font-bold text-gray-800">
            본인 계정 기준 숨김
          </strong>
          일 수 있고, 원본 삭제가 아닐 수 있습니다.
        </p>
        <p>
          계정 정지는 원칙적으로{" "}
          <strong className="font-bold text-gray-800">
            로그인 가능·홈 외 기능 제한
          </strong>
          이며, 정지 사유가 이용자에게 표시될 수 있습니다. 정지는 데이터의 즉시
          파기를 의미하지 않습니다. 법령상 정당한 삭제·열람 요청이 있으면 관련
          절차에 따릅니다.
        </p>
      </Section>
      <Section title="6. 운영자(관리자) 접근">
        <p>
          서비스 운영을 위해 슈퍼관리자·직원 계정이 별도로 둘 수 있습니다.
          운영자는 회원 목록·계정 상세·팀 구성·소프트 삭제·탈퇴 기록 등을
          조회·조치할 수 있으며, 조치 내용은 감사 목적으로 기록될 수 있습니다.
        </p>
        <p>
          고객 전화번호·매물 호실 등 민감하게 취급하는 표시는 권한에 따라
          마스킹될 수 있고, 슈퍼관리자만 원문 확인이 가능할 수 있습니다. 운영자
          접근은 서비스 보호·복구·약관 집행·법령 대응 목적에 한정되며, 이용자
          업무 데이터를 판매하지 않습니다.
        </p>
      </Section>
      <Section title="7. 유출·관리 책임">
        <p>
          비밀번호·기기·계정 공유, 화면 캡처, 메신저 전달, 팀 멤버·공유 코드
          전달 오류 등 이용자 측 관리로 인한 유출·노출은{" "}
          <strong className="font-bold text-gray-800">이용자 책임</strong>
          입니다. 호스팅 장애·해킹·설정 오류·제3자 서비스 문제 등으로 의도치
          않은 유출·유실이 발생할 수 있으며, 운영자는 법령이 허용하는 범위에서
          고의·중대한 과실이 없는 한 손해배상·완전 복구 의무를 부담하지
          않습니다. 중요한 자료는 이용자가 별도로 백업하세요. 영구 보존·무중단
          백업을 보장하지 않습니다.
        </p>
      </Section>
      <Section title="8. 제3자 제공·처리">
        <p>
          운영자가 이용자 업무 데이터를 판매하지 않습니다. 다만 서비스 제공에
          필요한 범위에서 제3자가 관여할 수 있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="font-bold text-gray-800">Supabase</strong> —
            인증·데이터베이스 호스팅·실시간 동기화
          </li>
          <li>
            <strong className="font-bold text-gray-800">Google AdSense</strong> —
            광고 게재 시 광고·측정(쿠키·기기 식별자 등 포함 가능). 상세는 「광고」
            탭
          </li>
          <li>
            전화·지도·네비 등 이용자가 선택한 외부 앱 — 해당 앱의 정책 적용
          </li>
          <li>
            <strong className="font-bold text-gray-800">DeepSeek</strong> —
            메시지·사진에서 규칙으로 채우지 못한 짧은 잔여 글의 입력 보조(대화
            마이크는 제외)
          </li>
          <li>
            이용자 기기·브라우저의 음성인식 — 대화 입력 시. 제공자 정책 적용
          </li>
          <li>
            이용자가 직접 전달하는 매물 공유 문구 — 수신 채널(메신저 등)의 정책
            적용
          </li>
        </ul>
      </Section>
      <Section title="9. 쿠키·로컬 저장">
        <p>
          로그인 유지, 화면 로그인 상태, 목록 캐시, 알림·숨김의 임시 캐시,
          스플래시·안내 닫기, 마이크·사진 허용 여부, (광고 사용 시) 광고·트래픽
          측정 목적으로 쿠키 또는 로컬/세션 저장소가 사용될 수 있습니다. 일부 설정은 계정에도
          저장되어 기기 간 맞춰질 수 있습니다. 브라우저 설정으로 제한할 수
          있으나 일부 기능이 제한될 수 있습니다.
        </p>
      </Section>
      <Section title="10. 문의">
        <p>
          계정·데이터·개인정보·팀 나가기·정지 관련 문의는 서비스 내 안내 메일(
          <a
            href={siteMailtoHref()}
            className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
          >
            {SITE.contactEmail}
          </a>
          ) 또는 운영 채널을 통해 요청할 수 있습니다.
        </p>
      </Section>
    </>
  );
}

function AdsTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">{REVISION}</p>
      <Section title="1. 광고 사용 목적">
        <p>
          본 서비스 운영·유지 비용을 위해{" "}
          <strong className="font-bold text-gray-800">Google AdSense</strong> 등
          제3자 광고를 게재할 수 있습니다. 환경 설정·광고 승인을 받기 전에는
          광고가 표시되지 않을 수 있습니다. 향후 유료 요금제와 병행될 수
          있습니다.
        </p>
      </Section>
      <Section title="2. 광고 위치 · 원칙">
        <p>
          광고는 주로{" "}
          <strong className="font-bold text-gray-800">홈·서비스 소개</strong> 등
          일반 화면의 여유 공간에 배치합니다.{" "}
          <strong className="font-bold text-gray-800">
            네비(현장 리드·방문 진행) 화면에는 광고를 넣지 않는 것을 원칙
          </strong>
          으로 합니다. 광고를 클릭하도록 유도하거나 클릭에 보상을 제공하지
          않습니다.
        </p>
      </Section>
      <Section title="3. Google 및 파트너">
        <p>
          Google을 포함한 제3자 광고 사업자는 쿠키·광고 ID 등을 사용해 관심사에
          맞는 광고를 제공하거나 광고 성과를 측정할 수 있습니다. Google의 광고
          설정은{" "}
          <a
            href="https://adssettings.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
          >
            Google 광고 설정
          </a>
          에서 확인·조정할 수 있습니다. 관련 정책:{" "}
          <a
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
          >
            Google 광고 기술
          </a>
          .
        </p>
      </Section>
      <Section title="4. 이용자 선택 · 안내">
        <p>
          광고가 켜진 경우 서비스 이용 중 광고·쿠키 안내를 확인할 수 있습니다.
          광고·쿠키를 원하지 않으면 브라우저 쿠키 차단, 추적 방지 설정, 또는
          서비스 이용 중단이 가능합니다. 광고를 부정하게 클릭·요청하는 행위는
          금지되며, Google 및 본 서비스 정책 위반이 될 수 있습니다.
        </p>
      </Section>
      <Section title="5. ads.txt">
        <p>
          광고 판매자 투명성을 위해 사이트 루트에{" "}
          <code className="rounded bg-gray-100 px-1 text-[12px]">/ads.txt</code>
          를 게시합니다. AdSense 승인 및 게시자 ID 설정 후 내용이 채워집니다.
        </p>
      </Section>
    </>
  );
}

function DisclaimerTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">{REVISION}</p>
      <Section title="1. 무보증 제공">
        <p>
          본 서비스는{" "}
          <strong className="font-bold text-gray-800">
            “있는 그대로(AS IS)” 제공
          </strong>
          됩니다. 특정 목적 적합성, 정확성, 무중단, 오류 없음, 조건 매칭·동선
          순서의 완전성, 데이터 영구 보존·복구를 보증하지 않으며,{" "}
          <strong className="font-bold text-gray-800">
            데이터 유실·손상·접근 불능·의도치 않은 유출이 발생할 수 있습니다.
          </strong>{" "}
          이에 대한 복구 의무·손해배상 의무를 부담하지 않습니다(법령이 달리
          정하는 경우 및 운영자의 고의·중대한 과실이 입증되는 경우는 제외).
        </p>
      </Section>
      <Section title="2. 정보 유출·입력 최소화">
        <p>
          본 서비스에 입력되는 업무 정보는 주로{" "}
          <strong className="font-bold text-gray-800">
            이름(또는 명칭)·전화번호·주소·호실(선택)
          </strong>
          수준이며 주민등록번호는 받지 않습니다. 지번 본번을 받더라도 호실은
          필수가 아니므로, 이용자가 상세 호실을 넣지 않으면 그만큼 노출 범위가
          줄어듭니다. 그럼에도 유출·오남용 위험은 남아 있으며,{" "}
          <strong className="font-bold text-gray-800">
            입력·공유·전달·기기·계정·공유 코드 관리로 인한 유출 및 그 결과
          </strong>
          는 원칙적으로 이용자(업장) 책임 영역입니다. 메시지·대화·사진으로 칸을
          채운 경우에도 등록 전에 내용을 확인하세요. 우려되면 실명 대신 명칭을
          쓰고 최소 정보만 입력하세요.
        </p>
      </Section>
      <Section title="3. 책임의 제한">
        <p>
          법령이 허용하는 최대 범위 내에서, 운영자는 본 서비스 이용과 관련하여
          발생한 직접·간접·특별·결과적 손해(영업 손실, 계약 불이행, 길 안내 오류,
          연락 실패, 데이터 손실,{" "}
          <strong className="font-bold text-gray-800">
            고객·매물 정보 유출·노출
          </strong>
          , 기대 이익 상실, 광고 표시·클릭 관련 분쟁, 매물 공유·허위 표시·팀 공유
          멤버 간 분쟁, 조건 매칭·삭제 결과 오해 등)에 대해{" "}
          <strong className="font-bold text-gray-800">책임을 지지 않습니다.</strong>
        </p>
      </Section>
      <Section title="4. 팀 공유·탈퇴·삭제·정지">
        <p>
          팀 공유는 계정 기반이며, 공유 공간 이름은 지역 전체 공유를 의미하지
          않습니다. 항목별 「팀 공유하기」를 켠 데이터만 팀원에게 보일 수
          있습니다. 소유자만 공유를 끌 수 있고, 팀원의 목록 「삭제」는 본인
          화면 숨김일 수 있으며, 팀 나가기는 이메일 문의·운영 처리로 이뤄질 수
          있습니다. 업장 소유 취급, 탈퇴 후에도 공유 데이터가 남을 수 있음,
          악의적 영구 소멸에 동의하지 않음은 이용약관에 따릅니다.
        </p>
        <p>
          계정 정지는 로그인 가능·홈 외 이용 제한일 수 있으며, 소프트 삭제
          복원·탈퇴 복구·팀원 조치 등은 운영 목적입니다. 이용자 요청만으로 공유
          공간 전체의 즉시 영구 삭제를 보장하지 않을 수 있습니다.
        </p>
      </Section>
      <Section title="5. 매물 공유·이용자 행위">
        <p>
          매물 공유·팀 공유·조건 매칭 기능은 이용자가 직접 내용을 확인하고
          전달·공동 이용하는 편의 기능입니다. 공유 문구·연락처·업장명의
          진실성, 수신자·멤버 선택, 사기·기만·오인 유발 등 이용자 행위로 인한
          민·형사상 책임은 이용자에게 있으며, 운영자는 이를 보증·중재하거나
          대신 책임지지 않습니다. 허위 매물·허위 고객 등록이 확인되면
          이용약관에 따라 계정 정지 등 이용 제한 조치가 이뤄질 수 있습니다.
        </p>
      </Section>
      <Section title="6. 외부 연동">
        <p>
          원클릭 전화, 네비게이션, 지도, 클라우드 호스팅, 광고 네트워크 등 외부
          앱·서비스의 동작·요금·정확도는 해당 제공자 책임 영역입니다. 원터치
          네비 주소는 시 이름을 서울특별시로 맞춰 넘길 수 있습니다. 메시지·사진
          보조 AI·브라우저 음성인식·사진 글자 읽기의 정확도를 보증하지 않습니다.
          현장 이동·계약·안내에 앞서 이용자가 반드시 재확인해야 합니다.
        </p>
      </Section>
      <Section title="7. 자발적 이용·요금">
        <p>
          본 서비스는 필요한 분만 쓰는 선택적 도구입니다. 이용 여부, 입력 내용,
          업무상 판단의 최종 책임은 이용자에게 있습니다. 현재 제공 조건과 달리
          향후 유료 요금제·기능별 과금이 도입될 수 있으며, 도입 시 조건은 별도
          고지합니다. 요금 유무만으로 법령상 의무가 모두 면제되거나 가중되는
          것은 아니며, 면책은 관련 법령이 허용하는 범위와 아래 준거 조항에
          따릅니다.
        </p>
      </Section>
      <Section title="8. 준거">
        <p>
          본 안내와 관련한 분쟁은 대한민국 법을 기준으로 하며, 운영자의 고의 또는
          중대한 과실이 입증되는 경우를 제외하고는 위 면책 범위가 적용됩니다.
          본 문서는 법률 자문을 대체하지 않습니다.
        </p>
      </Section>
    </>
  );
}
