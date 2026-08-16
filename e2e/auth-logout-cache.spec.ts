import { expect, test } from "@playwright/test";
import { loginViaUi, logoutViaHome, signupViaUi, uniqueUser } from "./helpers";

test("로그아웃 후 다른 계정 로그인 시 이전 유저 잔여 없음", async ({ page }) => {
  const a = uniqueUser("cachea");
  const b = uniqueUser("cacheb");
  await signupViaUi(page, a);
  await signupViaUi(page, b);

  await loginViaUi(page, a);
  await expect(page.getByRole("heading", { name: `${a.name}님,` })).toBeVisible();
  await logoutViaHome(page);

  await loginViaUi(page, b);
  await expect(page.getByRole("heading", { name: `${b.name}님,` })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${a.name}님,` })).toHaveCount(0);
  await expect(page.getByText(a.username)).toHaveCount(0);
});
