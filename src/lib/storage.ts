"use client";

import type {
  Customer,
  ListedProperty,
  NaviApp,
  NaviPreference,
  Schedule,
} from "./types";
import { getSessionUserId } from "./auth";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function userPrefix(): string | null {
  const id = getSessionUserId();
  return id ? `realty_u_${id}` : null;
}

/** 현재 로그인 계정 전용 키. 비로그인·세션 없으면 null (읽기 빈값 / 쓰기 무시) */
function key(suffix: string): string | null {
  const prefix = userPrefix();
  if (!prefix) return null;
  return `${prefix}_${suffix}`;
}

function read<T>(storageKey: string | null, fallback: T): T {
  if (!canUseStorage() || !storageKey) return fallback;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(storageKey: string | null, value: T): void {
  // 세션 없으면 절대 쓰지 않음 — 계정 간 섞임 방지
  if (!canUseStorage() || !storageKey || !getSessionUserId()) return;
  localStorage.setItem(storageKey, JSON.stringify(value));
}

function remove(storageKey: string | null): void {
  if (!canUseStorage() || !storageKey || !getSessionUserId()) return;
  localStorage.removeItem(storageKey);
}

export function getCustomers(): Customer[] {
  return read<Customer[]>(key("customers"), []);
}

export function saveCustomers(customers: Customer[]): void {
  write(key("customers"), customers);
}

export function upsertCustomer(customer: Customer): Customer[] {
  const list = getCustomers();
  const idx = list.findIndex((c) => c.id === customer.id);
  if (idx >= 0) list[idx] = customer;
  else list.unshift(customer);
  saveCustomers(list);
  return list;
}

export function getCustomerById(id: string): Customer | undefined {
  return getCustomers().find((c) => c.id === id);
}

export function getListedProperties(): ListedProperty[] {
  return read<ListedProperty[]>(key("properties"), []);
}

export function saveListedProperties(properties: ListedProperty[]): void {
  write(key("properties"), properties);
}

export function upsertListedProperty(property: ListedProperty): ListedProperty[] {
  const list = getListedProperties();
  const idx = list.findIndex((p) => p.id === property.id);
  if (idx >= 0) list[idx] = property;
  else list.unshift(property);
  saveListedProperties(list);
  return list;
}

export function getListedPropertyById(id: string): ListedProperty | undefined {
  return getListedProperties().find((p) => p.id === id);
}

export function getSchedules(): Schedule[] {
  return read<Schedule[]>(key("schedules"), []);
}

export function saveSchedules(schedules: Schedule[]): void {
  write(key("schedules"), schedules);
}

export function upsertSchedule(schedule: Schedule): Schedule[] {
  const list = getSchedules();
  const idx = list.findIndex((s) => s.id === schedule.id);
  if (idx >= 0) list[idx] = schedule;
  else list.unshift(schedule);
  saveSchedules(list);
  return list;
}

export function getScheduleById(id: string): Schedule | undefined {
  return getSchedules().find((s) => s.id === id);
}

export function getSchedulesByCustomer(customerId: string): Schedule[] {
  return getSchedules().filter((s) => s.customerId === customerId);
}

export function getNaviPreference(): NaviPreference | null {
  return read<NaviPreference | null>(key("navi"), null);
}

export function setNaviPreference(app: NaviApp, remember: boolean): void {
  if (remember) write(key("navi"), { app, remember: true });
  else remove(key("navi"));
}

export function clearNaviPreference(): void {
  remove(key("navi"));
}

export function touchRecentCustomer(customerId: string): void {
  const ids = read<string[]>(key("recent"), []).filter((id) => id !== customerId);
  ids.unshift(customerId);
  write(key("recent"), ids.slice(0, 20));
}

export function getRecentCustomers(): Customer[] {
  const ids = read<string[]>(key("recent"), []);
  const map = new Map(getCustomers().map((c) => [c.id, c]));
  const recent = ids.map((id) => map.get(id)).filter(Boolean) as Customer[];
  if (recent.length > 0) return recent;
  return getCustomers().slice(0, 10);
}
