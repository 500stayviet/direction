import { expect, test } from "@playwright/test";
import {
  expectListBadge,
  getAppAuth,
  insertSharedProperty,
  listCardAddress,
  requireE2eBackendEnv,
} from "./helpers";
import { createTeamPair } from "./teamHelpers";

test.beforeEach(({ page: _page }, testInfo) => {
  requireE2eBackendEnv(testInfo);
});

test("팀 공유 후 멤버 리스트에 팀공유 뱃지", async ({ browser }) => {
  const pair = await createTeamPair(browser);
  const auth = await getAppAuth(pair.ownerPage);
  if (!auth?.user?.id) throw new Error("owner auth missing");

  await pair.memberPage.goto("/properties");
  await expect(pair.memberPage.getByText("등록 0건").or(pair.memberPage.getByText(/등록 \d+건/))).toBeVisible({
    timeout: 25_000,
  });

  const prop = await insertSharedProperty({
    ownerUserId: auth.user.id,
    workspaceId: pair.ws.workspaceId,
    marker: `E2E뱃지-${Date.now()}`,
    shared: true,
  });

  await pair.memberPage.goto("/properties");
  await expect(pair.memberPage.getByText(listCardAddress(prop.address))).toBeVisible({
    timeout: 25_000,
  });
  await expectListBadge(pair.memberPage, "팀공유");

  await pair.ownerCtx.close();
  await pair.memberCtx.close();
});
