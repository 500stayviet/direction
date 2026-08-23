import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  getAppAuth,
  insertSiteMatchPair,
  listCardAddress,
  requireE2eBackendEnv,
} from "./helpers";
import { createTeamPair } from "./teamHelpers";

test.beforeEach(({ page: _page }, testInfo) => {
  requireE2eBackendEnv(testInfo);
});

const SECRET = {
  customerName: "비공개고객갑",
  customerPhone: "010-7111-1001",
  tenantPhone: "010-7222-2002",
  landlordPhone: "010-7333-3003",
  partnerAgency: {
    name: "비공개협력공인",
    dong: "암사동",
    phone: "010-7444-4004",
  },
  ownerPhone: "010-7555-5005",
  memberPhone: "010-7666-6006",
};

function digits(phone: string) {
  return phone.replace(/\D/g, "");
}

async function expectNoSecrets(scope: Locator) {
  const forbidden = [
    SECRET.customerName,
    SECRET.customerPhone,
    SECRET.tenantPhone,
    SECRET.landlordPhone,
    SECRET.partnerAgency.name,
    SECRET.partnerAgency.phone,
    SECRET.partnerAgency.dong,
    "멤버개인이름",
    "오너개인이름",
    "임차인",
    "임대인",
    "협력부동산",
  ];
  for (const text of forbidden) {
    await expect(scope.getByText(text, { exact: false })).toHaveCount(0);
  }
  const telForbidden = [
    digits(SECRET.customerPhone),
    digits(SECRET.tenantPhone),
    digits(SECRET.landlordPhone),
    digits(SECRET.partnerAgency.phone),
  ];
  for (const d of telForbidden) {
    await expect(scope.locator(`a[href="tel:${d}"]`)).toHaveCount(0);
  }
}

async function expectAgencyVisible(
  scope: Locator,
  shopName: string,
  phone: string
) {
  await expect(scope.getByText(shopName, { exact: false })).toBeVisible();
  await expect(scope.getByText("천호동", { exact: false }).first()).toBeVisible();
  await expect(scope.getByText(phone, { exact: false })).toBeVisible();
}

async function matchModalPanel(page: Page, title: string) {
  const heading = page.getByRole("heading", { name: title });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  return heading.locator("xpath=ancestor::div[contains(@class,'shadow-xl')][1]");
}

async function closeMatchModal(page: Page) {
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "조건 매칭 · 매물" })
  ).toHaveCount(0, { timeout: 5_000 });
}

async function closeCustomerMatchModal(page: Page) {
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "조건 매칭 · 고객" })
  ).toHaveCount(0, { timeout: 5_000 });
}

/** 매칭 풀 로드 대기 — 준비 중 empty 대신 카드가 뜰 때까지 */
async function waitForPartnerMatchCard(
  page: Page,
  sectionTestId: string,
  cardText: string
) {
  const section = page.getByTestId(sectionTestId);
  await expect(section).toBeVisible({ timeout: 15_000 });
  await expect(section.getByText("준비 중")).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(section.getByText(cardText, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  return section;
}

test("사이트내 공유 매칭 — 상호·동·전화만 (고객·당사자·협력 숨김)", async ({
  browser,
}) => {
  const pair = await createTeamPair(browser);
  const ownerAuth = await getAppAuth(pair.ownerPage);
  const memberAuth = await getAppAuth(pair.memberPage);
  if (!ownerAuth?.user?.id || !memberAuth?.user?.id) {
    throw new Error("auth missing");
  }

  const { customerId, propertyId, address } = await insertSiteMatchPair({
    memberUserId: memberAuth.user.id,
    ownerUserId: ownerAuth.user.id,
    workspaceId: pair.ws.workspaceId,
    privacy: {
      customerName: SECRET.customerName,
      customerPhone: SECRET.customerPhone,
      tenantPhone: SECRET.tenantPhone,
      landlordPhone: SECRET.landlordPhone,
      partnerAgency: SECRET.partnerAgency,
      ownerShopName: pair.owner.shopName,
      ownerPhone: SECRET.ownerPhone,
      memberShopName: pair.member.shopName,
      memberPhone: SECRET.memberPhone,
    },
  });
  const cardAddr = listCardAddress(address);

  // 멤버 고객 리스트 — 본인 고객이므로 전화만 보임(이름은 리스트 카드에 없음)
  await pair.memberPage.goto("/customers");
  await expect(
    pair.memberPage.getByText(SECRET.customerPhone, { exact: false })
  ).toBeVisible({ timeout: 25_000 });

  await pair.memberPage.goto(`/customers/${customerId}`);
  const partnerProps = await waitForPartnerMatchCard(
    pair.memberPage,
    "match-section-partner-properties",
    cardAddr
  );
  await expectAgencyVisible(partnerProps, pair.owner.shopName, SECRET.ownerPhone);
  await expectNoSecrets(partnerProps);

  await partnerProps.getByText(cardAddr, { exact: false }).first().click();
  const propModal = await matchModalPanel(
    pair.memberPage,
    "조건 매칭 · 매물"
  );
  await expectAgencyVisible(propModal, pair.owner.shopName, SECRET.ownerPhone);
  await expectNoSecrets(propModal);
  await closeMatchModal(pair.memberPage);

  await pair.ownerPage.goto(`/properties/${propertyId}`);
  const partnerCustomers = await waitForPartnerMatchCard(
    pair.ownerPage,
    "match-section-partner-customers",
    pair.member.shopName
  );
  await expectAgencyVisible(
    partnerCustomers,
    pair.member.shopName,
    SECRET.memberPhone
  );
  await expectNoSecrets(partnerCustomers);

  await partnerCustomers
    .getByText(pair.member.shopName, { exact: false })
    .first()
    .click();
  const custModal = await matchModalPanel(
    pair.ownerPage,
    "조건 매칭 · 고객"
  );
  await expectAgencyVisible(custModal, pair.member.shopName, SECRET.memberPhone);
  await expectNoSecrets(custModal);
  await closeCustomerMatchModal(pair.ownerPage);

  await pair.ownerCtx.close();
  await pair.memberCtx.close();
});
