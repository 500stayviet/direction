import { expect, test } from "@playwright/test";
import {
  expectListBadge,
  expectNoListBadge,
  getAppAuth,
  insertOwnMatchingPair,
  listCardAddress,
  loginViaUi,
  requireE2eBackendEnv,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test.beforeEach(({ page: _page }, testInfo) => {
  requireE2eBackendEnv(testInfo);
});

test("매칭 뱃지는 미리보기 열람 시에만 해제", async ({ page }) => {
  const user = uniqueUser("mdis");
  await signupViaUi(page, user);
  await loginViaUi(page, user);

  const auth = await getAppAuth(page);
  if (!auth?.user?.id) throw new Error("auth missing");

  const { customerId, address } = await insertOwnMatchingPair({
    userId: auth.user.id,
    propertyCreatedAt: "2026-01-01T00:00:00.000Z",
    customerCreatedAt: "2026-01-02T00:00:00.000Z",
  });
  const cardAddr = listCardAddress(address);

  await page.goto("/customers");
  await expectListBadge(page, "매칭");

  await page.goto(`/customers/${customerId}`);
  await expect(page.getByText("조건에 맞는 매물")).toBeVisible({
    timeout: 25_000,
  });
  await page.goto("/customers");
  await expectListBadge(page, "매칭");

  await page.goto(`/customers/${customerId}`);
  await page.getByText(cardAddr).click();
  await expect(page.getByRole("heading", { name: "매물 상세" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: "닫기", exact: true }).first().click();

  await page.goto("/customers");
  await expectNoListBadge(page, "매칭");
});
