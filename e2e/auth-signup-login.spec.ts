import { expect, test } from "@playwright/test";
import {
  fillLoginForm,
  loginViaUi,
  prepareAppPage,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test("회원가입 → 로그인 → 홈", async ({ page }) => {
  const user = uniqueUser("auth");
  await signupViaUi(page, user);
  await loginViaUi(page, user);
  await expect(
    page.getByRole("heading", { name: new RegExp(`${user.name}님`) })
  ).toBeVisible();
  await expect(page.getByText(/공인중개사사무소/)).toBeVisible();
});

test("로그인 후 기능 소개 모달 · 닫기/일주일간 보지 않기", async ({ page }) => {
  const user = uniqueUser("intro");
  await signupViaUi(page, user);
  await prepareAppPage(page);
  await page.goto("/login");
  await expect(page.getByPlaceholder("아이디를 입력하세요")).toBeVisible({
    timeout: 30_000,
  });
  await fillLoginForm(page, user);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/(\?|$)/);

  const introHeading = page.getByRole("heading", {
    name: "이런 기능을 쓸 수 있어요",
  });
  await expect(introHeading).toBeVisible({ timeout: 10_000 });

  await page.locator("button").filter({ hasText: /^닫기$/ }).click();
  await expect(introHeading).toBeHidden({ timeout: 5_000 });

  await page.locator("nav a[href='/customers']").click();
  await expect(page).toHaveURL(/\/customers/);
  await page.getByRole("link", { name: "홈", exact: true }).click();
  await expect(introHeading).toBeVisible({ timeout: 10_000 });

  await page
    .locator("button")
    .filter({ hasText: /^일주일간 보지 않기$/ })
    .click();
  await expect(introHeading).toBeHidden({ timeout: 5_000 });

  await page.goto("/customers");
  await page.goto("/");
  await expect(introHeading).toBeHidden({ timeout: 3_000 });
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
  await page.getByRole("button", { name: "확인", exact: true }).click();
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
