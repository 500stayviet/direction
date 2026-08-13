import { expect, test } from "@playwright/test";
import {
  fillLoginForm,
  prepareAppPage,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test("로그인 실패", async ({ page }) => {
  const user = uniqueUser("fail");
  await signupViaUi(page, user);
  await prepareAppPage(page);
  await page.goto("/login");
  await fillLoginForm(page, {
    username: user.username,
    password: "wrong-password",
  });
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByText(/아이디 또는 비밀번호가 올바르지 않습니다/)
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
