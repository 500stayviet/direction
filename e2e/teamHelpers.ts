import { expect, type Browser } from "@playwright/test";
import {
  fetchWorkspaceId,
  loginViaUi,
  signupViaUi,
  uniqueUser,
} from "./helpers";

/** 소유자·멤버 가입 후 공유 코드로 팀 합류 */
export async function createTeamPair(browser: Browser) {
  const owner = uniqueUser("own");
  const member = uniqueUser("mem");
  const ownerCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const memberPage = await memberCtx.newPage();

  await signupViaUi(ownerPage, owner);
  await signupViaUi(memberPage, member);
  await loginViaUi(ownerPage, owner);
  await loginViaUi(memberPage, member);

  await ownerPage.goto("/account");
  await ownerPage.getByRole("button", { name: "공유 코드 생성" }).click();
  await ownerPage.getByRole("button", { name: "동의하고 생성" }).click();
  await expect(ownerPage.getByText("공유 코드 (동료에게 전달)")).toBeVisible({
    timeout: 20_000,
  });
  const ws = await fetchWorkspaceId(ownerPage);

  await memberPage.goto("/account");
  await memberPage.getByPlaceholder("동료에게 받은 코드").fill(ws.shareCode);
  await memberPage.getByRole("button", { name: "참여" }).click();
  await expect(memberPage.getByText(/팀 공유에 참여했습니다/)).toBeVisible({
    timeout: 20_000,
  });

  return { owner, member, ownerCtx, memberCtx, ownerPage, memberPage, ws };
}
