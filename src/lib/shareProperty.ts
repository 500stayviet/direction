import {
  formatDepositRent,
  formatKoreanAmPmTime,
  formatMoney,
  formatMoveInRange,
  formatPhone,
  isInsuranceJoined,
} from "@/lib/format";
import { skipsResidentialExtras } from "@/lib/constants";
import type { Property, User } from "@/lib/types";

/**
 * 고객 공유용 매물 텍스트.
 * 기본 제외: 호실(옵션으로 포함 가능), 고객정보, 상대부동산·임차인·임대인·고객 전화
 * 포함: 가입자(업장명·이름·전화), 주소·매물 조건, 앱 현장동선
 */
export function buildPropertyShareText(
  properties: Property[],
  agent: Pick<User, "shopName" | "name" | "phone" | "username">,
  options?: {
    excludeNotes?: boolean;
    excludeRoomNo?: boolean;
  }
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

    const typeParts = [
      property.roomType === "건물" && property.buildingKind
        ? `건물 · ${property.buildingKind}`
        : property.roomType,
      property.roomType === "건물" || property.roomType === "토지"
        ? "매매"
        : property.dealType,
    ].filter(Boolean);
    if (typeParts.length) {
      lines.push(`유형: ${typeParts.join(" · ")}`);
    }

    if (
      property.roomType === "투룸" ||
      property.roomType === "3룸+" ||
      property.roomType === "아파트"
    ) {
      const rooms = property.roomType === "투룸" ? 2 : property.roomCount;
      lines.push(
        `방·화장실: 방 ${rooms ?? "-"}개 · 화장실 ${property.bathroomCount ?? 1}개`
      );
    }

    if (property.roomType === "토지") {
      if (property.landArea != null) {
        lines.push(`대지면적: ${property.landArea}평`);
      }
      if (property.landUse?.trim()) {
        lines.push(`용도: ${property.landUse.trim()}`);
      }
    }

    if (property.roomType === "건물") {
      const floorBits = [
        property.floorsBasement != null
          ? `지하 -${property.floorsBasement}`
          : null,
        property.floorsAbove != null ? `지상 ${property.floorsAbove}` : null,
      ].filter(Boolean);
      if (floorBits.length) lines.push(`층수: ${floorBits.join(" · ")}`);
      if (property.landArea != null) lines.push(`토지면적: ${property.landArea}평`);
      if (property.buildingArea != null) {
        lines.push(`건축면적: ${property.buildingArea}평`);
      }
      if (property.unitCounts) {
        const units = (
          [
            ["원룸", property.unitCounts.원룸],
            ["투룸", property.unitCounts.투룸],
            ["3룸+", property.unitCounts["3룸+"]],
            ["상가", property.unitCounts.상가],
          ] as const
        )
          .filter(([, n]) => n > 0)
          .map(([label, n]) => `${label} ${n}`);
        if (units.length) lines.push(`방·상가수: ${units.join(" · ")}`);
      }
      if (property.parkingSpaces != null) {
        lines.push(`주차가능: ${property.parkingSpaces}대`);
      }
    }

    lines.push(
      `금액: ${formatDepositRent(
        property.roomType === "건물" || property.roomType === "토지"
          ? "매매"
          : property.dealType ?? "",
        property.deposit,
        property.monthlyRent
      )}`
    );

    if (property.roomType !== "토지" && property.roomType !== "건물") {
      const maint = formatMoney(property.maintenanceFee);
      const includes =
        !skipsResidentialExtras(property.roomType) &&
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
    } else if (property.roomType === "건물") {
      lines.push(`관리비: ${formatMoney(property.maintenanceFee)}`);
    }
    const showResidential =
      property.roomType !== "토지" &&
      property.roomType !== "건물" &&
      !skipsResidentialExtras(property.roomType);

    if (showResidential) {
      lines.push(`대출: ${property.loanAvailable === "유" ? "유" : "무"}`);
      const insuranceOn = isInsuranceJoined(property.insuranceType);
      lines.push(
        `보증보험: ${
          insuranceOn
            ? property.insuranceType && property.insuranceType !== "유"
              ? property.insuranceType
              : "유"
            : "무"
        }`
      );
    }

    if (property.roomType !== "토지" && property.roomType !== "건물") {
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
    }

    if (property.roomType !== "토지") {
      lines.push(`엘리베이터: ${property.elevator ? "유" : "무"}`);
    }

    if (showResidential) {
      if (property.options?.length) {
        lines.push(`옵션: ${property.options.join(", ")}`);
      }
    }

    if (!excludeNotes && property.notes?.trim()) {
      lines.push(`메모: ${property.notes.trim()}`);
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
  // 저장 시 이미 「부동산」「공인중개사사무소」가 붙을 수 있음 — 중복 추가 금지
  if (shop) {
    const hasLabel =
      shop.includes("부동산") || shop.includes("공인중개사사무소");
    lines.push(hasLabel ? shop : `${shop} 공인중개사사무소`);
  } else {
    lines.push("부동산");
  }
  lines.push(agentName ? `담당 ${agentName}` : "담당");
  lines.push(agentPhone ? agentPhone : "전화번호");
  lines.push("-제공-");
  lines.push("앱 현장동선");

  return lines.join("\n").trim();
}
