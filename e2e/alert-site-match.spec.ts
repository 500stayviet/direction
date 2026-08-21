import { expect, test } from "@playwright/test";
import {
  expectListBadge,
  expectNoListBadge,
  getAppAuth,
  insertSiteMatchPair,
  requireE2eBackendEnv,
} from "./helpers";
import { createTeamPair } from "./teamHelpers";

test.beforeEach(({ page: _page }, testInfo) => {
  requireE2eBackendEnv(testInfo);
});

test("팀원 비공유 매물 — 멤버 고객에만 사이트내 뱃지", async ({ browser }) => {
  const pair = await createTeamPair(browser);
  const ownerAuth = await getAppAuth(pair.ownerPage);
  const memberAuth = await getAppAuth(pair.memberPage);
  if (!ownerAuth?.user?.id || !memberAuth?.user?.id) {
    throw new Error("auth missing");
  }

  await insertSiteMatchPair({
    memberUserId: memberAuth.user.id,
    ownerUserId: ownerAuth.user.id,
    workspaceId: pair.ws.workspaceId,
  });

  await pair.memberPage.goto("/customers");
  await expect(pair.memberPage.getByText("사이트고객")).toBeVisible({
    timeout: 25_000,
  });
  await expectListBadge(pair.memberPage, "사이트내");

  await pair.ownerPage.goto("/properties");
  await expectNoSiteBadge(pair.ownerPage);

  await pair.ownerCtx.close();
  await pair.memberCtx.close();
});

async function expectNoSiteBadge(page: import("@playwright/test").Page) {
  await expect(page.getByText("사이트내", { exact: true })).toHaveCount(0, {
    timeout: 10_000,
  });
}
