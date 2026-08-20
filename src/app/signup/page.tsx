"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { RequiredFieldWarnModal } from "@/components/RequiredFieldWarnModal";
import { StickyActionBar } from "@/components/StickyActionBar";
import { registerUser } from "@/lib/auth";
import { normalizeUsername } from "@/lib/supabase/email";
import {
  getMissingSignupFields,
  getSignupFieldMessage,
  type SignupFieldKey,
} from "@/lib/signupValidation";

type UsernameCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; username: string; message: string }
  | { status: "taken"; username: string; message: string }
  | { status: "error"; message: string };

/** false면 「이벤트」접기 헤더만 보이고 펼칠 수 없음 (준비 중) */
const SIGNUP_EVENT_SECTION_UNLOCKED = false;

export default function SignupPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [passwordHint, setPasswordHint] = useState("");
  const [eventCode, setEventCode] = useState("");
  /** 이벤트 섹션: 기본 닫힘. 준비 중에는 펼침 잠금 */
  const [eventOpen, setEventOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck>({
    status: "idle",
  });
  const [loading, setLoading] = useState(false);
  const [validationActive, setValidationActive] = useState(false);
  const [focusField, setFocusField] = useState<SignupFieldKey | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMessage, setWarnMessage] = useState("");
  const fieldRefs = useRef<
    Partial<Record<SignupFieldKey, HTMLElement | null>>
  >({});
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFieldRef =
    (key: SignupFieldKey) => (node: HTMLElement | null) => {
      fieldRefs.current[key] = node;
    };

  const signupInput = {
    username,
    password,
    passwordConfirm,
    passwordHint,
    agreed,
  };
  const missingFields = validationActive
    ? getMissingSignupFields(signupInput)
    : [];
  const isInvalid = (key: SignupFieldKey) =>
    missingFields.includes(key) ||
    (key === "username" &&
      (usernameCheck.status === "taken" || usernameCheck.status === "error"));

  useEffect(() => {
    if (!validationActive || !focusField) return;
    fieldRefs.current[focusField]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [validationActive, focusField]);

  useEffect(() => {
    return () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
    };
  }, []);

  const showFieldWarn = (field: SignupFieldKey, message: string) => {
    setValidationActive(true);
    setFocusField(field);
    setWarnMessage(message);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    warnTimer.current = setTimeout(() => setWarnOpen(true), 350);
  };

  const onUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameCheck({ status: "idle" });
  };

  const checkUsername = async (): Promise<boolean> => {
    const normalized = normalizeUsername(username);
    if (!normalized) {
      setUsernameCheck({
        status: "error",
        message: "아이디를 입력해 주세요.",
      });
      return false;
    }
    setUsernameCheck({ status: "checking" });
    try {
      const res = await fetch("/api/auth/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized }),
      });
      const body = (await res.json().catch(() => null)) as {
        available?: boolean;
        username?: string;
        message?: string;
      } | null;
      if (!res.ok || !body) {
        setUsernameCheck({
          status: "error",
          message: body?.message || "아이디 확인에 실패했습니다.",
        });
        return false;
      }
      if (body.available) {
        setUsernameCheck({
          status: "ok",
          username: body.username || normalized,
          message: body.message || "사용 가능한 아이디입니다.",
        });
        return true;
      }
      setUsernameCheck({
        status: "taken",
        username: body.username || normalized,
        message: body.message || "이미 사용 중인 아이디입니다.",
      });
      return false;
    } catch {
      setUsernameCheck({
        status: "error",
        message: "아이디 확인 중 오류가 발생했습니다.",
      });
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const missing = getMissingSignupFields(signupInput);
    if (missing.length > 0) {
      const field = missing[0];
      showFieldWarn(field, getSignupFieldMessage(field, signupInput));
      return;
    }

    const normalized = normalizeUsername(username);
    const dupOk =
      usernameCheck.status === "ok" &&
      usernameCheck.username === normalized;
    if (!dupOk) {
      showFieldWarn(
        "username",
        usernameCheck.status === "taken" || usernameCheck.status === "error"
          ? usernameCheck.message
          : "아이디 중복 확인을 완료해 주세요."
      );
      return;
    }
    setValidationActive(false);
    setWarnOpen(false);

    setLoading(true);
    try {
      const result = await registerUser({
        shopName,
        name,
        username,
        password,
        passwordConfirm,
        phone,
        passwordHint,
        eventCode: SIGNUP_EVENT_SECTION_UNLOCKED
          ? eventCode.trim() || undefined
          : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        if (/이미 사용|사용할 수 없|삭제된 아이디/i.test(result.message)) {
          setUsernameCheck({
            status: "taken",
            username: normalized,
            message: result.message,
          });
        }
        setLoading(false);
        return;
      }
      const params = new URLSearchParams({
        registered: "1",
        username: result.user.username,
      });
      router.replace(`/login?${params.toString()}`);
    } catch {
      setError("회원가입 요청을 처리하지 못했습니다.");
      setLoading(false);
    }
  };

  const checkHint =
    usernameCheck.status === "ok"
      ? usernameCheck.message
      : usernameCheck.status === "taken" || usernameCheck.status === "error"
        ? usernameCheck.message
        : usernameCheck.status === "checking"
          ? "확인 중…"
          : "";

  const passwordConfirmInvalidRight =
    passwordConfirm && password !== passwordConfirm
      ? "비밀번호와 다릅니다"
      : "필수 입력";

  return (
    <main className="py-6">
      <div className="mb-1.5 px-1">
        <p className="text-[13px] font-bold text-[#3182F6]">현장동선</p>
        <h1 className="mt-2 text-[28px] font-bold tracking-tight text-gray-900">
          회원가입
        </h1>
        <div ref={setFieldRef("agreed")} className="mt-2">
          <label
            className={[
              "flex cursor-pointer items-center gap-2.5 py-0.5",
              isInvalid("agreed") ? "rounded-lg bg-red-50 px-2 py-1" : "",
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-gray-300 text-[#3182F6] accent-[#3182F6]"
            />
            <span
              className={[
                "min-w-0 text-[13px] font-medium leading-snug",
                isInvalid("agreed") ? "text-red-600" : "text-gray-600",
              ].join(" ")}
            >
              <Link
                href="/terms"
                className="font-bold text-[#3182F6] underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                이용약관 · 개인정보 · 광고 · 면책 안내
              </Link>
              에 동의합니다.
            </span>
          </label>
        </div>
      </div>

      <form
        id="signup-form"
        noValidate
        onSubmit={handleSubmit}
        className="space-y-3"
      >
        <Card className="space-y-2.5">
          <div ref={setFieldRef("username")} className="space-y-1.5">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  label="아이디"
                  required
                  value={username}
                  onChange={(e) => onUsernameChange(e.target.value)}
                  placeholder="영문·숫자 4자 이상"
                  autoComplete="username"
                  invalid={isInvalid("username")}
                  invalidHighlight="input"
                  invalidLabelRight={
                    missingFields.includes("username") ? "필수 입력" : null
                  }
                  filledVariant="plain"
                  hint=""
                />
              </div>
              <button
                type="button"
                className={[
                  "h-[36px] shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3",
                  "text-[13px] font-semibold text-gray-700 outline-none",
                  "transition-all duration-150 active:scale-95",
                  "hover:border-[#3182F6] hover:bg-white hover:text-[#3182F6]",
                  "disabled:pointer-events-none disabled:opacity-40",
                ].join(" ")}
                disabled={
                  usernameCheck.status === "checking" ||
                  !normalizeUsername(username)
                }
                onClick={() => void checkUsername()}
              >
                {usernameCheck.status === "checking" ? "확인 중" : "중복확인"}
              </button>
            </div>
            {checkHint ? (
              <p
                className={[
                  "px-0.5 text-xs font-semibold",
                  usernameCheck.status === "ok"
                    ? "text-emerald-600"
                    : usernameCheck.status === "taken" ||
                        usernameCheck.status === "error"
                      ? "text-red-500"
                      : "text-gray-400",
                ].join(" ")}
              >
                {checkHint}
              </p>
            ) : null}
          </div>
          <div ref={setFieldRef("password")}>
            <Input
              label="비밀번호"
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              autoComplete="new-password"
              invalid={isInvalid("password")}
              invalidHighlight="input"
              filledVariant="plain"
            />
          </div>
          <div ref={setFieldRef("passwordConfirm")}>
            <Input
              label="비밀번호 확인"
              required
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 다시 입력"
              autoComplete="new-password"
              invalid={isInvalid("passwordConfirm")}
              invalidHighlight="input"
              invalidLabelRight={passwordConfirmInvalidRight}
              filledVariant="plain"
            />
          </div>
          <div ref={setFieldRef("passwordHint")}>
            <Input
              label="비밀번호 힌트"
              required
              value={passwordHint}
              onChange={(e) => setPasswordHint(e.target.value)}
              placeholder="본인만 알아볼 수 있는 힌트"
              invalid={isInvalid("passwordHint")}
              invalidHighlight="input"
              filledVariant="plain"
              labelRight={
                <span className="text-[11px] font-semibold leading-tight">
                  비밀번호 변경에 사용됩니다 타인과 공유금지
                </span>
              }
            />
          </div>
          <Input
            label="업장명 (선택)"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="예: 천호동"
            hint="「부동산」「공인중개사사무소」가 없으면 저장 시 공인중개사사무소가 붙습니다"
            filledVariant="plain"
          />
          <Input
            label="이름 (선택)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            filledVariant="plain"
          />
          <PhoneInput
            label="전화번호 (선택)"
            value={phone}
            onChange={setPhone}
            hint=""
            filledVariant="plain"
          />
          <div className="overflow-hidden rounded-xl border border-dashed border-gray-200 bg-gray-50/80">
            <button
              type="button"
              disabled={!SIGNUP_EVENT_SECTION_UNLOCKED}
              aria-expanded={eventOpen}
              onClick={() => {
                if (!SIGNUP_EVENT_SECTION_UNLOCKED) return;
                setEventOpen((v) => !v);
              }}
              className={[
                "flex w-full items-center justify-between gap-2 px-3 py-3 text-left",
                SIGNUP_EVENT_SECTION_UNLOCKED
                  ? "active:bg-gray-100/80"
                  : "cursor-default opacity-90",
              ].join(" ")}
            >
              <span className="text-[12px] font-bold text-gray-500">
                이벤트
              </span>
              <span className="text-[11px] font-semibold text-gray-400">
                {SIGNUP_EVENT_SECTION_UNLOCKED
                  ? eventOpen
                    ? "접기"
                    : "펼치기"
                  : "준비 중"}
              </span>
            </button>
            {SIGNUP_EVENT_SECTION_UNLOCKED && eventOpen ? (
              <div className="space-y-2 border-t border-dashed border-gray-200 px-3 py-3">
                <Input
                  label="추천인 아이디 · 프로모 코드"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value)}
                  placeholder="추천인 아이디 또는 프로모 코드"
                  hint="둘 중 하나만 입력하면 됩니다"
                  filledVariant="plain"
                />
              </div>
            ) : null}
          </div>
        </Card>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
      </form>

      <StickyActionBar>
        <Button
          type="submit"
          form="signup-form"
          fullWidth
          size="lg"
          disabled={loading}
        >
          {loading ? "가입 중..." : "가입하고 시작하기"}
        </Button>
      </StickyActionBar>

      <RequiredFieldWarnModal
        open={warnOpen}
        message={warnMessage}
        onClose={() => setWarnOpen(false)}
      />
    </main>
  );
}
