import { expect, test } from "@playwright/test";
import {
  getAppAuth,
  insertCustomer,
  insertSchedule,
  loginViaUi,
  prepareAppPage,
  purgeE2eUser,
  requireE2eBackendEnv,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test("방문 일정 상세: 네비게이션 시작 안내 모달", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("nav");
  let userId: string | undefined;

  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);
    const auth = await getAppAuth(page);
    userId = auth?.user?.id;
    if (!userId) throw new Error("missing user id");

    const schedule = await insertSchedule({
      ownerUserId: userId,
      guestName: "E2E네비게스트",
    });

    await prepareAppPage(page);
    await page.goto(`/schedules/${schedule.id}`);
    await expect(
      page.getByRole("button", { name: "네비게이션 시작" })
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "네비게이션 시작" }).click();
    await expect(page.getByText("1번 매물입니다.")).toBeVisible();
    await expect(page.getByText("원터치 네비게이션으로 이동하세요")).toBeVisible();
    await page.getByText("닫기", { exact: true }).click();
    await expect(page.getByText("1번 매물입니다.")).toBeHidden();
  } finally {
    await purgeE2eUser(userId);
  }
});

test("현장 리드: 고객 전화번호 없으면 전화번호 미입력", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("navp");
  let userId: string | undefined;

  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);
    const auth = await getAppAuth(page);
    userId = auth?.user?.id;
    if (!userId) throw new Error("missing user id");

    const customer = await insertCustomer({
      ownerUserId: userId,
      name: "전화없는고객",
      phone: "",
    });
    const schedule = await insertSchedule({
      ownerUserId: userId,
      customerId: customer.id,
    });

    await prepareAppPage(page);
    await page.goto(`/navi/${schedule.id}`);
    await expect(page.getByText("현장 고객")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("전화없는고객", { exact: true })).toBeVisible();
    await expect(page.getByText("전화번호 미입력")).toBeVisible();
    await expect(page.getByText("고객", { exact: true })).toBeVisible();
  } finally {
    await purgeE2eUser(userId);
  }
});
