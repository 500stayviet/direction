import { expect, test } from "@playwright/test";
import {
  allowDeviceConsentIfShown,
  emitTalkStep,
  getAppAuth,
  loginViaUi,
  prepareIntakeE2ePage,
  purgeE2eUser,
  requireE2eBackendEnv,
  signupViaUi,
  skipTalkSteps,
  uniqueUser,
} from "./helpers";

test("매물 대화 입력: 아니/삭제로 현재 항목을 지운다", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("talkdel");
  let userId: string | undefined;
  try {
    await prepareIntakeE2ePage(page);
    await signupViaUi(page, user);
    await loginViaUi(page, user);

    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await page.goto("/properties/new");
    await page.getByRole("button", { name: "마이크로 입력하기" }).click();
    await allowDeviceConsentIfShown(page);
    await page.getByRole("button", { name: "대화 시작" }).click();
    await expect(page.getByTestId("intake-talk-primary")).toHaveText("정지");

    await page.getByTestId("intake-talk-primary").click();
    await expect(page.getByTestId("intake-talk-primary")).toHaveAttribute(
      "aria-label",
      "녹화"
    );
    await expect(page.getByRole("button", { name: "계속" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "대화 시작" })).toHaveCount(0);
    await page.getByTestId("intake-talk-primary").click();

    await skipTalkSteps(page, 1);
    await emitTalkStep(page, "원룸");
    await expect(page.getByTestId("intake-guide-row-roomType")).toContainText(
      "원룸"
    );

    await page.getByRole("button", { name: "이전" }).click();
    await expect(page.getByTestId("intake-talk-primary")).toHaveText("정지");
    await emitTalkStep(page, "삭제");
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(0);

    await emitTalkStep(page, "아니 투룸");
    await expect(page.getByTestId("intake-guide-row-roomType")).toContainText(
      /투룸|2룸/
    );
  } finally {
    await purgeE2eUser(userId);
  }
});

test("매물 대화 입력: 정지하면 안내가 뜨고 이전 후 녹화하면 그 칸을 다시 받는다", async ({
  page,
}) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("talkstop");
  let userId: string | undefined;
  try {
    await prepareIntakeE2ePage(page);
    await signupViaUi(page, user);
    await loginViaUi(page, user);

    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await page.goto("/properties/new");
    await page.getByRole("button", { name: "마이크로 입력하기" }).click();
    await allowDeviceConsentIfShown(page);
    await page.getByRole("button", { name: "대화 시작" }).click();

    await skipTalkSteps(page, 1);
    await emitTalkStep(page, "원룸");
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(1);

    await page.getByTestId("intake-talk-primary").click();
    await expect(
      page.getByText("녹화버튼을 눌러 대화를 이어가세요.")
    ).toBeVisible();
    await expect(page.getByTestId("intake-talk-primary")).toHaveAttribute(
      "aria-label",
      "녹화"
    );
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(1);

    await page.getByRole("button", { name: "이전" }).click();
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(1);

    await page.getByTestId("intake-talk-primary").click();
    await expect(page.getByTestId("intake-talk-primary")).toHaveText("정지");
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(0);

    await emitTalkStep(page, "투룸");
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(1);
    await expect(page.getByTestId("intake-guide-row-roomType")).toContainText(
      /투룸|2룸/
    );
  } finally {
    await purgeE2eUser(userId);
  }
});
