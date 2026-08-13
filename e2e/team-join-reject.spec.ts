import { expect, test } from "@playwright/test";
import { loginViaUi, signupViaUi, uniqueUser } from "./helpers";

test("잘못된 공유 코드는 합류 거절", async ({ page }) => {
  const user = uniqueUser("bad");
  await signupViaUi(page, user);
  await loginViaUi(page, user);
  await page.goto("/account");
  await page.getByPlaceholder("동료에게 받은 코드").fill("ZZZZZZ");
  await page.getByRole("button", { name: "참여" }).click();
  await expect(page.getByText("유효하지 않은 공유 코드입니다.")).toBeVisible({
    timeout: 15_000,
  });
});
