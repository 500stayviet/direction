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

async function pickPreferredGangdongSeongnae(
  page: import("@playwright/test").Page
) {
  await page.getByTestId("preferred-region-label").click();
  await expect(page.getByRole("heading", { name: "구 선택" })).toBeVisible();
  await page.getByRole("button", { name: "강동구", exact: true }).click();
  await expect(page.getByRole("heading", { name: /동 선택/ })).toBeVisible();
  await page.getByRole("button", { name: "성내동", exact: true }).click();
  await page.getByRole("button", { name: "선택완료" }).click();
  await expect(page.getByText(/성내동/)).toBeVisible();
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

test("고객등록 UI: 구·동 선택완료 후 상세·카드에 선호지역 표시", async ({
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
    await expect(page.getByTestId("preferred-region-label")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("선택구")).toHaveCount(0);
    await expect(page.getByText("선택동")).toHaveCount(0);

    await page.getByPlaceholder("홍길동").fill(name);
    await page.getByPlaceholder("010-1234-5678").fill("01011112222");

    await page.getByRole("button", { name: "매물유형선택" }).click();
    await expect(page.getByRole("heading", { name: "매물 유형 선택" })).toBeVisible();
    await page.getByRole("button", { name: "원룸", exact: true }).click();

    await page.getByRole("button", { name: "월세", exact: true }).click();

    await pickPreferredGangdongSeongnae(page);
    await expect(page.getByTestId("preferred-region-add")).toBeVisible();

    await page.locator('input[type="number"]').first().fill("1000");
    await page.getByPlaceholder("50").fill("50");

    const moveInSection = page
      .locator("div")
      .filter({ hasText: "입주희망일" })
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

    await page
      .getByTestId("option-대출")
      .getByRole("button", { name: "무", exact: true })
      .click();
    await page
      .getByTestId("option-전세보증보험가입가능여부")
      .getByRole("button", { name: "무", exact: true })
      .click();
    await page
      .getByTestId("option-주차")
      .getByRole("button", { name: "무", exact: true })
      .click();

    await page.getByRole("button", { name: "고객등록하기" }).click();
    await expect(page.getByText("등록이 완료되었습니다")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/customers\/?$/, { timeout: 30_000 });

    await assertPreferredOnCard(page, "010-1111-2222");
    await page
      .getByRole("article")
      .filter({ hasText: "010-1111-2222" })
      .getByTestId("customer-card-preferred")
      .click();
    await expect(page).toHaveURL(/\/customers\/.+/);
    await assertPreferredOnDetail(page);
  } finally {
    await purgeE2eUser(userId);
  }
});
