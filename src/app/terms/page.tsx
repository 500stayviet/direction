"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

type Tab = "service" | "privacy" | "disclaimer";

const TABS: { id: Tab; label: string }[] = [
  { id: "service", label: "이용약관" },
  { id: "privacy", label: "개인정보" },
  { id: "disclaimer", label: "면책" },
];

export default function TermsPage() {
  const [tab, setTab] = useState<Tab>("service");

  return (
    <main className="pb-4">
      <PageHeader title="약관 및 안내" backHref="/" />

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "min-h-[40px] rounded-xl text-[13px] font-bold transition-all duration-150 active:scale-95",
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
        {tab === "disclaimer" && <DisclaimerTerms />}
      </article>

      <p className="mt-4 px-1 text-center text-[12px] leading-relaxed text-gray-400">
        본 문서는 서비스 이용 조건을 안내하기 위한 것이며,
        <br />
        법률 자문을 대체하지 않습니다.
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
      <p className="text-[12px] font-semibold text-gray-400">시행일 2026. 8. 1.</p>
      <Section title="1. 서비스 성격">
        <p>
          현장동선(이하 “본 서비스”)은 부동산 중개 현장 업무를 돕는{" "}
          <strong className="font-bold text-gray-800">무료·비상업적 편의 도구</strong>
          입니다. 누구나 의무적으로 써야 하는 서비스가 아니며,{" "}
          <strong className="font-bold text-gray-800">
            필요로 하는 분이 자발적으로 선택해 사용
          </strong>
          하는 것을 전제로 합니다.
        </p>
      </Section>
      <Section title="2. 이용 자격 및 동의">
        <p>
          회원가입 또는 서비스 이용을 시작하면 본 약관·개인정보 안내·면책 내용에
          동의한 것으로 봅니다. 동의하지 않으면 이용을 중단해 주세요.
        </p>
      </Section>
      <Section title="3. 이용자 책임">
        <p>
          계정 정보, 손님·매물·일정 등 입력 데이터의 정확성·보관·백업은 이용자
          책임입니다. 전화 연결, 내비게이션 실행, 외부 앱 연동 결과 역시 이용자가
          확인·판단해야 합니다.
        </p>
      </Section>
      <Section title="4. 금지 행위">
        <p>
          타인의 정보를 무단으로 수집·이용하거나, 본 서비스를 불법·부정한 목적에
          사용하는 행위를 금합니다. 위반이 확인되면 이용을 제한할 수 있습니다.
        </p>
      </Section>
      <Section title="5. 서비스 변경·중단">
        <p>
          본 서비스는 무료로 제공되므로, 운영상 필요에 따라 기능을 변경·중단하거나
          제공을 종료할 수 있습니다. 이에 대해 별도의 보상 의무를 부담하지
          않습니다.
        </p>
      </Section>
    </>
  );
}

function PrivacyTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">시행일 2026. 8. 1.</p>
      <Section title="1. 저장 방식">
        <p>
          본 서비스는 별도의 중앙 서버에 이용자 업무 데이터를 업로드하지 않는 것을
          원칙으로 하며, 손님·매물·일정 등은{" "}
          <strong className="font-bold text-gray-800">
            이용자 기기(브라우저 저장소)에 계정별로 저장
          </strong>
          됩니다.
        </p>
      </Section>
      <Section title="2. 수집·이용 항목">
        <p>
          회원가입 시 아이디, 비밀번호, 비밀번호 힌트(필수)와 업장명·이름·전화번호
          (선택) 등을 기기에 저장할 수 있습니다. 업무 과정에서 이용자가 직접 입력한
          손님·매물 연락처·주소 등도 동일하게 기기에 보관됩니다.
        </p>
      </Section>
      <Section title="3. 보관 및 관리 책임">
        <p>
          기기 분실, 초기화, 브라우저 데이터 삭제, 타인과의 기기 공유로 인한 유출·
          삭제에 대해 운영자는 책임지지 않습니다. 필요한 경우 이용자가 스스로
          백업·관리해야 합니다.
        </p>
      </Section>
      <Section title="4. 제3자 제공">
        <p>
          운영자가 이용자 업무 데이터를 판매·제공하지 않습니다. 다만 전화·지도·내비
          등 이용자가 선택한 외부 앱으로 연결될 때는 해당 앱의 정책이 적용됩니다.
        </p>
      </Section>
      <Section title="5. 문의">
        <p>
          계정·데이터 관련 문의는 서비스 내 안내 또는 운영 채널을 통해 요청할 수
          있습니다. 기기 내 데이터 삭제는 로그아웃·브라우저 저장소 삭제로 처리할 수
          있습니다.
        </p>
      </Section>
    </>
  );
}

function DisclaimerTerms() {
  return (
    <>
      <p className="text-[12px] font-semibold text-gray-400">시행일 2026. 8. 1.</p>
      <Section title="1. 무보증 제공">
        <p>
          본 서비스는{" "}
          <strong className="font-bold text-gray-800">
            “있는 그대로(AS IS)” 무료 제공
          </strong>
          됩니다. 특정 목적 적합성, 정확성, 무중단, 오류 없음, 데이터 영구 보존을
          보증하지 않습니다.
        </p>
      </Section>
      <Section title="2. 책임의 제한">
        <p>
          법령이 허용하는 최대 범위 내에서, 운영자는 본 서비스 이용과 관련하여
          발생한 직접·간접·특별·결과적 손해(영업 손실, 계약 불이행, 길 안내 오류,
          연락 실패, 데이터 손실·유출, 기대 이익 상실 등)에 대해{" "}
          <strong className="font-bold text-gray-800">책임을 지지 않습니다.</strong>
        </p>
      </Section>
      <Section title="3. 외부 연동">
        <p>
          원클릭 전화, 내비게이션, 지도 등 외부 앱·서비스의 동작·요금·정확도는
          해당 제공자 책임 영역입니다. 현장 이동·계약·안내에 앞서 이용자가 반드시
          재확인해야 합니다.
        </p>
      </Section>
      <Section title="4. 자발적 이용">
        <p>
          본 서비스는 필요한 분만 쓰는 선택적 도구입니다. 이용 여부, 입력 내용,
          업무상 판단의 최종 책임은 이용자에게 있으며, 운영자에게 법적·금전적
          부담을 지우지 않는 조건으로 제공됩니다.
        </p>
      </Section>
      <Section title="5. 준거">
        <p>
          본 안내와 관련한 분쟁은 대한민국 법을 기준으로 하며, 운영자의 고의 또는
          중대한 과실이 입증되는 경우를 제외하고는 위 면책 범위가 적용됩니다.
        </p>
      </Section>
    </>
  );
}
