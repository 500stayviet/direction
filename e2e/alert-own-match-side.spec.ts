import { expect, test } from "@playwright/test";
import {
  expectListBadge,
  expectNoListBadge,
  getAppAuth,
  insertOwnMatchingPair,
  loginViaUi,
  requireE2eBackendEnv,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test.beforeEach(({ page: _page }, testInfo) => {
  requireE2eBackendEnv(testInfo);
});

test("own 매칭 — 나중 등록한 고객 쪽에만 매칭 뱃지", async ({ page }) => {
  const user = uniqueUser("ownm");
  await signupViaUi(page, user);
  await loginViaUi(page, user);

  const auth = await getAppAuth(page);
  if (!auth?.user?.id) throw new Error("auth missing");

  const { customerId } = await insertOwnMatchingPair({
    userId: auth.user.id,
    propertyCreatedAt: "2026-01-01T00:00:00.000Z",
    customerCreatedAt: "2026-01-02T00:00:00.000Z",
  });

  await page.goto("/customers");
  await expect(page.getByText("매칭고객")).toBeVisible({ timeout: 25_000 });
  await expectListBadge(page, "매칭");

  await page.goto("/properties");
  await expectNoListBadge(page, "매칭");

  await page.goto(`/customers/${customerId}`);
  await expect(page.getByText("조건에 맞는 매물")).toBeVisible({
    timeout: 25_000,
  });
});
