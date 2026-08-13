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
  await expect(preferred).toContainText("선호위치");
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
  customerName: string
) {
  await page.goto("/customers");
  await expect(page.getByText(customerName, { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const preferred = page.getByTestId("customer-card-preferred");
  await expect(preferred).toBeVisible();
  await expect(preferred).toHaveText(/강동구\s*·\s*성내동/);
  await expect(preferred).not.toContainText("선호");
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
    await assertPreferredOnCard(page, name);
  } finally {
    await purgeE2eUser(userId);
  }
});

test("고객등록 UI: 구·동 선택완료 후 상세·카드에 선호위치 표시", async ({
  page,
}) => {
  const user = uniqueUser("prefu");
  let userId: string | undefined;
  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);

    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    const name = `등록선호${user.username}`;
    await prepareAppPage(page);
    await page.goto("/customers/new");
    await expect(page.getByText("선호위치")).toBeVisible({ timeout: 30_000 });

    await page.getByPlaceholder("홍길동").fill(name);
    await page.getByPlaceholder("010-1234-5678").fill("01011112222");

    // 구 박스에만 강동구 — 하단 결과에는 없음
    await expect(page.getByRole("button", { name: "강동구" })).toBeVisible();
    await expect(page.getByText("선택동")).toBeVisible();

    await page.getByRole("button", { name: "선택동" }).click();
    await expect(page.getByRole("heading", { name: /동 선택/ })).toBeVisible();
    await page.getByRole("button", { name: "성내동", exact: true }).click();
    await page.getByRole("button", { name: "선택완료" }).click();
    await expect(page.getByText(/성내동/)).toBeVisible();

    // 보증금·월세 (단일 기본)
    const depositBox = page.locator('input[type="number"]').nth(0);
    await depositBox.fill("1000");
    const rentBox = page.locator('input[type="number"]').nth(1);
    await rentBox.fill("50");

    // 입주 단일
    const moveInSection = page
      .locator("div")
      .filter({ hasText: "희망 입주일" })
      .last();
    await moveInSection.locator('label:has-text("단일")').click();
    await page.getByRole("button", { name: "입주 날짜 선택" }).click();
    await expect(page.getByRole("heading", { name: "날짜 선택" })).toBeVisible();
    const enabledDay = page
      .locator("button:not([disabled])")
      .filter({ hasText: /^\d{1,2}$/ })
      .last();
    await enabledDay.click();
    await page.getByRole("button", { name: "선택하기" }).click();

    await page.getByRole("button", { name: "고객등록하기" }).click();
    await expect(page.getByText("등록이 완료되었습니다")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/customers\/.+/, { timeout: 30_000 });

    await assertPreferredOnDetail(page);
    await assertPreferredOnCard(page, name);
  } finally {
    await purgeE2eUser(userId);
  }
});
