import { expect, test } from "@playwright/test";
import {
  expectListBadge,
  expectNoListBadge,
  getAppAuth,
  insertSharedProperty,
  listCardAddress,
  requireE2eBackendEnv,
} from "./helpers";
import { createTeamPair } from "./teamHelpers";

test.beforeEach(({ page: _page }, testInfo) => {
  requireE2eBackendEnv(testInfo);
});

test("팀공유 뱃지는 scrollShare만으로는 안 꺼지고 카드 탭 시 꺼짐", async ({
  browser,
}) => {
  const pair = await createTeamPair(browser);
  const auth = await getAppAuth(pair.ownerPage);
  if (!auth?.user?.id) throw new Error("owner auth missing");

  await pair.memberPage.goto("/properties");
  await expect(pair.memberPage.getByText(/등록 \d+건/)).toBeVisible({
    timeout: 25_000,
  });

  const prop = await insertSharedProperty({
    ownerUserId: auth.user.id,
    workspaceId: pair.ws.workspaceId,
    marker: `E2E해제-${Date.now()}`,
    shared: true,
  });
  const cardAddr = listCardAddress(prop.address);

  await pair.memberPage.goto(`/properties?scrollShare=${prop.id}`);
  await expect(pair.memberPage.getByText(cardAddr)).toBeVisible({
    timeout: 25_000,
  });
  await expectListBadge(pair.memberPage, "팀공유");

  await pair.memberPage.getByText(cardAddr).click();
  await expect(pair.memberPage).toHaveURL(new RegExp(`/properties/${prop.id}`), {
    timeout: 15_000,
  });

  await pair.memberPage.goto("/properties");
  await expect(pair.memberPage.getByText(cardAddr)).toBeVisible({
    timeout: 25_000,
  });
  await expectNoListBadge(pair.memberPage, "팀공유");

  await pair.ownerCtx.close();
  await pair.memberCtx.close();
});
