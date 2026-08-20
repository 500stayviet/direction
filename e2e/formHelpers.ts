import { expect, type Locator, type Page } from "@playwright/test";

async function propertyBlock(page: Page, index = 0): Promise<Locator> {
  const scheduleForm = page.locator("#schedule-create-form");
  if ((await scheduleForm.count()) > 0) {
    return scheduleForm
      .locator(":scope > div.space-y-4 > div.space-y-1\\.5")
      .nth(index);
  }
  return page.locator("#property-create-form");
}

export async function pickPropertyAddress(
  page: Page,
  opts: {
    gu?: string;
    dong?: string;
    main?: string;
    scope?: Locator;
  } = {}
) {
  const gu = opts.gu ?? "강동구";
  const dong = opts.dong ?? "성내동";
  const main = opts.main ?? "123";
  const scope = opts.scope ?? page;

  await scope.getByTestId("property-address-select").click();
  await expect(page.getByRole("heading", { name: "구 선택" })).toBeVisible();
  await page.getByRole("button", { name: gu, exact: true }).click();
  await page.getByRole("button", { name: dong, exact: true }).click();
  await scope.getByLabel("본번").fill(main);
}

export async function fillMinimalResidentialProperty(
  page: Page,
  opts: { index?: number; dealType?: "전세" | "월세" } = {}
) {
  const index = opts.index ?? 0;
  const dealType = opts.dealType ?? "전세";
  const block = await propertyBlock(page, index);

  await block.getByPlaceholder("예) 010-1234-5678").first().fill("01011112222");

  await block.getByRole("button", { name: "매물유형선택" }).click();
  await expect(page.getByRole("heading", { name: "매물 유형 선택" })).toBeVisible();
  await page.getByRole("button", { name: "원룸", exact: true }).click();

  await block.getByRole("button", { name: dealType, exact: true }).click();
  await block.getByLabel("보증금").fill("1000");
  await block.getByLabel("보증금").blur();

  await pickPropertyAddress(page, { scope: block });

  await block.locator("label").filter({ hasText: "협의가능" }).click();

  await block
    .getByTestId("option-대출")
    .getByRole("button", { name: "불가" })
    .click();
  if (dealType === "전세") {
    await block
      .getByTestId("option-전세보증보험가입가능여부")
      .getByRole("button", { name: "불가" })
      .click();
  }
  await block
    .getByTestId("option-주차")
    .getByRole("button", { name: "불가" })
    .click();
  await block
    .getByTestId("option-엘리베이터")
    .getByRole("button", { name: "무" })
    .click();
}

export async function fillVisitScheduleMeta(page: Page) {
  await page.getByRole("button", { name: "년월일 선택" }).click();
  await expect(page.getByRole("heading", { name: "고객방문일" })).toBeVisible();
  await page
    .locator(".grid.grid-cols-7.gap-y-1 button:not([disabled])")
    .first()
    .click();
  await page.getByRole("button", { name: "선택하기" }).click();

  await page.getByRole("button", { name: "시간을 선택하세요" }).click();
  await page.getByRole("button", { name: "선택하기" }).click();
}

export async function enableScheduleGuestMode(page: Page, guestName: string) {
  await page.locator("label").filter({ hasText: "고객없음" }).click();
  await page.getByLabel("고객명 또는 명칭").fill(guestName);
}

export async function createTeamWorkspace(page: Page) {
  await page.goto("/account");
  await page.getByRole("button", { name: "공유 코드 생성" }).click();
  await page.getByRole("button", { name: "동의하고 생성" }).click();
  await expect(page.getByRole("heading", { name: "팀이름" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "나중에" }).click();
  await expect(page.getByText("공유 코드 (동료에게 전달)")).toBeVisible({
    timeout: 20_000,
  });
}
