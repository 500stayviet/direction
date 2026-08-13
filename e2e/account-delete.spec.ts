import { expect, test } from "@playwright/test";
import {
  fillLoginForm,
  loginViaUi,
  prepareAppPage,
  signupViaUi,
  uniqueUser,
} from "./helpers";

const DELETE_PHRASE = "계정삭제에 동의합니다";

test("회원탈퇴 후 재로그인·재가입 불가", async ({ page }) => {
  const user = uniqueUser("del");
  await signupViaUi(page, user);
  await loginViaUi(page, user);

  await page.goto("/account");
  await page.getByRole("button", { name: "회원탈퇴" }).click();
  await page.getByPlaceholder(DELETE_PHRASE).fill(DELETE_PHRASE);
  await page.getByRole("button", { name: "탈퇴하기" }).click();
  await expect(page).toHaveURL(/\/(\?|$)|\/login/, { timeout: 25_000 });
  await expect(
    page
      .getByRole("link", { name: "로그인" })
      .or(page.getByRole("heading", { name: "로그인" }))
  ).toBeVisible({ timeout: 20_000 });

  await prepareAppPage(page);
  await page.goto("/login");
  await fillLoginForm(page, user);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByText(/아이디 또는 비밀번호가 올바르지 않습니다/)
  ).toBeVisible();

  await prepareAppPage(page);
  await page.goto("/signup");
  await page.getByPlaceholder("영문·숫자 4자 이상").fill(user.username);
  await page.getByRole("button", { name: "중복확인" }).click();
  await expect(page.getByText(/사용할 수 없|이미 사용|삭제/)).toBeVisible({
    timeout: 15_000,
  });
});
