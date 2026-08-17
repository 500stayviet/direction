import { validateUsernameFormat } from "@/lib/supabase/email";

/**
 * 회원가입 필수 칸.
 * 항목이 늘면 SignupFieldKey · SIGNUP_FIELD_ORDER · getMissingSignupFields ·
 * 페이지의 해당 입력칸에 ref={setFieldRef("새키")} 만 추가하면
 * 스크롤·붉은 테두리·모달이 그대로 따라갑니다.
 */
export type SignupFieldKey =
  | "username"
  | "password"
  | "passwordConfirm"
  | "passwordHint"
  | "agreed";

export type SignupValidationInput = {
  username: string;
  password: string;
  passwordConfirm: string;
  passwordHint: string;
  agreed: boolean;
};

/** 화면 위→아래 순서. 스크롤 대상은 이 배열의 첫 빠진 칸 */
export const SIGNUP_FIELD_ORDER: SignupFieldKey[] = [
  "agreed",
  "username",
  "password",
  "passwordConfirm",
  "passwordHint",
];

const MESSAGES: Record<SignupFieldKey, (input: SignupValidationInput) => string> =
  {
    username: (input) => {
      const id = validateUsernameFormat(input.username);
      return id.ok ? "아이디 칸 입력은 필수입니다." : id.message;
    },
    password: (input) =>
      input.password && input.password.length < 6
        ? "비밀번호는 6자 이상이어야 합니다."
        : "비밀번호 칸 입력은 필수입니다.",
    passwordConfirm: (input) =>
      input.passwordConfirm && input.password !== input.passwordConfirm
        ? "비밀번호 확인이 일치하지 않습니다."
        : "비밀번호 확인 칸 입력은 필수입니다.",
    passwordHint: () => "비밀번호 힌트 칸 입력은 필수입니다.",
    agreed: () => "약관 동의는 필수입니다.",
  };

export function getMissingSignupFields(
  input: SignupValidationInput
): SignupFieldKey[] {
  const missing: SignupFieldKey[] = [];
  const id = validateUsernameFormat(input.username);
  if (!id.ok) missing.push("username");
  if (!input.password || input.password.length < 6) missing.push("password");
  if (!input.passwordConfirm || input.password !== input.passwordConfirm) {
    missing.push("passwordConfirm");
  }
  if (!input.passwordHint.trim()) missing.push("passwordHint");
  if (!input.agreed) missing.push("agreed");
  return SIGNUP_FIELD_ORDER.filter((key) => missing.includes(key));
}

export function getSignupFieldMessage(
  field: SignupFieldKey,
  input: SignupValidationInput
): string {
  return MESSAGES[field](input);
}
