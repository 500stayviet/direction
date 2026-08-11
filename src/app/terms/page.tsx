"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

type Tab = "service" | "privacy" | "ads" | "disclaimer";

const TABS: { id: Tab; label: string }[] = [
  { id: "service", label: "이용약관" },
  { id: "privacy", label: "개인정보" },
  { id: "ads", label: "광고" },
  { id: "disclaimer", label: "면책" },
];

export default function TermsPage() {
  const [tab, setTab] = useState<Tab>("service");

  return (
    <main className="pb-4">
      <PageHeader title="약관 및 안내" backHref="/" />

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
      <p className="text-[12px] font-semibold text-gray-400">
        시행일 2026. 8. 1. · 개정 2026. 8. 11.
      </p>
      <Section title="1. 서비스 성격">
        <p>
          현장동선(이하 “본 서비스”)은 부동산 중개 현장 업무를 돕는{" "}
          <strong className="font-bold text-gray-800">업무 편의 도구</strong>
          입니다. 누구나 의무적으로 써야 하는 서비스가 아니며,{" "}
          <strong className="font-bold text-gray-800">
            필요로 하는 분이 자발적으로 선택해 사용
          </strong>
          하는 것을 전제로 합니다. 서비스 운영을 위해 광고가 표시될 수 있으며,
          향후 유료 요금제·부가 기능이 도입될 수 있습니다.
        </p>
      </Section>
      <Section title="2. 이용 자격 및 동의">
        <p>
          회원가입·팀 공유(공유 코드 생성·참여)·서비스 이용을 시작하면 본
          약관·개인정보 안내·광고 안내·면책 내용에 동의한 것으로 봅니다.
          동의하지 않으면 이용을 중단해 주세요.
        </p>
      </Section>
      <Section title="3. 이용자 책임·최소 입력">
        <p>
          계정 정보와 고객·매물·일정 등 입력 데이터의 정확성·수집 적법성·보관·백업
          및 외부 전달 결과는 이용자 책임입니다. 본 서비스는{" "}
          <strong className="font-bold text-gray-800">
            주민등록번호 등 고유식별정보를 받지 않습니다.
          </strong>{" "}
          업무상 필요할 수 있는 항목은 주로{" "}
          <strong className="font-bold text-gray-800">
            이름(또는 명칭)·전화번호·주소(구·동·지번 본번 등)·호실
          </strong>
          이며, 호실은 필수가 아닙니다. 유출·오남용이 우려되면 실명 대신{" "}
          <strong className="font-bold text-gray-800">명칭</strong>으로
          관리하고, 불필요한 상세 정보는 입력하지 마세요. 전화·네비·외부 앱
          연동 결과와 매물 공유 문구·수신자 선택에 따른 결과도 이용자 책임입니다.
        </p>
      </Section>
      <Section title="4. 팀 공유 및 데이터 소유">
        <p>
          공유 코드로 팀 공유에 참여하면, 해당 공간의 고객·매물 리스트와
          (이용자가 「팀공유」한) 방문 일정은{" "}
          <strong className="font-bold text-gray-800">
            업장(공유 공간)의 업무 데이터
          </strong>
          로 취급됩니다. 등록자는 “작성자”로 표시될 수 있으나, 한 번 공유된
          데이터는 개인 탈퇴만으로 자동 소멸되지 않으며 공유 공간에 남을 수
          있습니다. 팀 공유 시작(코드 생성·참여)은 본 조항에 대한 동의로
          봅니다.
        </p>
      </Section>
      <Section title="5. 회원 탈퇴·악의적 삭제">
        <p>
          회원 탈퇴는{" "}
          <strong className="font-bold text-gray-800">
            해당 계정의 로그인·이용 종료
          </strong>
          를 의미합니다. 이미 팀 공유에 포함된 업무 데이터의 영구 파기를
          의미하지 않으며, 운영·복구·분쟁 대응을 위해 법령이 허용하는 범위에서
          보관·복원될 수 있습니다. 이용자가 고의·악의로 업장 업무 데이터를
          영구 소멸시키려는 행위에는{" "}
          <strong className="font-bold text-gray-800">동의하지 않으며</strong>,
          소프트 삭제·복원·이용 제한 등 보호 조치를 할 수 있습니다. 다만 관련
          법령에 따른 정당한 요청·보관 기간 경과 후 파기 등 예외는 별도로
          적용될 수 있습니다.
        </p>
      </Section>
      <Section title="6. 금지 행위">
        <p>
          다음 행위를 금합니다. 위반이 확인되면 사전 통지 없이 이용을 제한하거나
          계정을 정지·비활성화할 수 있으며, 그로 인한 분쟁·손해의 책임은 해당
          이용자에게 있습니다.
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
      <Section title="7. 서비스 변경·중단">
        <p>
          운영상 필요에 따라 기능을 변경·중단하거나 제공을 종료할 수 있으며,
          유료화가 도입되는 경우 요금·제공 범위는 별도 안내할 수 있습니다. 이에
          대해 별도의 보상 의무를 부담하지 않습니다(관련 법령이 달리 정하는
          경우 제외).
        </p>
      </Section>
    </>
  );
}

function PrivacyTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">
        시행일 2026. 8. 1. · 개정 2026. 8. 11.
      </p>
      <Section title="1. 저장·처리 방식">
        <p>
          계정 인증 및 고객·매물·일정 등 업무 데이터는{" "}
          <strong className="font-bold text-gray-800">
            클라우드 데이터베이스(Supabase)
          </strong>
          에 저장됩니다. 로그인 세션은 브라우저에 보관될 수 있습니다. 팀 공유에
          참여한 경우, 해당 공간의 업무 데이터는 같은 코드를 입력한 멤버와
          함께 조회·처리할 수 있습니다. 팀 공유에 참여하지 않은 계정의
          데이터는 기본적으로 계정별로 분리됩니다.
        </p>
      </Section>
      <Section title="2. 수집·이용 항목">
        <p>
          본 서비스는{" "}
          <strong className="font-bold text-gray-800">
            주민등록번호를 수집하지 않습니다.
          </strong>
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="font-bold text-gray-800">계정</strong> — 아이디,
            비밀번호, 비밀번호 힌트(필수), 업장명·이름·전화번호(선택). 선택
            정보는 매물 공유 시 연락 안내 등에 사용될 수 있습니다.
          </li>
          <li>
            <strong className="font-bold text-gray-800">업무 입력</strong> —
            이용자가 직접 넣는 고객·매물 관련{" "}
            <strong className="font-bold text-gray-800">
              이름 또는 명칭, 전화번호, 주소(구·동·지번 본번 등), 호실(선택),
              일정·조건 메모
            </strong>{" "}
            등. 호실은 필수가 아니며, 지번 본번만으로도 길안내 보조가
            가능하도록 설계되어 있습니다.
          </li>
        </ul>
        <p>
          유출이 우려되면 실명 대신 명칭을 쓰고, 필요 최소 범위만 입력하세요.
          입력하지 않은 정보는 저장되지 않습니다.
        </p>
      </Section>
      <Section title="3. 팀 공유·탈퇴 시 처리">
        <p>
          팀 공유 공간의 데이터는 업장 업무 자산으로 취급될 수 있으며, 회원
          탈퇴 후에도 공유 공간·운영상 보관(복구·분쟁·법령 대응) 목적 범위에서
          남을 수 있습니다. 계정 탈퇴는 로그인 불가 처리를 포함하며, 이미 공유된
          데이터의 즉시·영구 삭제를 자동으로 보장하지 않습니다. 법령상 정당한
          삭제·열람 요청이 있으면 관련 절차에 따릅니다.
        </p>
      </Section>
      <Section title="4. 유출·관리 책임">
        <p>
          비밀번호·기기·계정 공유, 화면 캡처, 메신저 전달, 팀 멤버 초대 오류 등
          이용자 측 관리로 인한 유출·노출은{" "}
          <strong className="font-bold text-gray-800">이용자 책임</strong>
          입니다. 호스팅 장애·해킹·설정 오류·제3자 서비스 문제 등으로 의도치
          않은 유출·유실이 발생할 수 있으며, 운영자는 법령이 허용하는 범위에서
          고의·중대한 과실이 없는 한 손해배상·완전 복구 의무를 부담하지
          않습니다. 중요한 자료는 이용자가 별도로 백업하세요. 영구 보존·무중단
          백업을 보장하지 않습니다.
        </p>
      </Section>
      <Section title="5. 제3자 제공·처리">
        <p>
          운영자가 이용자 업무 데이터를 판매하지 않습니다. 다만 서비스 제공에
          필요한 범위에서 제3자가 관여할 수 있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            <strong className="font-bold text-gray-800">Supabase</strong> —
            인증·데이터베이스 호스팅
          </li>
          <li>
            <strong className="font-bold text-gray-800">Google AdSense</strong> —
            광고 게재 시 광고·측정(쿠키·기기 식별자 등 포함 가능). 상세는 「광고」
            탭
          </li>
          <li>
            전화·지도·네비 등 이용자가 선택한 외부 앱 — 해당 앱의 정책 적용
          </li>
        </ul>
      </Section>
      <Section title="6. 쿠키·유사 기술">
        <p>
          로그인 유지, 서비스 설정 저장, (광고 사용 시) 광고·트래픽 측정 목적으로
          쿠키 또는 로컬 저장소가 사용될 수 있습니다. 브라우저 설정으로 쿠키를
          제한할 수 있으나 일부 기능이 제한될 수 있습니다.
        </p>
      </Section>
      <Section title="7. 문의">
        <p>
          계정·데이터·개인정보 관련 문의는 서비스 내 안내 또는 운영 채널을 통해
          요청할 수 있습니다.
        </p>
      </Section>
    </>
  );
}

function AdsTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">
        시행일 2026. 8. 1.
      </p>
      <Section title="1. 광고 사용 목적">
        <p>
          본 서비스 운영을 위해{" "}
          <strong className="font-bold text-gray-800">Google AdSense</strong> 등
          제3자 광고를 게재할 수 있습니다. 광고 승인을 받기 전에는 광고가
          표시되지 않을 수 있습니다. 향후 유료 요금제와 병행될 수 있습니다.
        </p>
      </Section>
      <Section title="2. 광고 위치">
        <p>
          광고는 주로 홈·소개 등 일반 화면의 여유 공간에 배치합니다.{" "}
          <strong className="font-bold text-gray-800">
            현장 리드(네비 진행) 화면에는 광고를 넣지 않는 것을 원칙
          </strong>
          으로 합니다. 광고를 클릭하도록 유도하거나 보상하지 않습니다.
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
      <Section title="4. 이용자 선택">
        <p>
          광고·쿠키를 원하지 않으면 브라우저 쿠키 차단, 추적 방지 설정, 또는 서비스
          이용 중단이 가능합니다. 광고를 부정하게 클릭·요청하는 행위는 금지되며,
          Google 및 본 서비스 정책 위반이 될 수 있습니다.
        </p>
      </Section>
      <Section title="5. ads.txt">
        <p>
          광고 판매자 투명성을 위해 사이트 루트에{" "}
          <code className="rounded bg-gray-100 px-1 text-[12px]">/ads.txt</code>
          를 게시합니다. AdSense 승인 및 게시자 ID 설정 후 자동으로 채워집니다.
        </p>
      </Section>
    </>
  );
}

function DisclaimerTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">
        시행일 2026. 8. 1. · 개정 2026. 8. 11.
      </p>
      <Section title="1. 무보증 제공">
        <p>
          본 서비스는{" "}
          <strong className="font-bold text-gray-800">
            “있는 그대로(AS IS)” 제공
          </strong>
          됩니다. 특정 목적 적합성, 정확성, 무중단, 오류 없음, 데이터 영구
          보존·복구를 보증하지 않으며,{" "}
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
            입력·공유·전달·기기·계정 관리로 인한 유출 및 그 결과
          </strong>
          는 원칙적으로 이용자(업장) 책임 영역입니다. 우려되면 실명 대신 명칭을
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
          멤버 간 분쟁 등)에 대해{" "}
          <strong className="font-bold text-gray-800">책임을 지지 않습니다.</strong>
        </p>
      </Section>
      <Section title="4. 팀 공유·탈퇴·삭제">
        <p>
          팀 공유 데이터의 업장 소유 취급, 탈퇴 후에도 공유 데이터가 남을 수
          있음, 악의적 영구 소멸에 동의하지 않음은 이용약관에 따릅니다. 운영자의
          보관·복원은 업장 업무 보호·복구·법령 대응 목적이며, 이용자 요청만으로
          공유 공간 전체의 즉시 영구 삭제를 보장하지 않을 수 있습니다.
        </p>
      </Section>
      <Section title="5. 매물 공유·이용자 행위">
        <p>
          매물 공유·팀 공유 기능은 이용자가 직접 내용을 확인하고 전달·공동
          이용하는 편의 기능입니다. 공유 문구·연락처의 진실성, 수신자·멤버
          선택, 사기·기만·오인 유발 등 이용자 행위로 인한 민·형사상 책임은
          이용자에게 있으며, 운영자는 이를 보증·중재하거나 대신 책임지지
          않습니다. 허위 매물·허위 고객 등록이 확인되면 이용약관에 따라 계정
          정지 등 이용 제한 조치가 이뤄질 수 있습니다.
        </p>
      </Section>
      <Section title="6. 외부 연동">
        <p>
          원클릭 전화, 네비게이션, 지도, 클라우드 호스팅, 광고 네트워크 등 외부
          앱·서비스의 동작·요금·정확도는 해당 제공자 책임 영역입니다. 현장
          이동·계약·안내에 앞서 이용자가 반드시 재확인해야 합니다.
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
