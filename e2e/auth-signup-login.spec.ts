import { expect, test } from "@playwright/test";
import { loginViaUi, signupViaUi, uniqueUser } from "./helpers";

test("회원가입 → 로그인 → 홈", async ({ page }) => {
  const user = uniqueUser("auth");
  await signupViaUi(page, user);
  await loginViaUi(page, user);
  await expect(page.getByText(`${user.name}님,`)).toBeVisible();
  await expect(page.getByText(/공인중개사사무소/)).toBeVisible();
});
