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

    await page.getByRole("button", { name: "마이크로 입력하기" }).click();
    await allowDeviceConsentIfShown(page);
    await expect(page.getByRole("heading", { name: "대화로 입력" })).toBeVisible();
    await page.getByRole("button", { name: "대화 시작" }).click();
    await expect(page.getByTestId("intake-talk-primary")).toHaveText("정지");

    await emitTalkStep(page, "성내동");
    await expect(page.getByTestId("intake-guide-row-location")).toContainText(
      "성내동"
    );

    await emitTalkStep(page, "원룸");
    await expect(page.getByTestId("intake-guide-row-roomType")).toContainText(
      "원룸"
    );

    await emitTalkStep(page, "매매");
    await expect(page.getByTestId("intake-guide-row-dealType")).toContainText(
      "매매"
    );

    await emitTalkStep(page, "1억");
    await expect(page.getByTestId("intake-guide-row-money")).toContainText("1억");

    await skipTalkSteps(page, 6);

    await page.getByTestId("intake-talk-apply").click();
    await expect(page.getByRole("heading", { name: "대화로 입력" })).toBeHidden();

    await expect(
      page.getByRole("button", { name: "원룸", exact: true })
    ).toHaveClass(/border-green-400/);
    await expect(page.getByTestId("option-거래종류")).toHaveClass(
      /border-green-400/
    );
    await expect(
      page.getByRole("button", { name: "매매", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: /매매가/ })).toHaveValue(
      "10000"
    );
    await expect(page.getByTestId("property-address-chip")).toHaveText(
      /성내동/
    );
  } finally {
    await purgeE2eUser(userId);
  }
});

test("매물 대화 입력: 한글 지번을 넣고 본번·부번이면 나머지 주소로 바로 간다", async ({
  page,
}) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("talkjibun");
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

    await emitTalkStep(page, "성내동 백오십일");
    await expect(page.getByTestId("intake-guide-row-location")).toContainText(
      "151"
    );
    await expect(
      page.getByTestId("intake-guide-row-location").getByRole("button")
    ).toHaveAttribute("aria-current", "step");

    await emitTalkStep(page, "삭제");
    await emitTalkStep(page, "성내동 일월 십일");
    await expect(page.getByTestId("intake-guide-row-location")).toContainText(
      "111"
    );
    await emitTalkStep(page, "삭제");
    await emitTalkStep(page, "성내동 일일일다시일");
    await expect(page.getByTestId("intake-guide-row-location")).toContainText(
      "111-1"
    );
    await expect(
      page.getByTestId("intake-guide-row-restAddress").getByRole("button")
    ).toHaveAttribute("aria-current", "step");

    await page.getByTestId("intake-guide-row-location").click();
    await expect(page.getByTestId("intake-talk-primary")).toHaveText("정지");
    await emitTalkStep(page, "성내동 일일일 다시 일");
    await expect(page.getByTestId("intake-guide-row-location")).toContainText(
      "111-1"
    );
    await expect(
      page.getByTestId("intake-guide-row-restAddress").getByRole("button")
    ).toHaveAttribute("aria-current", "step");
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

test("매물 대화 입력: 메모는 입력완료에서 초록이 된다", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("talknote");
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
    await skipTalkSteps(page, 10);

    await expect(page.getByTestId("intake-talk-primary")).toHaveText("입력완료");
    await emitTalkStep(page, "남향 저층");
    const notesRow = page.getByTestId("intake-guide-row-notes");
    await expect(notesRow).toContainText("남향 저층");
    await expect(notesRow.locator(".border-green-400")).toHaveCount(0);

    await page.getByRole("button", { name: "입력완료" }).click();
    await page.getByTestId("intake-talk-ended-confirm").click();
    await expect(notesRow.locator(".border-green-400")).toHaveCount(1);
    await expect(notesRow).toContainText("남향 저층");

    await page.getByTestId("intake-talk-apply").click();
    await expect(page.getByRole("heading", { name: "대화로 입력" })).toBeHidden();
    await expect(page.getByLabel("메모").first()).toHaveValue("남향 저층");
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

test("매물 대화 입력: 가이드 행을 누르면 그 칸을 비우고 바로 듣는다", async ({
  page,
}) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("talkrow");
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
    await emitTalkStep(page, "매매");
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(1);
    await expect(
      page.getByTestId("intake-guide-row-dealType").locator(".border-green-400")
    ).toHaveCount(1);

    await page.getByTestId("intake-guide-row-roomType").click();
    await expect(
      page.getByTestId("intake-guide-row-roomType").getByRole("button")
    ).toHaveAttribute("aria-current", "step");
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(0);
    await expect(
      page.getByTestId("intake-guide-row-dealType").locator(".border-green-400")
    ).toHaveCount(1);
    await expect(page.getByTestId("intake-talk-primary")).toHaveText("정지");

    await emitTalkStep(page, "투룸");
    await expect(
      page.getByTestId("intake-guide-row-roomType").locator(".border-green-400")
    ).toHaveCount(1);
    await expect(page.getByTestId("intake-guide-row-roomType")).toContainText(
      /투룸|2룸/
    );
    await expect(
      page.getByTestId("intake-guide-row-dealType").locator(".border-green-400")
    ).toHaveCount(1);
  } finally {
    await purgeE2eUser(userId);
  }
});
