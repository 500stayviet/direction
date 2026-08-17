import { expect, test } from "@playwright/test";
import { loginViaUi, prepareAppPage, signupViaUi, uniqueUser } from "./helpers";

test("회원가입 → 로그인 → 홈", async ({ page }) => {
  const user = uniqueUser("auth");
  await signupViaUi(page, user);
  await loginViaUi(page, user);
  await expect(page.getByText(`${user.name}님,`)).toBeVisible();
  await expect(page.getByText(/공인중개사사무소/)).toBeVisible();
});

test("회원가입 약관 미동의 시 안내 모달", async ({ page }) => {
  await prepareAppPage(page);
  await page.goto("/signup");
  await expect(page.getByPlaceholder("영문·숫자 4자 이상")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page.getByText("약관 동의는 필수입니다.")).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "확인" }).click();
});

test("회원가입 필수칸 미입력 시 라벨 옆 필수 입력", async ({ page }) => {
  await prepareAppPage(page);
  await page.goto("/signup");
  await expect(page.getByPlaceholder("영문·숫자 4자 이상")).toBeVisible({
    timeout: 30_000,
  });
  await page
    .locator('label:has-text("동의합니다") input[type="checkbox"]')
    .check();
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page.getByText("필수 입력").first()).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByText("미입력")).toHaveCount(0);
});
