import {
  formatDepositRent,
  formatKoreanAmPmTime,
  formatMoney,
  formatMoveInRange,
  formatPhone,
} from "@/lib/format";
import type { Property, User } from "@/lib/types";

/**
 * 손님 공유용 매물 텍스트.
 * 기본 제외: 호실(옵션으로 포함 가능), 손님정보, 상대부동산·임차인·임대인·손님 전화
 * 포함: 가입자(업장명·이름·전화), 주소·매물 조건, 앱 현장동선
 */
export function buildPropertyShareText(
  properties: Property[],
  agent: Pick<User, "shopName" | "name" | "phone" | "username">,
  options?: { excludeNotes?: boolean; excludeRoomNo?: boolean }
): string {
  const excludeNotes = Boolean(options?.excludeNotes);
  const excludeRoomNo = options?.excludeRoomNo !== false;
  const lines: string[] = [];
  lines.push("매물 안내");
  lines.push("");

  properties.forEach((property, index) => {
    lines.push(`■ ${index + 1}번 매물`);
    lines.push(`주소: ${property.address?.trim() || "-"}`);
    if (!excludeRoomNo && property.roomNo?.trim()) {
      lines.push(`호실: ${property.roomNo.trim()}`);
    }

    if (property.arriveTime) {
      lines.push(`방문 약속: ${formatKoreanAmPmTime(property.arriveTime)}`);
    }

    const typeParts = [property.roomType, property.dealType].filter(Boolean);
    if (typeParts.length) {
      lines.push(`유형: ${typeParts.join(" · ")}`);
    }

    lines.push(
      `금액: ${formatDepositRent(
        property.dealType,
        property.deposit,
        property.monthlyRent
      )}`
    );

    const maint = formatMoney(property.maintenanceFee);
    const includes =
      property.maintenanceIncludes?.length > 0
        ? ` (${property.maintenanceIncludes.join(", ")})`
        : "";
    lines.push(`관리비: ${maint}${includes}`);

    const moveIn = formatMoveInRange(
      property.moveInFrom,
      property.moveInTo,
      property.moveInDate
    );
    lines.push(`입주 가능: ${moveIn || "-"}`);

    lines.push(`엘리베이터: ${property.elevator ? "유" : "무"}`);

    const insuranceOn =
      property.insuranceType === "유" ||
      Boolean(
        property.insuranceType &&
          property.insuranceType !== "무" &&
          property.insuranceType !== "미가입"
      );
    lines.push(
      `보증보험: ${
        insuranceOn
          ? property.insuranceType && property.insuranceType !== "유"
            ? property.insuranceType
            : "유"
          : "무"
      }`
    );

    if (property.parkingType === "유") {
      const parkingBits = ["유"];
      if (property.parkingFeeType === "포함") parkingBits.push("포함");
      else if (property.parkingFeeType === "별도") parkingBits.push("별도");
      if (property.parkingFee != null && property.parkingFee > 0) {
        parkingBits.push(formatMoney(property.parkingFee));
      }
      lines.push(`주차: ${parkingBits.join(" · ")}`);
    } else {
      lines.push("주차: 무");
    }

    lines.push(`애완동물: ${property.petAllowed ?? "무"}`);

    if (property.options?.length) {
      lines.push(`옵션: ${property.options.join(", ")}`);
    }

    if (!excludeNotes && property.notes?.trim()) {
      lines.push(`추가내용: ${property.notes.trim()}`);
    }

    lines.push("");
  });

  // 기본값 "현장동선"은 미입력으로 취급
  const rawShop = (agent.shopName || "").trim();
  const shop =
    !rawShop || rawShop === "현장동선" ? "" : rawShop;
  const agentName = (agent.name || "").trim();
  const agentPhone =
    formatPhone(agent.phone || "") || (agent.phone || "").trim();

  lines.push("─".repeat(12));
  // 값 있으면 값 표시, 가입 시 미입력이면 라벨만
  if (shop) {
    lines.push(shop.endsWith("부동산") ? shop : `${shop} 부동산`);
  } else {
    lines.push("부동산");
  }
  lines.push(agentName ? `담당 ${agentName}` : "담당");
  lines.push(agentPhone ? agentPhone : "전화번호");
  lines.push("-제공-");
  lines.push("앱 현장동선");

  return lines.join("\n").trim();
}
