import { expect, test } from "@playwright/test";
import { getAppAuth, insertSharedProperty, listCardAddress } from "./helpers";
import { createTeamPair } from "./teamHelpers";

test("2자가 공유 매물 수정·목록 숨김", async ({ browser }) => {
  const pair = await createTeamPair(browser);
  const auth = await getAppAuth(pair.ownerPage);
  if (!auth?.user?.id) throw new Error("owner auth missing");

  const marker = `E2E2자-${Date.now()}`;
  const prop = await insertSharedProperty({
    ownerUserId: auth.user.id,
    workspaceId: pair.ws.workspaceId,
    marker,
    shared: true,
    notes: marker,
  });

  await pair.memberPage.goto("/properties");
  await expect(pair.memberPage.getByText(listCardAddress(prop.address))).toBeVisible({
    timeout: 25_000,
  });

  await pair.memberPage.getByText(listCardAddress(prop.address)).click();
  await expect(pair.memberPage.getByText("매물 정보")).toBeVisible({
    timeout: 15_000,
  });
  pair.memberPage.once("dialog", (d) => d.accept());
  await pair.memberPage.getByRole("button", { name: "수정" }).click();
  await expect(pair.memberPage.getByText("매물 정보 수정")).toBeVisible();
  const note = `2자수정-${Date.now()}`;
  await pair.memberPage.getByLabel("메모").fill(note);
  await pair.memberPage.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(
    pair.memberPage.getByText("변경사항이 저장되었습니다")
  ).toBeVisible({ timeout: 20_000 });
  await expect(pair.memberPage.getByText(note)).toBeVisible({
    timeout: 20_000,
  });

  await pair.ownerPage.goto(`/properties/${prop.id}`);
  await pair.ownerPage.reload();
  await expect(pair.ownerPage.getByText(note)).toBeVisible({
    timeout: 25_000,
  });

  await pair.memberPage.goto(`/properties/${prop.id}`);
  pair.memberPage.on("dialog", (d) => void d.accept());
  await pair.memberPage.getByRole("button", { name: "삭제" }).click();
  await expect(pair.memberPage).toHaveURL(/\/properties\/?$/, {
    timeout: 20_000,
  });
  await expect(pair.memberPage.getByText(listCardAddress(prop.address))).toHaveCount(0);

  await pair.ownerPage.goto("/properties");
  await expect(pair.ownerPage.getByText(listCardAddress(prop.address))).toBeVisible({
    timeout: 20_000,
  });

  await pair.ownerCtx.close();
  await pair.memberCtx.close();
});
