import { expect, test } from "@playwright/test";
import {
  enableScheduleGuestMode,
  fillMinimalResidentialProperty,
  fillVisitScheduleMeta,
} from "./formHelpers";
import {
  getAppAuth,
  loginViaUi,
  prepareAppPage,
  purgeE2eUser,
  requireE2eBackendEnv,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test("방문 일정 만들기: 고객없음·매물 1개·팀공유 없음·생성 후 상세", async ({
  page,
}) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("sch");
  const guestName = "E2E게스트";
  let userId: string | undefined;

  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);
    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await prepareAppPage(page);
    await page.goto("/schedules/new");
    await expect(
      page.getByRole("heading", { name: "방문 일정 만들기" })
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByRole("button", { name: "매물유형선택" })).toHaveCount(
      1
    );
    await expect(page.getByRole("button", { name: "팀 공유하기" })).toHaveCount(
      0
    );

    await enableScheduleGuestMode(page, guestName);
    await fillVisitScheduleMeta(page);
    await fillMinimalResidentialProperty(page);

    await page.getByRole("button", { name: "방문일정 생성하기" }).click();
    await expect(page).toHaveURL(/\/schedules\/[^/?#]+$/, { timeout: 30_000 });
    await expect(page.getByText(guestName)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "네비게이션 시작" })
    ).toBeVisible();
    await expect(page.getByText("주소를 누르면 네비게이션으로 이동")).toBeVisible();
    await expect(page.getByText("전화번호를 누르면 전화로 이동")).toBeVisible();
  } finally {
    await purgeE2eUser(userId);
  }
});

test("방문 일정 만들기: + 매물 추가로 두 번째 매물", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("sch2");
  let userId: string | undefined;

  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);
    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await prepareAppPage(page);
    await page.goto("/schedules/new");
    await expect(
      page.getByRole("button", { name: "매물유형선택" })
    ).toHaveCount(1);

    await page.getByRole("button", { name: "+ 매물 추가" }).click();
    await expect(page.getByRole("button", { name: "매물유형선택" })).toHaveCount(
      2
    );
  } finally {
    await purgeE2eUser(userId);
  }
});
