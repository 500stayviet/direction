import Link from "next/link";
import { SITE, siteMailtoHref } from "@/lib/constants/site";

type SiteFooterProps = {
  /** 홈 하단처럼 소개·약관 링크 표시 (기본 true) */
  showNavLinks?: boolean;
  className?: string;
};

export function SiteFooter({
  showNavLinks = true,
  className = "",
}: SiteFooterProps) {
  return (
    <footer
      className={[
        "mt-5 space-y-2 px-1 pb-2 text-center text-[12px] text-gray-400",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showNavLinks ? (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link
            href="/about"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            서비스 소개
          </Link>
          <Link
            href="/about#guide"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            사용설명
          </Link>
          <Link
            href="/terms"
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            약관·개인정보·광고
          </Link>
        </div>
      ) : null}

      <p>업무 편의 도구 · 필요한 분만 이용</p>

      <div className="space-y-0.5 leading-relaxed text-[11px] text-gray-400">
        <p>
          {SITE.serviceName} · 상호 {SITE.companyName} · 대표{" "}
          {SITE.representative}
        </p>
        <p>사업자등록번호 {SITE.businessNumber}</p>
        <p>{SITE.address}</p>
        <p>
          문의{" "}
          <a
            href={siteMailtoHref()}
            className="font-semibold text-gray-500 underline-offset-2 hover:text-[#3182F6] hover:underline"
          >
            {SITE.contactEmail}
          </a>
        </p>
      </div>
    </footer>
  );
}
