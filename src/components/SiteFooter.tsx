import Link from "next/link";
import type { ReactNode } from "react";
import { SITE, siteMailtoHref } from "@/lib/constants/site";

type SiteFooterProps = {
  /** 홈 하단처럼 소개·약관 링크 표시 (기본 true) */
  showNavLinks?: boolean;
  className?: string;
};

const NAV_LINKS = [
  { href: "/about", label: "서비스 소개" },
  { href: "/about#guide", label: "사용설명" },
  { href: "/terms", label: "이용약관" },
  { href: "/terms?tab=privacy", label: "개인정보처리방침" },
] as const;

function FooterMetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-1.5">
      <dt className="w-[5.25rem] shrink-0 text-gray-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-gray-500">{children}</dd>
    </div>
  );
}

export function SiteFooter({
  showNavLinks = true,
  className = "",
}: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={["mt-5 border-t border-gray-200/80 pt-3.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      {showNavLinks ? (
        <nav
          aria-label="사이트 안내"
          className="flex flex-wrap items-center gap-x-0 gap-y-1 text-[12px] font-medium text-gray-600"
        >
          {NAV_LINKS.map((item, i) => (
            <span key={item.href} className="inline-flex items-center">
              {i > 0 ? (
                <span
                  className="mx-1.5 h-2.5 w-px bg-gray-200"
                  aria-hidden
                />
              ) : null}
              <Link
                href={item.href}
                className="transition-colors hover:text-gray-900"
              >
                {item.label}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}

      <div
        className={[showNavLinks ? "mt-2.5" : "", "space-y-1.5"]
          .filter(Boolean)
          .join(" ")}
      >
        <p className="text-[13px] font-semibold tracking-tight text-gray-800">
          {SITE.serviceName}
        </p>

        <dl className="space-y-0.5 text-[11px] leading-snug">
          <FooterMetaRow label="상호">{SITE.companyName}</FooterMetaRow>
          <FooterMetaRow label="대표">{SITE.representative}</FooterMetaRow>
          <FooterMetaRow label="사업자등록번호">
            {SITE.businessNumber}
          </FooterMetaRow>
          <FooterMetaRow label="주소">{SITE.address}</FooterMetaRow>
          <FooterMetaRow label="고객문의">
            <a
              href={siteMailtoHref()}
              className="underline-offset-2 transition-colors hover:text-gray-800 hover:underline"
            >
              {SITE.contactEmail}
            </a>
          </FooterMetaRow>
        </dl>

        <p className="pt-0.5 text-[10px] leading-snug text-gray-400">
          © {year} {SITE.companyName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
