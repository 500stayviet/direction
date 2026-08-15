import { expect, test } from "@playwright/test";
import {
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

test("매물 대화 입력: 순차 가이드로 칸을 채운다", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("talk");
  let userId: string | undefined;
  try {
    await prepareIntakeE2ePage(page);
    await signupViaUi(page, user);
    await loginViaUi(page, user);

    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await page.goto("/properties/new");
    await expect(page.getByRole("heading", { name: "매물 등록" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "대화로 입력하기" }).click();
    await expect(page.getByRole("heading", { name: "대화로 입력" })).toBeVisible();
    await page.getByRole("button", { name: "대화 시작" }).click();

    await emitTalkStep(page, "원룸");
    await expect(page.getByTestId("intake-guide-row-roomType")).toContainText(
      "원룸"
    );

    await emitTalkStep(page, "매매");
    await expect(page.getByTestId("intake-guide-row-dealType")).toContainText(
      "매매"
    );

    await emitTalkStep(page, "성내동");
    await expect(page.getByTestId("intake-guide-row-location")).toContainText(
      "성내동"
    );

    await emitTalkStep(page, "1억");
    await expect(page.getByTestId("intake-guide-row-money")).toContainText("1억");

    await skipTalkSteps(page, 4);

    await page.getByTestId("intake-talk-apply").click();
    await expect(page.getByRole("heading", { name: "대화로 입력" })).toBeHidden();

    await expect(
      page.getByRole("button", { name: "원룸", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(
      page.getByRole("button", { name: "매매", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(page.getByLabel("매가 (만원)")).toHaveValue("10000");
    await expect(page.getByText("성내동")).toBeVisible();
  } finally {
    await purgeE2eUser(userId);
  }
});

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
    await page.getByRole("button", { name: "대화로 입력하기" }).click();
    await page.getByRole("button", { name: "대화 시작" }).click();

    await emitTalkStep(page, "원룸");
    await expect(page.getByTestId("intake-guide-row-roomType")).toContainText(
      "원룸"
    );

    await page.getByRole("button", { name: "이전" }).click();
    await emitTalkStep(page, "삭제");
    await expect(page.getByTestId("intake-guide-row-roomType")).not.toContainText(
      "원룸"
    );

    await emitTalkStep(page, "아니 투룸");
    await expect(page.getByTestId("intake-guide-row-roomType")).toContainText(
      "투룸"
    );
  } finally {
    await purgeE2eUser(userId);
  }
});
