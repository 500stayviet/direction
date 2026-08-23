import { isForeignTeamItem } from "@/lib/teamActionGuard";
import type { Customer, ListedProperty } from "@/lib/types";

/** 팀원 비공유(site) 풀 — 사이트내 공유 매칭용. 타인 항목만 redaction 대상 */
export function isSitePoolEntity(
  entity: { createdBy?: string; workspaceShared?: boolean },
  viewerUserId: string | null | undefined
): boolean {
  if (!viewerUserId) return false;
  if (!isForeignTeamItem(entity.createdBy, viewerUserId)) return false;
  return !entity.workspaceShared;
}

/** 사이트내 매칭용 — 당사자·연락처·메모 제거, 조건·등록 부동산 스냅샷만 유지 */
export function redactCustomerForSiteMatch(customer: Customer): Customer {
  return {
    ...customer,
    name: "",
    phone: "",
    notes: "",
    createdByName: undefined,
  };
}

/** 사이트내 매칭용 — 임차인·임대인·협력·비밀번호·메모 제거 */
export function redactPropertyForSiteMatch(
  property: ListedProperty
): ListedProperty {
  return {
    ...property,
    tenantPhone: undefined,
    landlordPhone: undefined,
    hasPartnerAgency: false,
    partnerAgency: { name: "", phone: "", dong: "" },
    notes: undefined,
    floorPassword: undefined,
    roomPassword: undefined,
    password: undefined,
    createdByName: undefined,
  };
}

export function applyMatchPoolRedaction(input: {
  customers: Customer[];
  properties: ListedProperty[];
  viewerUserId: string;
}): { customers: Customer[]; properties: ListedProperty[] } {
  return {
    customers: input.customers.map((c) =>
      isSitePoolEntity(c, input.viewerUserId)
        ? redactCustomerForSiteMatch(c)
        : c
    ),
    properties: input.properties.map((p) =>
      isSitePoolEntity(p, input.viewerUserId)
        ? redactPropertyForSiteMatch(p)
        : p
    ),
  };
}

/** API·e2e 검증 — redacted JSON에 금지 필드가 비어 있는지 */
export function assertSitePoolPayloadClean(
  entity: Customer | ListedProperty,
  kind: "customer" | "property"
): string[] {
  const issues: string[] = [];
  if (kind === "customer") {
    const c = entity as Customer;
    if (c.name?.trim()) issues.push("name");
    if (c.phone?.trim()) issues.push("phone");
    if (c.notes?.trim()) issues.push("notes");
    if (c.createdByName?.trim()) issues.push("createdByName");
  } else {
    const p = entity as ListedProperty;
    if (p.tenantPhone?.trim()) issues.push("tenantPhone");
    if (p.landlordPhone?.trim()) issues.push("landlordPhone");
    if (p.partnerAgency?.name?.trim()) issues.push("partnerAgency.name");
    if (p.partnerAgency?.phone?.trim()) issues.push("partnerAgency.phone");
    if (p.notes?.trim()) issues.push("notes");
    if (p.floorPassword?.trim()) issues.push("floorPassword");
    if (p.roomPassword?.trim()) issues.push("roomPassword");
    if (p.password?.trim()) issues.push("password");
    if (p.createdByName?.trim()) issues.push("createdByName");
  }
  return issues;
}
