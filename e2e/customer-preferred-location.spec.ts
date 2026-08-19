import { expect, test } from "@playwright/test";
import {
  getAppAuth,
  insertCustomer,
  loginViaUi,
  prepareAppPage,
  purgeE2eUser,
  signupViaUi,
  uniqueUser,
} from "./helpers";

async function assertPreferredOnDetail(page: import("@playwright/test").Page) {
  const preferred = page.getByTestId("customer-brief-preferred");
  await expect(preferred).toBeVisible();
  await expect(preferred).toContainText("선호지역");
  await expect(preferred).toContainText("강동구");
  await expect(preferred).toContainText("성내동");

  const meta = page.getByTestId("customer-brief-meta");
  await expect(page.getByTestId("customer-brief-amount")).toBeVisible();
  await expect(page.getByTestId("customer-brief-movein")).toBeVisible();

  const order = await meta.evaluate((el) =>
    Array.from(el.children).map((child) =>
      (child as HTMLElement).dataset.testid ?? ""
    )
  );
  const amountIdx = order.indexOf("customer-brief-amount");
  const preferredIdx = order.indexOf("customer-brief-preferred");
  const moveInIdx = order.indexOf("customer-brief-movein");
  expect(amountIdx).toBeGreaterThanOrEqual(0);
  expect(preferredIdx).toBeGreaterThan(amountIdx);
  expect(moveInIdx).toBeGreaterThan(preferredIdx);
}

async function assertPreferredOnCard(
  page: import("@playwright/test").Page,
  cardHint: string
) {
  await page.goto("/customers");
  const preferred = page
    .getByRole("article")
    .filter({ hasText: cardHint })
    .getByTestId("customer-card-preferred");
  await expect(preferred).toBeVisible({ timeout: 30_000 });
  await expect(preferred).toHaveText(/선호지역:\s*강동구\s*·\s*성내동/);
}

test("원룸 고객: 강동구·성내동이 상세·리스트 카드에 표시", async ({ page }) => {
  const user = uniqueUser("pref");
  let userId: string | undefined;
  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);

    const auth = await getAppAuth(page);
    if (!auth?.user?.id) throw new Error("no user id");
    userId = auth.user.id;

    const name = `원룸선호${user.username}`;
    const { id } = await insertCustomer({
      ownerUserId: auth.user.id,
      name,
      roomType: "원룸",
      preferredGus: ["강동구"],
      preferredDongs: ["강동구|성내동"],
    });

    await prepareAppPage(page);
    await page.goto(`/customers/${id}`);
    await expect(page.getByText(name)).toBeVisible({ timeout: 30_000 });
    await assertPreferredOnDetail(page);
    await assertPreferredOnCard(page, "010-9999-8877");
  } finally {
    await purgeE2eUser(userId);
  }
});
