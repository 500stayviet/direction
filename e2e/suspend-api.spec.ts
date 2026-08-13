import { expect, test } from "@playwright/test";
import {
  adminLogin,
  adminSetSuspended,
  findAccountIdByUsername,
  loginViaUi,
  logoutViaHome,
  signupViaUi,
  uniqueUser,
} from "./helpers";

test("관리자 API 정지 → 홈 외 차단 → 해제 후 복귀", async ({
  page,
  request,
}) => {
  const user = uniqueUser("sus");
  await signupViaUi(page, user);
  await loginViaUi(page, user);

  const token = await adminLogin(request);
  const accountId = await findAccountIdByUsername(
    request,
    token,
    user.username
  );
  await adminSetSuspended(request, token, accountId, true, "e2e 허위등록");

  await page.goto("/customers");
  await expect(page.getByText("계정 이용 제한")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText(/현재 계정이 정지되어 홈 외 기능을 이용할 수 없습니다/)
  ).toBeVisible();
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page).toHaveURL(/\/(\?|$)/);

  await adminSetSuspended(request, token, accountId, false);

  await logoutViaHome(page);
  await loginViaUi(page, user);
  await page.goto("/customers");
  await expect(page.getByText("계정 이용 제한")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "고객리스트" })).toBeVisible({
    timeout: 20_000,
  });
});
