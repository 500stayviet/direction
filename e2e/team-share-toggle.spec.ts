import { expect, test } from "@playwright/test";
import { getAppAuth, insertSharedProperty, listCardAddress } from "./helpers";
import { createTeamPair } from "./teamHelpers";

test("팀공유 토글 ON 후 멤버에게 보임", async ({ browser }) => {
  const pair = await createTeamPair(browser);
  const auth = await getAppAuth(pair.ownerPage);
  if (!auth?.user?.id) throw new Error("owner auth missing");

  const marker = `E2E토글-${Date.now()}`;
  const prop = await insertSharedProperty({
    ownerUserId: auth.user.id,
    workspaceId: pair.ws.workspaceId,
    marker,
    shared: false,
    notes: marker,
  });

  await pair.ownerPage.goto(`/properties/${prop.id}`);
  await expect(pair.ownerPage.getByText("매물 정보")).toBeVisible({
    timeout: 20_000,
  });
  await pair.ownerPage.getByRole("button", { name: "팀공유" }).click();
  await expect(pair.ownerPage.getByRole("button", { name: "공유중" })).toBeVisible({
    timeout: 15_000,
  });

  await pair.memberPage.goto("/properties");
  await expect(pair.memberPage.getByText(listCardAddress(prop.address))).toBeVisible({
    timeout: 25_000,
  });

  await pair.ownerCtx.close();
  await pair.memberCtx.close();
});
