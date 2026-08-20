import { expect, test, type Page } from "@playwright/test";
import {
  createTeamWorkspace,
  fillMinimalResidentialProperty,
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

test("매물등록: 팀 없으면 팀공유 모달 없이 저장", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("prop");
  let userId: string | undefined;

  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);
    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await prepareAppPage(page);
    await page.goto("/properties/new");
    await expect(page.getByRole("heading", { name: "매물 등록" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "팀 공유하기" })).toHaveCount(
      0
    );

    await fillMinimalResidentialProperty(page);
    await page.getByRole("button", { name: "매물등록하기" }).click();

    await expect(
      page.getByRole("heading", { name: "팀 공유 하시겠습니까?" })
    ).toHaveCount(0);
    await expect(page.getByText("등록이 완료되었습니다")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/properties/, { timeout: 10_000 });
  } finally {
    await purgeE2eUser(userId);
  }
});

test("매물등록: 팀 있으면 팀공유 모달 → 거절·동의", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("pteam");
  let userId: string | undefined;

  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);
    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await createTeamWorkspace(page);

    await prepareAppPage(page);
    await page.goto("/properties/new");
    await fillMinimalResidentialProperty(page, {
      index: 0,
    });
    await page.getByRole("button", { name: "매물등록하기" }).click();

    await expect(
      page.getByRole("heading", { name: "팀 공유 하시겠습니까?" })
    ).toBeVisible();
    await page.getByRole("button", { name: "거절" }).click();
    await expect(page.getByText("등록이 완료되었습니다")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/properties/, { timeout: 10_000 });

    await page.goto("/properties/new");
    await fillMinimalResidentialProperty(page, {
      index: 0,
    });
    await pickDifferentAddress(page);
    await page.getByRole("button", { name: "매물등록하기" }).click();
    await expect(
      page.getByRole("heading", { name: "팀 공유 하시겠습니까?" })
    ).toBeVisible();
    await page.getByRole("button", { name: "동의" }).click();
    await expect(page.getByText("등록이 완료되었습니다")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/properties/, { timeout: 10_000 });
  } finally {
    await purgeE2eUser(userId);
  }
});

async function pickDifferentAddress(page: Page) {
  await page.getByTestId("property-address-chip").click();
  await page.getByRole("button", { name: "강동구", exact: true }).click();
  await page.getByRole("button", { name: "천호동", exact: true }).click();
  await page.getByLabel("본번").fill("456");
}
