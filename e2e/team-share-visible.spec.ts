import { expect, test } from "@playwright/test";
import { getAppAuth, insertSharedProperty } from "./helpers";
import { createTeamPair } from "./teamHelpers";

test("공유 코드 합류 후 공유 매물이 상대에게 보임", async ({ browser }) => {
  const pair = await createTeamPair(browser);
  const auth = await getAppAuth(pair.ownerPage);
  if (!auth?.user?.id) throw new Error("owner auth missing");

  const prop = await insertSharedProperty({
    ownerUserId: auth.user.id,
    workspaceId: pair.ws.workspaceId,
    marker: `E2E공유-${Date.now()}`,
    shared: true,
  });

  await pair.memberPage.goto("/properties");
  await expect(pair.memberPage.getByText(prop.address)).toBeVisible({
    timeout: 25_000,
  });

  await pair.ownerCtx.close();
  await pair.memberCtx.close();
});
