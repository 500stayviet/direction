/**
 * 사이트 전역 사업자·서비스 정보 (사업자등록증 기준).
 * Footer·약관 등에서 동일 출처로 표시합니다.
 */
export type SiteBusinessInfo = {
  /** 상호 */
  companyName: string;
  /** 대표자 */
  representative: string;
  /** 사업자등록번호 */
  businessNumber: string;
  /** 사업장 주소 */
  address: string;
  /** 고객센터 / 문의 이메일 */
  contactEmail: string;
  /** 서비스명 */
  serviceName: string;
};

export const SITE: SiteBusinessInfo = {
  companyName: "옆나라",
  representative: "백경엽",
  businessNumber: "664-21-02146",
  address: "경상남도 합천군 봉산면 영서로 1385",
  contactEmail: "bek94900@gmail.com",
  serviceName: "현장동선",
} as const;

/** mailto: 링크용 */
export function siteMailtoHref(
  email: string = SITE.contactEmail
): `mailto:${string}` {
  return `mailto:${email}`;
}
