import { onlyDigits } from "@/lib/format";
import type { Customer, ListedProperty } from "@/lib/types";

/** 전화번호가 내 고객 목록에 이미 있는지 (자기 자신 제외) */
export function findCustomerBySamePhone(
  phone: string,
  customers: Customer[],
  excludeId?: string
): Customer | undefined {
  const digits = onlyDigits(phone);
  if (digits.length < 9) return undefined;
  return customers.find(
    (c) =>
      c.id !== excludeId &&
      onlyDigits(c.phone) === digits &&
      onlyDigits(c.phone).length >= 9
  );
}

function normAddress(address: string): string {
  return address.trim().replace(/\s+/g, " ").toLowerCase();
}

function normRoomNo(roomNo: string): string {
  return roomNo.trim().replace(/\s+/g, " ").toLowerCase();
}

/** 주소+호실이 내 매물 목록에 이미 있는지 (자기 자신 제외) */
export function findPropertyBySameAddressRoom(
  address: string,
  roomNo: string,
  properties: ListedProperty[],
  excludeId?: string
): ListedProperty | undefined {
  const addr = normAddress(address);
  if (!addr) return undefined;
  const room = normRoomNo(roomNo);
  return properties.find(
    (p) =>
      p.id !== excludeId &&
      normAddress(p.address) === addr &&
      normRoomNo(p.roomNo ?? "") === room
  );
}
