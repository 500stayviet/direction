import { expect, test } from "@playwright/test";
import {
  getAppAuth,
  loginViaUi,
  prepareAppPage,
  purgeE2eUser,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test("고객등록: 거래종류 접기·매물유형 모달·3룸+ 방/화장실 라벨", async ({
  page,
}) => {
  const user = uniqueUser("choice");
  let userId: string | undefined;
  try {
    await signupViaUi(page, user);
    await loginViaUi(page, user);
    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await prepareAppPage(page);
    await page.goto("/customers/new");
    await expect(page.getByRole("button", { name: "매물유형선택" })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole("button", { name: "매매", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "전세", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "월세", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "매매", exact: true }).click();
    await expect(
      page.getByText('거래종류 변경희망 시 "매매"를 다시 누르세요')
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "전세", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "월세", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "매매", exact: true }).click();
    await expect(page.getByRole("button", { name: "전세", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "월세", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "매물유형선택" }).click();
    await expect(page.getByRole("heading", { name: "매물 유형 선택" })).toBeVisible();
    await page.getByRole("button", { name: "3룸+", exact: true }).click();
    await expect(page.getByRole("heading", { name: "매물 유형 선택" })).toBeVisible();
    await expect(
      page.getByTestId("room-count-options").getByRole("button", { name: "1개" })
    ).toHaveCount(0);
    await expect(
      page.getByTestId("room-count-options").getByRole("button", { name: "3개" })
    ).toBeVisible();
    await expect(
      page.getByTestId("room-count-options").getByRole("button", { name: "8개" })
    ).toBeVisible();
    await expect(
      page.getByTestId("bathroom-count-options").getByRole("button", { name: "8개" })
    ).toBeVisible();
    await page
      .getByTestId("room-count-options")
      .getByRole("button", { name: "4개" })
      .click();
    await page.getByRole("button", { name: "선택완료" }).click();
    await expect(
      page.getByText('매물유형 변경희망 시 "3룸+"을 다시 누르세요')
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "원룸", exact: true })).toHaveCount(0);
    await expect(
      page.getByTestId("room-count-options").getByRole("button", { name: "4개" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "4개", exact: true })).toBeVisible();
    await expect(page.getByText("선택구")).toHaveCount(0);
    await expect(page.getByText("선택동")).toHaveCount(0);

    await page.getByRole("button", { name: "3룸+", exact: true }).click();
    await expect(page.getByRole("heading", { name: "매물 유형 선택" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "매물 유형 선택" })).toBeHidden();
    await expect(page.getByRole("button", { name: "3룸+", exact: true })).toBeVisible();
  } finally {
    await purgeE2eUser(userId);
  }
});

test("매물등록: 거래종류 다시 누르면 세 개가 다시 보인다", async ({ page }) => {
  const user = uniqueUser("pchoice");
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

    await page.getByRole("button", { name: "전세", exact: true }).click();
    await expect(
      page.getByText('거래종류 변경희망 시 "전세"를 다시 누르세요')
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "매매", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "전세", exact: true }).click();
    await expect(page.getByRole("button", { name: "매매", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "월세", exact: true })).toBeVisible();

    await expect(page.getByTestId("property-address-select")).toHaveText(
      "매물주소선택"
    );
    await page.getByTestId("property-address-select").click();
    await expect(page.getByRole("heading", { name: "구 선택" })).toBeVisible();
    await page.getByRole("button", { name: "강동구", exact: true }).click();
    await expect(page.getByRole("heading", { name: /동 선택/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "선택완료" })).toHaveCount(0);
    await page.getByRole("button", { name: "성내동", exact: true }).click();
    await expect(page.getByRole("heading", { name: /동 선택/ })).toBeHidden();
    await expect(page.getByTestId("property-address-chip")).toHaveText(
      /강동구\s*·\s*성내동/
    );
    await expect(
      page.getByText('매물주소 변경희망 시 "강동구 · 성내동"을 다시 누르세요')
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "삭제" })).toHaveCount(0);
  } finally {
    await purgeE2eUser(userId);
  }
});
