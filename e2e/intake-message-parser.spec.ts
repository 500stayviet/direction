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
      page.getByTestId("option-거래종류").getByRole("button", { name: "매매", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(
      page.getByRole("button", { name: "매매", exact: true })
    ).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: /매매가/ })).toHaveValue(
      "10000"
    );
    await expect(page.getByTestId("property-address-chip")).toHaveText(
      /성내동/
    );

    await expect(
      page.getByTestId("option-대출").getByRole("button", { name: "불가", exact: true })
    ).toHaveClass(/bg-\[#3182F6\]/);
    await expect(
      page.getByTestId("option-전세보증보험가입가능여부")
    ).toHaveCount(0);
    await expect(
      page.getByTestId("option-주차").getByRole("button", { name: "불가", exact: true })
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
  } finally {
    await purgeE2eUser(userId);
  }
});

test("고객등록 양식 메시지: 채운 칸만 반영하고 예시·푸터 전화는 무시한다", async ({
  page,
}) => {
  requireE2eBackendEnv(test);
  const user = uniqueUser("cform");
  let userId: string | undefined;
  try {
    await prepareAppPage(page);
    await signupViaUi(page, user);
    await loginViaUi(page, user);
    const auth = await getAppAuth(page);
    userId = auth?.user?.id;

    await page.goto("/customers/new");
    await expect(page.getByRole("heading", { name: "고객 등록" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: "메시지로 입력하기" }).click();
    await expect(page.getByText("/600")).toBeVisible();

    const message = [
      "고객등록 양식",
      "",
      "고객명 (예: 홍길동)",
      ": 이몽룡",
      "",
      "고객 전화번호 (예: 010-1234-5678)",
      ": 010-5555-6666",
      "",
      "거래종류 (예: 매매, 전세, 월세)",
      ": 월세",
      "",
      "매물 유형 (예: 아파트, 원룸, 투룸, 3룸+)",
      ": 원룸",
      "",
      "거래가액 (예: 보증금 1000 / 월세 50, 또는 매매 5억)",
      ": 보증금 1000 / 월세 50",
      "",
      "선호지역 (예: 강동구 성내동, 암사동 등)",
      ": 강동구 성내동",
      "",
      "추가 희망사항 (예: 희망층)",
      ": 저층",
      "",
      "────────────",
      "봄날 공인중개사사무소",
      "담당 하지영",
      "010-1111-1111",
      "-제공-",
      "앱 현장동선",
    ].join("\n");

    await page.getByLabel("메시지", { exact: true }).fill(message);
    await page.getByRole("button", { name: "반영하기" }).click();
    await expect(page.getByRole("heading", { name: "메시지로 입력" })).toBeHidden({
      timeout: 15_000,
    });

    await expect(page.getByLabel(/고객명 또는 명칭/)).toHaveValue(/이몽룡/, {
      timeout: 20_000,
    });
    await expect(page.getByLabel(/고객 전화번호/)).toHaveValue(/010-5555-6666/);
    await expect(page.getByLabel(/고객 전화번호/)).not.toHaveValue(
      /010-1111-1111/
    );
    await expect(page.getByRole("button", { name: "원룸", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "월세", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /강동구\s*·\s*성내동/ })).toBeVisible();
    await expect(page.getByLabel("메모")).toHaveValue(/저층/);
  } finally {
    await purgeE2eUser(userId);
  }
});
