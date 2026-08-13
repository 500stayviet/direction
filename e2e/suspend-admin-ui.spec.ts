import { expect, test } from "@playwright/test";
import {
  loginViaUi,
  logoutViaHome,
  prepareAppPage,
  requireEnv,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test("관리자 화면에서 정지 → 앱 차단 → 정지 해제", async ({ page }) => {
  const user = uniqueUser("sus");
  await signupViaUi(page, user);
  await loginViaUi(page, user);
  await logoutViaHome(page);

  const adminId = requireEnv("ADMIN_ID");
  const adminPw = requireEnv("ADMIN_PASSWORD");

  const adminLogin = async () => {
    await prepareAppPage(page);
    try {
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
    } catch (err) {
      if (!String(err).includes("ERR_ABORTED")) throw err;
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
    }
    await page
      .locator("label")
      .filter({ hasText: "관리자 아이디" })
      .locator("input")
      .fill(adminId);
    await page
      .locator("label")
      .filter({ hasText: /^비밀번호/ })
      .locator("input")
      .fill(adminPw);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page.getByRole("button", { name: "가입자" })).toBeVisible({
      timeout: 20_000,
    });
  };

  const openUser = async () => {
    await page.getByPlaceholder("아이디·이름·상호·전화").fill(user.username);
    await page.getByRole("button", { name: "검색" }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(user.username) })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: new RegExp(user.username) }).click();
    await expect(
      page.getByRole("button", { name: /계정 정지|정지 해제/ })
    ).toBeVisible({ timeout: 15_000 });
  };

  await adminLogin();
  await openUser();
  await page.getByRole("button", { name: "계정 정지" }).click();
  await page.getByRole("button", { name: "정지하기" }).click();
  await expect(page.getByRole("button", { name: "정지 해제" })).toBeVisible({
    timeout: 15_000,
  });

  await prepareAppPage(page);
  await loginViaUi(page, user);
  await page.goto("/customers");
  await expect(page.getByText("계정 이용 제한")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "확인" }).click();
  await logoutViaHome(page);

  await adminLogin();
  await openUser();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "정지 해제" }).click();
  await expect(page.getByRole("button", { name: "계정 정지" })).toBeVisible({
    timeout: 15_000,
  });

  await prepareAppPage(page);
  await loginViaUi(page, user);
  await page.goto("/customers");
  await expect(page.getByText("계정 이용 제한")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "고객리스트" })).toBeVisible();
});
