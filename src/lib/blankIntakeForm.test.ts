import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerBlankFormText,
  buildPropertyBlankFormText,
} from "./blankIntakeForm.ts";
import { buildAgentShareFooterLines } from "./shareAgentFooter.ts";

describe("blankIntakeForm", () => {
  it("고객 양식은 명칭:  한 줄(콜론 뒤 띄어쓰기 두 번)이다", () => {
    const text = buildCustomerBlankFormText({
      shopName: "성내",
      name: "김중개",
      phone: "01012345678",
    });
    assert.match(text, /^고객등록 양식/);
    assert.match(text, /고객명 또는 명칭:  \n/);
    assert.match(text, /선호지역:  \n/);
    assert.match(text, /성내 공인중개사사무소/);
    assert.match(text, /담당 김중개/);
    assert.match(text, /-제공-/);
    assert.match(text, /앱 현장동선/);
  });

  it("가입자 정보가 비면 라벨만 남긴다", () => {
    const lines = buildAgentShareFooterLines({
      shopName: "",
      name: "",
      phone: "",
    });
    assert.deepEqual(lines.slice(1), [
      "부동산",
      "담당",
      "전화번호",
      "-제공-",
      "앱 현장동선",
    ]);
    const text = buildPropertyBlankFormText(null);
    assert.match(text, /^매물등록 양식/);
    assert.match(text, /매물 주소 \(구·동\):  \n/);
    assert.match(text, /\n부동산\n담당\n전화번호\n-제공-\n앱 현장동선$/);
  });
});
