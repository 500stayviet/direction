import { expect, test } from "@playwright/test";
import {
  getAppAuth,
  loginViaUi,
  prepareAppPage,
  purgeE2eUser,
  requireE2eBackendEnv,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test("매물 메시지 입력: 가격·날짜·유/무를 칸에 넣고 메모 찌꺼기를 줄인다", async ({
  page,
}) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("msg");
  let userId: string | undefined;
  try {
    await prepareAppPage(page);
    await signupViaUi(page, user);
    await loginViaUi(page, user);

    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await page.goto("/properties/new");
    await expect(page.getByRole("heading", { name: "매물 등록" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "메시지로 입력하기" }).click();
    await expect(page.getByRole("heading", { name: "메시지로 입력" })).toBeVisible();

    const message = [
      "원룸 매매 성내동",
      "매매가 1억",
      "8월 25일부터 9월 15일",
      "대출 무 보증보험 무 주차 무 엘베 무",
    ].join("\n");

    await page.getByLabel("메시지", { exact: true }).fill(message);
    await page.getByRole("button", { name: "반영하기" }).click();
    await expect(page.getByRole("heading", { name: "메시지로 입력" })).toBeHidden({
      timeout: 15_000,
    });

    await expect(
      page.getByRole("button", { name: "원룸", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(
      page.getByRole("button", { name: "매매", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(page.getByRole("button", { name: /매매가/ })).toHaveText("1억");
    await expect(page.getByTestId("property-address-chip")).toHaveText(
      /성내동/
    );

    await expect(
      page.getByTestId("option-대출").getByRole("button", { name: "무", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(
      page
        .getByTestId("option-전세보증보험가입가능여부")
        .getByRole("button", { name: "무", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(
      page.getByTestId("option-주차").getByRole("button", { name: "무", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(
      page.getByTestId("option-엘리베이터").getByRole("button", { name: "무", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
  } finally {
    await purgeE2eUser(userId);
  }
});

test("매물 메시지 입력: 라벨·의도 키워드만 메모에 넣고 주황 박스를 표시한다", async ({
  page,
}) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("msgmemo");
  let userId: string | undefined;
  try {
    await prepareAppPage(page);
    await signupViaUi(page, user);
    await loginViaUi(page, user);

    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await page.goto("/properties/new");
    await page.getByRole("button", { name: "메시지로 입력하기" }).click();
    await page
      .getByLabel("메시지", { exact: true })
      .fill("원룸 전세 2억 암사동 메모: 남향 저층");
    await page.getByRole("button", { name: "반영하기" }).click();

    await expect(page.getByLabel("메모")).toHaveValue(/남향 저층/, {
      timeout: 15_000,
    });
    await expect(page.getByLabel("메모").locator("..").locator("..")).toHaveClass(
      /border-amber-300/
    );
  } finally {
    await purgeE2eUser(userId);
  }
});

test("매물 메시지 입력: 의도 키워드만 메모에 넣는다", async ({ page }) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("msgintent");
  let userId: string | undefined;
  try {
    await prepareAppPage(page);
    await signupViaUi(page, user);
    await loginViaUi(page, user);

    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await page.goto("/properties/new");
    await page.getByRole("button", { name: "메시지로 입력하기" }).click();
    await page
      .getByLabel("메시지", { exact: true })
      .fill("원룸 전세 2억 암사동 남향");
    await page.getByRole("button", { name: "반영하기" }).click();

    await expect(page.getByLabel("메모")).toHaveValue("남향", {
      timeout: 15_000,
    });
    await expect(page.getByLabel("메모").locator("..").locator("..")).toHaveClass(
      /border-amber-300/
    );
  } finally {
    await purgeE2eUser(userId);
  }
});
