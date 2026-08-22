import { expect, test } from "@playwright/test";
import {
  expectListBadge,
  expectNoListBadge,
  getAppAuth,
  insertSharedProperty,
  listCardAddress,
  loginViaUi,
  requireE2eBackendEnv,
} from "./helpers";
import { createTeamPair } from "./teamHelpers";

test.beforeEach(({ page: _page }, testInfo) => {
  requireE2eBackendEnv(testInfo);
});

test("같은 계정 다른 탭 — 팀공유 확인이 실시간 반영", async ({ browser }) => {
  const pair = await createTeamPair(browser);
  const ownerAuth = await getAppAuth(pair.ownerPage);
  if (!ownerAuth?.user?.id) throw new Error("owner auth missing");

  const secondCtx = await browser.newContext();
  const secondPage = await secondCtx.newPage();
  await loginViaUi(secondPage, pair.member);

  await pair.memberPage.goto("/properties");
  await secondPage.goto("/properties");
  await expect(pair.memberPage.getByText(/등록 \d+건/)).toBeVisible({
    timeout: 25_000,
  });
  await expect(secondPage.getByText(/등록 \d+건/)).toBeVisible({
    timeout: 25_000,
  });

  const prop = await insertSharedProperty({
    ownerUserId: ownerAuth.user.id,
    workspaceId: pair.ws.workspaceId,
    marker: `E2E동기화-${Date.now()}`,
    shared: true,
  });
  const cardAddr = listCardAddress(prop.address);

  await pair.memberPage.reload();
  await secondPage.reload();
  await expect(pair.memberPage.getByText(cardAddr)).toBeVisible({
    timeout: 25_000,
  });
  await expect(secondPage.getByText(cardAddr)).toBeVisible({
    timeout: 25_000,
  });
  await expectListBadge(pair.memberPage, "팀공유");
  await expectListBadge(secondPage, "팀공유");

  await pair.memberPage.getByText(cardAddr).click();
  await expect(pair.memberPage).toHaveURL(
    new RegExp(`/properties/${prop.id}`),
    { timeout: 15_000 }
  );

  await expectNoListBadge(secondPage, "팀공유", 12_000);

  await secondCtx.close();
  await pair.ownerCtx.close();
  await pair.memberCtx.close();
});
