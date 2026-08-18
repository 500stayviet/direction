import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyIntakeToProperty, appendIntakeMemo, intakePreferredLocation, normalizeIntakeInput, parseIntakeText, scrubCorruptIntakeText } from "./intakeParse.ts";
import { createEmptyProperty } from "./constants.ts";
import { formatPhoneInput } from "./format.ts";

describe("parseIntakeText", () => {
  it("고객 한묶음에서 유형·거래·금액·동·유무를 읽는다", () => {
    const parsed = parseIntakeText(
      "원룸 전세 2억 암사동 바로입주 주차 있고 대출 디딤돌 엘베 있음 강아지 키워요",
      "customer"
    );
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.dealType, "전세");
    assert.equal(parsed.deposit, 20000);
    assert.equal(parsed.dong, "암사동");
    assert.equal(parsed.gu, "강동구");
    assert.equal(parsed.parking, "유");
    assert.equal(parsed.loan, "유");
    assert.equal(parsed.elevator, "유");
    assert.equal(parsed.moveInImmediate, true);
    assert.match(parsed.notes, /디딤돌/);
    assert.match(parsed.notes, /강아지/);
    assert.doesNotMatch(parsed.notes, /있고|있음|바로입주/);
  });

  it("의도 키워드·라벨 메모만 남기고 파싱 잔여물은 메모에 넣지 않는다", () => {
    const note = parseIntakeText(
      "원룸 전세 2억 암사동 남향 저층 싫어요 희망층 3층 이상",
      "customer"
    );
    assert.match(note.notes, /남향/);
    assert.match(note.notes, /저층/);
    assert.match(note.notes, /희망층/);
    assert.match(note.notes, /3층/);
    assert.doesNotMatch(note.notes, /2억|암사동|원룸|전세/);
    assert.equal(note.roomNo, undefined);

    const labeled = parseIntakeText(
      "상가 월세 암사동 메모: 권리금 협의",
      "property"
    );
    assert.equal(labeled.notes, "권리금 협의");

    const contentLabel = parseIntakeText(
      "원룸 전세 2억 암사동 내용: 남향 저층",
      "customer"
    );
    assert.equal(contentLabel.notes, "남향 저층");
    assert.equal(
      appendIntakeMemo(
        "저층 남향 저녁시간 방문불가 아기있음 주차는 낮에만가능",
        "저층 남향 저녁시간 방문불가 아기있음 는 낮에만가능"
      ),
      "저층 남향 저녁시간 방문불가 아기있음 주차는 낮에만가능"
    );

    const labeledMoney = parseIntakeText(
      "원룸 전세 2억 암사동 메모: 매매 5억 남향",
      "customer"
    );
    assert.equal(labeledMoney.dealType, "전세");
    assert.equal(labeledMoney.deposit, 20000);
    assert.equal(labeledMoney.dong, "암사동");
    assert.equal(labeledMoney.notes, "매매 5억 남향");

    const labeledDot = parseIntakeText(
      "원룸 전세 2억 암사동 메모. 남향 저층",
      "customer"
    );
    assert.equal(labeledDot.dealType, "전세");
    assert.equal(labeledDot.deposit, 20000);
    assert.equal(labeledDot.notes, "남향 저층");

    const labeledSpaced = parseIntakeText(
      "원룸 전세 2억 암사동 메모 : 권리금 협의",
      "customer"
    );
    assert.equal(labeledSpaced.notes, "권리금 협의");

    const notMemoWord = parseIntakeText(
      "원룸 전세 2억 암사동 메모로 남향",
      "customer"
    );
    assert.equal(notMemoWord.dealType, "전세");
    assert.equal(notMemoWord.dong, "암사동");
    assert.match(notMemoWord.notes, /남향/);
    assert.doesNotMatch(notMemoWord.notes, /메모로/);

    const discarded = parseIntakeText("원룸 12/50 5억9 3화 물화 9/31", "customer");
    assert.equal(discarded.notes, "");
    assert.equal(discarded.deposit, undefined);
    assert.equal(discarded.roomCount, 1);
    assert.equal(discarded.bathroomCount, 1);

    const keepDir = parseIntakeText("원룸 전세 5억9 남향", "customer");
    assert.equal(keepDir.deposit, undefined);
    assert.equal(keepDir.notes, "남향");

    const road = parseIntakeText("성내동 올림픽로 123 원룸 전세", "property");
    assert.equal(road.dong, "성내동");
    assert.equal(road.jibun, undefined);
    assert.equal(road.notes, "");

    const typeLabel = parseIntakeText("매물유형 원룸 전세 2억 암사동", "customer");
    assert.equal(typeLabel.roomType, "원룸");
    assert.equal(typeLabel.dealType, "전세");
    assert.equal(typeLabel.deposit, 20000);
    assert.equal(typeLabel.notes, "");

    const nameLabel = parseIntakeText(
      "고객명 홍길동 원룸 전세 2억 암사동",
      "customer"
    );
    assert.equal(nameLabel.name, "홍길동");
    assert.equal(nameLabel.nameLabeled, true);
    assert.equal(nameLabel.notes, "");
  });

  it("앞에 나온 거래만 칸에 넣고 뒤 거래·금액은 내용으로 남긴다", () => {
    const jeonseFirst = parseIntakeText(
      "원룸 전세 2억 암사동 매매 5억 남향",
      "customer"
    );
    assert.equal(jeonseFirst.dealType, "전세");
    assert.equal(jeonseFirst.deposit, 20000);
    assert.equal(jeonseFirst.dong, "암사동");
    assert.match(jeonseFirst.notes, /매매/);
    assert.match(jeonseFirst.notes, /5억/);
    assert.match(jeonseFirst.notes, /남향/);

    const saleFirst = parseIntakeText("원룸 매매 5 전세 2억", "customer");
    assert.equal(saleFirst.dealType, "매매");
    assert.equal(saleFirst.deposit, 50000);
    assert.match(saleFirst.notes, /전세/);

    const saleWithRent = parseIntakeText(
      "건물 매매 5억 월세 1000/50 남향",
      "property"
    );
    assert.equal(saleWithRent.dealType, "매매");
    assert.equal(saleWithRent.deposit, 50000);
    assert.equal(saleWithRent.monthlyRent, undefined);
    assert.match(saleWithRent.notes, /월세/);
    assert.match(saleWithRent.notes, /남향/);

    const laterKeptInMemo = parseIntakeText(
      "원룸 전세 2억 매매 천호동",
      "customer"
    );
    assert.equal(laterKeptInMemo.dealType, "전세");
    assert.equal(laterKeptInMemo.deposit, 20000);
    assert.equal(laterKeptInMemo.dong, "천호동");
    assert.match(laterKeptInMemo.notes, /매매/);
    assert.doesNotMatch(laterKeptInMemo.notes, /천호동/);

    const laterDealKeepsFieldsOutOfMemo = parseIntakeText(
      "원룸 전세 2억 매매 5억 강동구 암사동 5월 1일 ~ 6월 15일 대출 유 전세보증보험 유 주차 유 엘리베이터 유",
      "customer"
    );
    assert.equal(laterDealKeepsFieldsOutOfMemo.dealType, "전세");
    assert.equal(laterDealKeepsFieldsOutOfMemo.deposit, 20000);
    assert.equal(laterDealKeepsFieldsOutOfMemo.dong, "암사동");
    assert.equal(laterDealKeepsFieldsOutOfMemo.loan, "유");
    assert.equal(laterDealKeepsFieldsOutOfMemo.parking, "유");
    assert.match(laterDealKeepsFieldsOutOfMemo.notes, /매매/);
    assert.match(laterDealKeepsFieldsOutOfMemo.notes, /5억/);
    assert.doesNotMatch(laterDealKeepsFieldsOutOfMemo.notes, /암사동/);
    assert.doesNotMatch(laterDealKeepsFieldsOutOfMemo.notes, /5월/);
    assert.doesNotMatch(laterDealKeepsFieldsOutOfMemo.notes, /대출 유/);
    assert.doesNotMatch(laterDealKeepsFieldsOutOfMemo.notes, /전세보증보험/);
    assert.doesNotMatch(laterDealKeepsFieldsOutOfMemo.notes, /주차 유/);
    assert.doesNotMatch(laterDealKeepsFieldsOutOfMemo.notes, /엘리베이터 유/);

    const jeonseThenPrice = parseIntakeText(
      "전세 아파트 방 3개 화장실 2개 전세 2억 강동구 암사동 대출 유 전세보증보험 유 주차 유 엘리베이터 유 메모: 남향 고층",
      "customer"
    );
    assert.equal(jeonseThenPrice.dealType, "전세");
    assert.equal(jeonseThenPrice.deposit, 20000);
    assert.equal(jeonseThenPrice.roomType, "아파트");
    assert.equal(jeonseThenPrice.roomCount, 3);
    assert.equal(jeonseThenPrice.bathroomCount, 2);
    assert.equal(jeonseThenPrice.dong, "암사동");
    assert.match(jeonseThenPrice.notes, /남향 고층/);
    assert.doesNotMatch(jeonseThenPrice.notes, /화장실/);
    assert.doesNotMatch(jeonseThenPrice.notes, /2억/);
    assert.doesNotMatch(jeonseThenPrice.notes, /암사동/);
    assert.doesNotMatch(jeonseThenPrice.notes, /전세보증보험/);
  });

  it("앞에 나온 전화만 칸에 넣고 뒤 번호는 내용으로 남긴다", () => {
    const parsed = parseIntakeText(
      "010-1234-5678 원룸 전세 암사동 010-9999-8888",
      "customer"
    );
    assert.equal(parsed.phone, "010-1234-5678");
    assert.match(parsed.notes, /010-9999-8888/);
    assert.doesNotMatch(parsed.notes, /010-1234-5678/);

    const property = parseIntakeText(
      "원룸 전세 010-1234-5678 암사동 010-9999-8888",
      "property"
    );
    assert.equal(property.phone, "010-1234-5678");
    assert.match(property.notes, /010-9999-8888/);

    const labeled = parseIntakeText(
      "원룸 전세 암사동 임차인 010-1111-2222 임대인 010-3333-4444",
      "property"
    );
    assert.equal(labeled.tenantPhone, "010-1111-2222");
    assert.equal(labeled.landlordPhone, "010-3333-4444");
    assert.doesNotMatch(labeled.notes, /010-1111-2222|010-3333-4444/);
  });

  it("앞에 나온 유형만 칸에 넣고 뒤 유형은 내용으로 남긴다", () => {
    const parsed = parseIntakeText("원룸 전세 투룸", "property");
    assert.equal(parsed.roomType, "원룸");
    assert.match(parsed.notes, /투룸/);

    const apt = parseIntakeText("원룸 아파트", "customer");
    assert.equal(apt.roomType, "원룸");
    assert.match(apt.notes, /아파트/);
  });

  it("4룸·5룸·방 수는 3룸+와 방 개수로 넣는다", () => {
    const four = parseIntakeText("4룸 전세 암사동", "property");
    assert.equal(four.roomType, "3룸+");
    assert.equal(four.roomCount, 4);
    assert.equal(applyIntakeToProperty(createEmptyProperty(), four).roomCount, 4);

    const five = parseIntakeText("5룸 월세", "customer");
    assert.equal(five.roomType, "3룸+");
    assert.equal(five.roomCount, 5);

    const bang = parseIntakeText("방 4 전세 성내동", "property");
    assert.equal(bang.roomType, "3룸+");
    assert.equal(bang.roomCount, 4);

    const bangTight = parseIntakeText("방5 월세", "customer");
    assert.equal(bangTight.roomType, "3룸+");
    assert.equal(bangTight.roomCount, 5);

    const apt = parseIntakeText("아파트 4룸 매매", "property");
    assert.equal(apt.roomType, "아파트");
    assert.equal(apt.roomCount, 4);

    const bathRight = parseIntakeText("방4 화3 전세", "property");
    assert.equal(bathRight.roomType, "3룸+");
    assert.equal(bathRight.roomCount, 4);
    assert.equal(bathRight.bathroomCount, 3);
    assert.equal(
      applyIntakeToProperty(createEmptyProperty(), bathRight).bathroomCount,
      3
    );

    const bathLeft = parseIntakeText("화3 방4 월세", "customer");
    assert.equal(bathLeft.roomCount, 4);
    assert.equal(bathLeft.bathroomCount, 3);

    const bathTight = parseIntakeText("4룸화2 전세", "property");
    assert.equal(bathTight.roomCount, 4);
    assert.equal(bathTight.bathroomCount, 2);
    const bathRoomSpace = parseIntakeText("4룸 화2 전세", "property");
    assert.equal(bathRoomSpace.roomCount, 4);
    assert.equal(bathRoomSpace.bathroomCount, 2);
    const bathRoomSpaces = parseIntakeText("4룸 화 2 전세", "property");
    assert.equal(bathRoomSpaces.bathroomCount, 2);
    const twoRoomBath = parseIntakeText("투룸 화2 월세", "property");
    assert.equal(twoRoomBath.roomType, "투룸");
    assert.equal(twoRoomBath.bathroomCount, 2);

    const bathSpaced = parseIntakeText("방4 화 3 전세", "property");
    assert.equal(bathSpaced.bathroomCount, 3);
    const bathWord = parseIntakeText("방4 화장실 3 전세", "property");
    assert.equal(bathWord.bathroomCount, 3);

    const bathAlone = parseIntakeText("원룸 전세 화3 암사동", "property");
    assert.equal(bathAlone.roomType, "원룸");
    assert.equal(bathAlone.roomCount, 1);
    assert.equal(bathAlone.bathroomCount, 1);
    const bathReversed = parseIntakeText("방4 3화 전세", "property");
    assert.equal(bathReversed.bathroomCount, undefined);
    const bathCompound = parseIntakeText("방4 물화3 전세", "property");
    assert.equal(bathCompound.bathroomCount, undefined);

    const oneRoomIgnoresCounts = parseIntakeText(
      "원룸 방 3 화장실 2 월세",
      "customer"
    );
    assert.equal(oneRoomIgnoresCounts.roomType, "원룸");
    assert.equal(oneRoomIgnoresCounts.roomCount, 1);
    assert.equal(oneRoomIgnoresCounts.bathroomCount, 1);
  });

  it("매물 월세·옵션·동호실", () => {
    const parsed = parseIntakeText(
      "암사동 123-4 302호 투룸 월세 보증 1000 월 60 주차 없음 에어컨 냉장고",
      "property"
    );
    assert.equal(parsed.roomType, "투룸");
    assert.equal(parsed.dealType, "월세");
    assert.equal(parsed.deposit, 1000);
    assert.equal(parsed.monthlyRent, 60);
    assert.equal(parsed.parking, "무");
    assert.equal(parsed.jibun, "123-4");
    assert.equal(parsed.roomNo, "302호");
    assert.equal(parsed.dong, "암사동");
    assert.equal(parsed.gu, "강동구");
    assert.deepEqual(parsed.options, ["에어컨", "냉장고"]);
    const next = applyIntakeToProperty(createEmptyProperty(), parsed);
    assert.equal(next.roomCount, 2);
    assert.equal(next.bathroomCount, 1);
    const tildeJibun = parseIntakeText(
      "천호동 123~4 원룸 전세",
      "property"
    );
    assert.equal(tildeJibun.jibun, "123-4");
    assert.equal(tildeJibun.dong, "천호동");
    const mainJibun = parseIntakeText("성내동 123 원룸 전세", "property");
    assert.equal(mainJibun.jibun, "123");
    assert.equal(mainJibun.dong, "성내동");
    assert.equal(mainJibun.gu, "강동구");
    const hoNotJibun = parseIntakeText("성내동 302호 원룸 전세", "property");
    assert.equal(hoNotJibun.jibun, undefined);
    assert.equal(hoNotJibun.roomNo, "302호");
    const dongHo = parseIntakeText(
      "성내동 111-1 힐스테이트 101동 102호 원룸 전세",
      "property"
    );
    assert.equal(dongHo.jibun, "111-1");
    assert.equal(dongHo.buildingName, "힐스테이트");
    assert.equal(dongHo.roomNo, "101동 102호");

    const eJibun = parseIntakeText("성내동 111에1 원룸 전세", "property");
    assert.equal(eJibun.jibun, "111-1");
    assert.equal(eJibun.dong, "성내동");
    const eSpaced = parseIntakeText("성내동 111 에 1 원룸 전세", "property");
    assert.equal(eSpaced.jibun, "111-1");
    const dasiJibun = parseIntakeText(
      "성내동 111다시 1 원룸 전세",
      "property"
    );
    assert.equal(dasiJibun.jibun, "111-1");
    const dasiTight = parseIntakeText("성내동 111다시1 원룸 전세", "property");
    assert.equal(dasiTight.jibun, "111-1");
    const glued = parseIntakeText(
      "강동구성내동151다시5 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(glued.dong, "성내동");
    assert.equal(glued.jibun, "151-5");
    const spokenDigits = parseIntakeText(
      "성내동 일오일 다시 오 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(spokenDigits.jibun, "151-5");
    const sinoJibun = parseIntakeText(
      "성내동 백오십일 다시 오 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(sinoJibun.jibun, "151-5");
    const spacedSpoken = parseIntakeText(
      "성내동 일 오 일 다시 오 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(spacedSpoken.jibun, "151-5");
    const spacedArabic = parseIntakeText(
      "성내동 151 5 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(spacedArabic.jibun, "151-5");
    const sinoMainOnly = parseIntakeText(
      "강동구 성내동 백오십일 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(sinoMainOnly.dong, "성내동");
    assert.equal(sinoMainOnly.jibun, "151");
    const nativeOnes = parseIntakeText(
      "강동구 성내동 하나하나하나 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(nativeOnes.jibun, "111");
    const sttMonth = parseIntakeText(
      "강동구 성내동 1월 11일 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(sttMonth.jibun, "111");
    // 메시지 spoken 한 줄(유형·거래 포함)에서도 동 뒤 STT 날짜형 지번 유지
    assert.equal(
      parseIntakeText(
        "강동구 성내동 일월 십일 원룸 전세",
        "property",
        new Date(),
        "spoken"
      ).jibun,
      "111"
    );
    // 마이크 주소지: 날짜 확장 없이 지번만
    assert.equal(
      normalizeIntakeInput("강동구 성내동 일월 십일", "talk-location"),
      "강동구 성내동 111"
    );
    assert.equal(
      parseIntakeText(
        "강동구 성내동 일월 십일",
        "property",
        new Date(),
        "talk-location"
      ).jibun,
      "111"
    );
    assert.equal(
      parseIntakeText(
        "강동구 성내동 하나하나하나",
        "property",
        new Date(),
        "talk-location"
      ).jibun,
      "111"
    );
    assert.equal(
      parseIntakeText(
        "강동구 성내동 5월 1일",
        "property",
        new Date(),
        "talk-location"
      ).jibun,
      undefined
    );
    const spacedSingles = parseIntakeText(
      "강동구 성내동 1 1 1 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(spacedSingles.jibun, "111");
    const sinoSpacedMain = parseIntakeText(
      "강동구 성내동 백 오십 일 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(sinoSpacedMain.jibun, "151");
    const sino314 = parseIntakeText(
      "강동구 성내동 삼백십사 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(sino314.jibun, "314");
    const whereSep = parseIntakeText(
      "성내동 151에서 5 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(whereSep.jibun, "151-5");
    const hangulOnly = parseIntakeText(
      "성내동 일오일 원룸 전세",
      "property",
      new Date(),
      "spoken"
    );
    assert.equal(hangulOnly.jibun, "151");
    const applied = applyIntakeToProperty(createEmptyProperty(), dongHo);
    assert.equal(applied.roomNo, "101동 102호");
    assert.equal(applied.buildingName, "힐스테이트");
    const roadNotJibun = parseIntakeText(
      "성내동 올림픽로 123 원룸 전세",
      "property"
    );
    assert.equal(roadNotJibun.dong, "성내동");
    assert.equal(roadNotJibun.jibun, undefined);
  });

  it("구 없이 동만 있어도 구를 채운다", () => {
    const parsed = parseIntakeText("투룸 월세 천호동 바로입주", "customer");
    assert.equal(parsed.dong, "천호동");
    assert.equal(parsed.gu, "강동구");
  });

  it("암사1동처럼 행정동 숫자도 암사동·강동구로 본다", () => {
    const parsed = parseIntakeText("원룸 전세 암사1동", "customer");
    assert.equal(parsed.dong, "암사동");
    assert.equal(parsed.gu, "강동구");
  });

  it("신사동처럼 구가 겹치면 구를 짐작하지 않는다", () => {
    const parsed = parseIntakeText("원룸 전세 신사동", "customer");
    assert.equal(parsed.dong, "신사동");
    assert.equal(parsed.gu, undefined);
  });

  it("겹치는 동도 구가 있으면 그 구를 쓴다", () => {
    const parsed = parseIntakeText("원룸 전세 은평구 신사동", "customer");
    assert.equal(parsed.dong, "신사동");
    assert.equal(parsed.gu, "은평구");
  });

  it("고객 선호위치는 글에 나온 동을 모두 넣는다", () => {
    const parsed = parseIntakeText(
      "010-1234-5678 원룸 전세 강동구 암사동 보증금 2억 대출 유 디딤돌 천호동",
      "customer"
    );
    const loc = intakePreferredLocation(parsed);
    assert.deepEqual(loc.preferredGus, ["강동구"]);
    assert.deepEqual(loc.preferredDongs.sort(), [
      "강동구|암사동",
      "강동구|천호동",
    ].sort());
  });

  it("구·동은 주소로 두고 이억·구천만 금액으로 바꾼다", () => {
    const withMoney = parseIntakeText(
      "원룸 월세 강동구 천호동 2000/65",
      "customer"
    );
    assert.equal(withMoney.dong, "천호동");
    assert.equal(withMoney.gu, "강동구");
    assert.equal(withMoney.deposit, 2000);
    assert.equal(withMoney.monthlyRent, 65);
    assert.doesNotMatch(withMoney.notes, /강동9|9천/);

    const tight = parseIntakeText(
      "원룸 월세 강동구천호동 2000/65",
      "customer"
    );
    assert.equal(tight.dong, "천호동");
    assert.equal(tight.gu, "강동구");
    assert.notEqual(tight.name, "강동구천호동");
    assert.doesNotMatch(tight.notes, /강동9|9천/);

    const cheonwang = parseIntakeText(
      "원룸 전세 2억 구로구천왕동",
      "property"
    );
    assert.equal(cheonwang.dong, "천왕동");
    assert.equal(cheonwang.gu, "구로구");
    assert.doesNotMatch(cheonwang.notes, /9천왕|구로9/);

    const cheonyeon = parseIntakeText(
      "원룸 전세 1억 서대문구 천연동",
      "property"
    );
    assert.equal(cheonyeon.dong, "천연동");
    assert.equal(cheonyeon.gu, "서대문구");

    assert.equal(
      normalizeIntakeInput("강동구 천호동"),
      "강동구 천호동"
    );
    assert.equal(
      normalizeIntakeInput("강동구천호동", "spoken"),
      "강동구천호동"
    );

    const spokenMoney = parseIntakeText(
      "원룸 전세 이억구천이백십만",
      "customer"
    );
    assert.equal(spokenMoney.deposit, 29210);
  });

  it("구 다음 동 이름은 구천 금액으로 바꾸지 않는다", () => {
    const parsed = parseIntakeText(
      "임지나 01055555555 월세 원룸 2000/65 강동구 천호동 고덕동 8월21일 ~ 10월 22일 대출 무 전세보증보험 유 주차 유 엘리베이터 유 메모: 엘베는 없어도되는데 있으면 좋아요 보증보험은 허그 가입합니다.",
      "customer"
    );
    const loc = intakePreferredLocation(parsed);
    assert.deepEqual(loc.preferredGus, ["강동구"]);
    assert.deepEqual(loc.preferredDongs.sort(), [
      "강동구|고덕동",
      "강동구|천호동",
    ].sort());
    assert.doesNotMatch(parsed.notes, /강동9/);
    assert.doesNotMatch(parsed.notes, /강동구 천호동/);
    assert.match(parsed.notes, /허그/);
  });

  it("매물도 구 다음 동을 금액으로 바꾸지 않고 오염 잔여를 내용에 안 넣는다", () => {
    const parsed = parseIntakeText(
      "원룸 월세 2000/65 강동구 천호동 주차 유 엘베 유",
      "property"
    );
    assert.equal(parsed.dong, "천호동");
    assert.equal(parsed.gu, "강동구");
    assert.doesNotMatch(parsed.notes, /강동9|9천호/);
    assert.equal(
      appendIntakeMemo(parsed.notes, "강동9천호동 남향"),
      "남향"
    );
  });

  it("깨진 주소 토큰은 내용에서 지우고 행정동 숫자는 남긴다", () => {
    assert.equal(scrubCorruptIntakeText("강동9천호동"), "");
    assert.equal(scrubCorruptIntakeText("강동9"), "");
    assert.equal(scrubCorruptIntakeText("남향 강동9천호동 저층"), "남향 저층");
    assert.equal(scrubCorruptIntakeText("암사1동 남향"), "암사1동 남향");
    assert.equal(scrubCorruptIntakeText("천호2동"), "천호2동");
  });

  it("매물에 라벨 없는 전화는 임차인 칸에 넣는다", () => {
    const parsed = parseIntakeText("원룸 전세 홍길동 010-1234-5678 암사동", "property");
    assert.equal(parsed.phone, "010-1234-5678");
    assert.equal(parsed.dong, "암사동");
    const next = applyIntakeToProperty(createEmptyProperty(), parsed);
    assert.equal(next.tenantPhone, "010-1234-5678");
    assert.ok(!next.landlordPhone);
  });

  it("고객 메시지에서 이름·전화·동을 칸에 넣는다", () => {
    const parsed = parseIntakeText(
      "홍길동 010-1234-5678 원룸 전세 암사동",
      "customer"
    );
    assert.equal(parsed.name, "홍길동");
    assert.equal(parsed.nameLabeled, true);
    assert.equal(parsed.phone, "010-1234-5678");
    assert.equal(parsed.dong, "암사동");
    assert.equal(parsed.gu, "강동구");
    assert.doesNotMatch(parsed.notes, /홍길동/);
  });

  it("고객 메시지에서 이름만·라벨 없이도 고객명 칸에 넣는다", () => {
    const alone = parseIntakeText("홍길동", "customer");
    assert.equal(alone.name, "홍길동");
    assert.equal(alone.nameLabeled, true);
    assert.equal(alone.notes, "");

    const middle = parseIntakeText("원룸 전세 홍길동 암사동", "customer");
    assert.equal(middle.name, "홍길동");
    assert.equal(middle.nameLabeled, true);
    assert.doesNotMatch(middle.notes, /홍길동/);
  });

  it("전화번호 라벨이 있으면 전화를 읽는다", () => {
    const parsed = parseIntakeText(
      "명칭 성내 전화번호 010-2222-3333 투룸 월세",
      "customer"
    );
    assert.equal(parsed.phone, "010-2222-3333");
  });

  it("매물 글의 임차인·임대인 번호는 칸에 넣는다", () => {
    const parsed = parseIntakeText(
      "원룸 전세 암사동 123-4 임차인 010-1111-2222 임대인 010-3333-4444",
      "property"
    );
    assert.equal(parsed.jibun, "123-4");
    const next = applyIntakeToProperty(createEmptyProperty(), parsed);
    assert.equal(next.tenantPhone, "010-1111-2222");
    assert.equal(next.landlordPhone, "010-3333-4444");
  });

  it("월·일만 있으면 올해로 넣고 지난 날은 내년으로 넘긴다", () => {
    const today = new Date(2026, 7, 14);
    const future = parseIntakeText("8월 20일    부터    9월 1일", "customer", today);
    assert.equal(future.moveInFrom, "2026-08-20");
    assert.equal(future.moveInTo, "2026-09-01");
    assert.equal(future.moveInImmediate, undefined);

    const past = parseIntakeText("1월 5일 부터 2월 10일", "customer", today);
    assert.equal(past.moveInFrom, "2027-01-05");
    assert.equal(past.moveInTo, "2027-02-10");

    const wrap = parseIntakeText("12월 1일부터 1월 15일", "property", today);
    assert.equal(wrap.moveInFrom, "2026-12-01");
    assert.equal(wrap.moveInTo, "2027-01-15");

    const todaySame = parseIntakeText("8월 14일", "customer", today);
    assert.equal(todaySame.moveInFrom, "2026-08-14");
    assert.equal(todaySame.moveInTo, "2026-08-14");

    const yesterday = parseIntakeText("8월 13일", "customer", today);
    assert.equal(yesterday.moveInFrom, "2027-08-13");

    const pastYear = parseIntakeText("2026년 1월 5일", "customer", today);
    assert.equal(pastYear.moveInFrom, "2027-01-05");
    assert.equal(pastYear.moveInTo, "2027-01-05");

    const pastYmdSlash = parseIntakeText("원룸 전세 2026/01/05", "customer", today);
    assert.equal(pastYmdSlash.moveInFrom, "2027-01-05");

    const tildeDay = parseIntakeText("8월 20일 ~ 9월 1일", "customer", today);
    assert.equal(tildeDay.moveInFrom, "2026-08-20");
    assert.equal(tildeDay.moveInTo, "2026-09-01");
    assert.equal(tildeDay.deposit, undefined);

    const tildeSlash = parseIntakeText("8/20 ~ 9/1", "property", today);
    assert.equal(tildeSlash.moveInFrom, "2026-08-20");
    assert.equal(tildeSlash.moveInTo, "2026-09-01");
  });

  it("기간 연결 에서·와·과·하고·내지·하이픈을 읽고 점·콤마는 날짜 안으로만 쓴다", () => {
    const today = new Date(2026, 7, 14);
    const expectRange = (raw: string) => {
      const parsed = parseIntakeText(raw, "property", today);
      assert.equal(parsed.moveInFrom, "2026-08-20", raw);
      assert.equal(parsed.moveInTo, "2026-09-01", raw);
    };
    expectRange("8월 20일에서 9월 1일");
    expectRange("8월 20일과 9월 1일");
    expectRange("8월 20일 와 9월 1일");
    expectRange("8월 20일하고 9월 1일");
    expectRange("8월 20일 내지 9월 1일");
    expectRange("8월 20일-9월 1일");
    expectRange("8/20부터 9/1");
    expectRange("8월 20일부터는 9월 1일까지");
    // 부터 없이 「몇월 몇일 몇월 몇일」만 말해도 시작·끝
    expectRange("8월 20일 9월 1일");
    expectRange("8월20일 9월1일");
    expectRange("8.20 9.1");
    expectRange("8/20 9/1");

    const spoken = parseIntakeText(
      "삼월 일일 사월 십오일",
      "property",
      today,
      "spoken"
    );
    assert.equal(spoken.moveInFrom, "2027-03-01");
    assert.equal(spoken.moveInTo, "2027-04-15");

    const spokenSpaced = parseIntakeText(
      "삼 월 일 일 사 월 십오 일",
      "property",
      today,
      "spoken"
    );
    assert.equal(spokenSpaced.moveInFrom, "2027-03-01");
    assert.equal(spokenSpaced.moveInTo, "2027-04-15");

    const mixed = parseIntakeText(
      "3월 일일 4월 십오일",
      "property",
      today,
      "spoken"
    );
    assert.equal(mixed.moveInFrom, "2027-03-01");
    assert.equal(mixed.moveInTo, "2027-04-15");

    const yyRange = parseIntakeText("26.08.20~26.09.01", "property", today);
    assert.equal(yyRange.moveInFrom, "2026-08-20");
    assert.equal(yyRange.moveInTo, "2026-09-01");

    const dotted = parseIntakeText("원룸 전세 8.25", "customer", today);
    assert.equal(dotted.moveInFrom, "2026-08-25");
    assert.equal(dotted.moveInTo, "2026-08-25");

    const commaDay = parseIntakeText("원룸 전세 8,25", "customer", today);
    assert.equal(commaDay.moveInFrom, "2026-08-25");

    const hyphenDay = parseIntakeText("원룸 전세 8-25", "customer", today);
    assert.equal(hyphenDay.moveInFrom, "2026-08-25");
  });

  it("1000/50은 보증금·월세, 없는 날짜는 버린다", () => {
    const today = new Date(2026, 7, 14);
    const money = parseIntakeText("원룸 1000/50", "customer", today);
    assert.equal(money.deposit, 1000);
    assert.equal(money.monthlyRent, 50);
    assert.equal(money.dealType, "월세");
    assert.equal(money.moveInFrom, undefined);

    const day = parseIntakeText("원룸 전세 9/31", "customer", today);
    assert.equal(day.deposit, undefined);
    assert.equal(day.monthlyRent, undefined);
    assert.equal(day.moveInFrom, undefined);
    assert.equal(day.moveInTo, undefined);

    const hangulInvalid = parseIntakeText("원룸 전세 9월 31일", "customer", today);
    assert.equal(hangulInvalid.moveInFrom, undefined);

    const both = parseIntakeText("투룸 1000/50 9/31", "customer", today);
    assert.equal(both.deposit, 1000);
    assert.equal(both.monthlyRent, 50);
    assert.equal(both.moveInFrom, undefined);

    const range = parseIntakeText("8/20 9/1", "property", today);
    assert.equal(range.moveInFrom, "2026-08-20");
    assert.equal(range.moveInTo, "2026-09-01");
    assert.equal(range.deposit, undefined);

    const calendarMoney = parseIntakeText("원룸 12/50", "customer", today);
    assert.equal(calendarMoney.deposit, undefined);
    assert.equal(calendarMoney.monthlyRent, undefined);
    assert.equal(calendarMoney.moveInFrom, undefined);

    const overMonth = parseIntakeText("원룸 13/20", "customer", today);
    assert.equal(overMonth.deposit, undefined);
    assert.equal(overMonth.monthlyRent, undefined);
    assert.equal(overMonth.moveInFrom, undefined);

    const mixed = parseIntakeText("01011111111 1000/20 12/1", "customer", today);
    assert.equal(mixed.phone, "010-1111-1111");
    assert.equal(mixed.deposit, 1000);
    assert.equal(mixed.monthlyRent, 20);
    assert.equal(mixed.dealType, "월세");
    assert.equal(mixed.moveInFrom, "2026-12-01");
    assert.equal(mixed.maintenanceFee, undefined);

    const withFee = parseIntakeText("01011111111 1000/20/5 12/1", "property", today);
    assert.equal(withFee.deposit, 1000);
    assert.equal(withFee.monthlyRent, 20);
    assert.equal(withFee.maintenanceFee, 5);
    assert.equal(withFee.dealType, "월세");
    assert.equal(withFee.moveInFrom, "2026-12-01");
    assert.equal(withFee.phone, "010-1111-1111");
    assert.notEqual(withFee.phone, "100-0205");
    assert.equal(withFee.jibun, undefined);

    const moneyOnly = parseIntakeText("1000/20/5", "property", today);
    assert.equal(moneyOnly.deposit, 1000);
    assert.equal(moneyOnly.monthlyRent, 20);
    assert.equal(moneyOnly.maintenanceFee, 5);
    assert.equal(moneyOnly.phone, undefined);
    assert.equal(moneyOnly.jibun, undefined);

    const noDongJibun = parseIntakeText("원룸 전세 123-4", "property", today);
    assert.equal(noDongJibun.jibun, undefined);
    assert.equal(
      applyIntakeToProperty(createEmptyProperty(), withFee).maintenanceFee,
      5
    );

    const pairNotFee = parseIntakeText("원룸 1000/5", "property", today);
    assert.equal(pairNotFee.deposit, 1000);
    assert.equal(pairNotFee.monthlyRent, 5);
    assert.equal(pairNotFee.maintenanceFee, 0);
    assert.equal(pairNotFee.dealType, "월세");
    const cleared = applyIntakeToProperty(
      { ...createEmptyProperty(), maintenanceFee: 10 },
      pairNotFee
    );
    assert.equal(cleared.maintenanceFee, 0);

    const customerIgnoresFee = parseIntakeText("원룸 1000/20/5", "customer", today);
    assert.equal(customerIgnoresFee.deposit, 1000);
    assert.equal(customerIgnoresFee.monthlyRent, 20);
    assert.equal(customerIgnoresFee.maintenanceFee, undefined);

    const dotMoney = parseIntakeText("원룸 1000.50", "customer", today);
    assert.equal(dotMoney.deposit, 1000);
    assert.equal(dotMoney.monthlyRent, 50);
    assert.equal(dotMoney.dealType, "월세");

    const commaMoney = parseIntakeText("원룸 1000,50", "customer", today);
    assert.equal(commaMoney.deposit, 1000);
    assert.equal(commaMoney.monthlyRent, 50);

    const thousand = parseIntakeText("원룸 1,000/50", "customer", today);
    assert.equal(thousand.deposit, 1000);
    assert.equal(thousand.monthlyRent, 50);

    const dotDay = parseIntakeText("원룸 전세 9.31", "customer", today);
    assert.equal(dotDay.moveInFrom, undefined);
    assert.equal(dotDay.deposit, undefined);

    const eok = parseIntakeText("원룸 전세 1.5억", "customer", today);
    assert.equal(eok.deposit, 15000);
    assert.equal(eok.moveInFrom, undefined);

    const eokRange = parseIntakeText("원룸 전세 1억~2억", "customer", today);
    assert.equal(eokRange.deposit, 10000);
    assert.equal(eokRange.depositTo, 20000);
    assert.equal(eokRange.moveInFrom, undefined);

    const compoundBaek = parseIntakeText(
      "원룸 전세 보증금 2억9천2백10만",
      "customer",
      today
    );
    assert.equal(compoundBaek.deposit, 29210);
    const compoundSpaced = parseIntakeText(
      "원룸 전세 보증금 2억 9천 2백 10만",
      "customer",
      today
    );
    assert.equal(compoundSpaced.deposit, 29210);
    const compoundSpoken = parseIntakeText(
      "원룸 전세 이억구천이백십만",
      "customer",
      today,
      "spoken"
    );
    assert.equal(compoundSpoken.deposit, 29210);
    const compoundManOnly = parseIntakeText(
      "원룸 전세 2억 9210만",
      "customer",
      today
    );
    assert.equal(compoundManOnly.deposit, 29210);

    // 음성·속기: 만 없이 3억6500 → 3억 6500만. 5억9(한 자리)는 계속 스킵
    const bareManAfterEok = parseIntakeText(
      "아파트 매매 3억6500",
      "customer",
      today
    );
    assert.equal(bareManAfterEok.deposit, 36500);
    assert.equal(bareManAfterEok.dealType, "매매");
    const bareManSpaced = parseIntakeText(
      "아파트 매매 3억 6500",
      "customer",
      today
    );
    assert.equal(bareManSpaced.deposit, 36500);
    const bareManProperty = parseIntakeText(
      "아파트 매매가 3억6500 성내동",
      "property",
      today
    );
    assert.equal(bareManProperty.deposit, 36500);
    const bareManTalkOnly = parseIntakeText(
      "3억6500",
      "customer",
      today,
      "spoken"
    );
    assert.equal(bareManTalkOnly.deposit, 36500);
    const stillSkipHalf = parseIntakeText(
      "원룸 전세 5억9",
      "customer",
      today
    );
    assert.equal(stillSkipHalf.deposit, undefined);

    const twoEok = parseIntakeText("원룸 전세 1억 암사동 2억", "customer", today);
    assert.equal(twoEok.deposit, 10000);
    assert.equal(twoEok.depositTo, undefined);
    assert.equal(twoEok.dong, "암사동");
    const adjacentEok = parseIntakeText("원룸 전세 1억 2억", "customer", today);
    assert.equal(adjacentEok.deposit, 10000);
    assert.equal(adjacentEok.depositTo, 20000);

    const bareRange = parseIntakeText("원룸 전세 1~2", "customer", today);
    assert.equal(bareRange.deposit, undefined);
    assert.equal(bareRange.depositTo, undefined);
    assert.equal(bareRange.monthlyRent, undefined);
    assert.equal(bareRange.moveInFrom, undefined);

    const dayOnlyNotDate = parseIntakeText("원룸 20~25", "customer", today);
    assert.equal(dayOnlyNotDate.deposit, undefined);
    assert.equal(dayOnlyNotDate.monthlyRent, 20);
    assert.equal(dayOnlyNotDate.monthlyRentTo, 25);
    assert.equal(dayOnlyNotDate.dealType, "월세");
    assert.equal(dayOnlyNotDate.moveInFrom, undefined);

    const depositRange = parseIntakeText("원룸 전세 500~1000", "customer", today);
    assert.equal(depositRange.deposit, 500);
    assert.equal(depositRange.depositTo, 1000);
    assert.equal(depositRange.monthlyRent, undefined);

    const labeledSmall = parseIntakeText("원룸 월세 보증 80 월 20", "customer", today);
    assert.equal(labeledSmall.deposit, 80);
    assert.equal(labeledSmall.monthlyRent, 20);

    const labeledWolse = parseIntakeText(
      "원룸 월세 보증금 1억 월세 50",
      "customer",
      today
    );
    assert.equal(labeledWolse.deposit, 10000);
    assert.equal(labeledWolse.monthlyRent, 50);
    const labeledWolseMan = parseIntakeText(
      "원룸 월세 보 5000 월세 60만",
      "customer",
      today
    );
    assert.equal(labeledWolseMan.deposit, 5000);
    assert.equal(labeledWolseMan.monthlyRent, 60);
    const wolseOnlyAgain = parseIntakeText(
      "원룸 월세 성내동 월세 80",
      "customer",
      today
    );
    assert.equal(wolseOnlyAgain.monthlyRent, 80);
    assert.equal(wolseOnlyAgain.dealType, "월세");

    const wolseSlashPair = parseIntakeText(
      "원룸 월세 2000/65 강동구 천호동",
      "customer",
      today
    );
    assert.equal(wolseSlashPair.dealType, "월세");
    assert.equal(wolseSlashPair.deposit, 2000);
    assert.equal(wolseSlashPair.monthlyRent, 65);

    const wolseSlashTight = parseIntakeText(
      "원룸 월세2000/65",
      "customer",
      today
    );
    assert.equal(wolseSlashTight.deposit, 2000);
    assert.equal(wolseSlashTight.monthlyRent, 65);

    const wolseDateNotRent = parseIntakeText(
      "원룸 월세 3월 1일",
      "property",
      today
    );
    assert.equal(wolseDateNotRent.monthlyRent, undefined);
    assert.equal(wolseDateNotRent.moveInFrom?.slice(5), "03-01");

    const spokenSmall = parseIntakeText(
      "원룸 월세 보증금 오천 월세 오십",
      "customer",
      today,
      "spoken"
    );
    assert.equal(spokenSmall.deposit, 5000);
    assert.equal(spokenSmall.monthlyRent, 50);
    const spokenCheonSlash = parseIntakeText(
      "원룸 월세 오천/오십",
      "customer",
      today,
      "spoken"
    );
    assert.equal(spokenCheonSlash.deposit, 5000);
    assert.equal(spokenCheonSlash.monthlyRent, 50);
    const spokenWol = parseIntakeText(
      "원룸 월세 성내동 월 오십",
      "customer",
      today,
      "spoken"
    );
    assert.equal(spokenWol.monthlyRent, 50);
    const jeonsega = parseIntakeText(
      "원룸 전세 성내동 전세가 2억",
      "customer",
      today
    );
    assert.equal(jeonsega.dealType, "전세");
    assert.equal(jeonsega.deposit, 20000);
    const jeonsegaCheon = parseIntakeText(
      "원룸 전세 성내동 전세가 2억 5천",
      "customer",
      today
    );
    assert.equal(jeonsegaCheon.deposit, 25000);

    const skipTinyMan = parseIntakeText("원룸 12만", "customer", today);
    assert.equal(skipTinyMan.deposit, undefined);

    const keepMan = parseIntakeText("원룸 전세 1000만", "customer", today);
    assert.equal(keepMan.deposit, 1000);

    const skipTinyTriple = parseIntakeText("원룸 12/50/5", "property", today);
    assert.equal(skipTinyTriple.deposit, undefined);
    assert.equal(skipTinyTriple.monthlyRent, undefined);
    assert.equal(skipTinyTriple.maintenanceFee, undefined);

    const skipOddDeposit = parseIntakeText("원룸 월세 509", "customer", today);
    assert.equal(skipOddDeposit.deposit, undefined);
    const skipOdd501 = parseIntakeText("원룸 전세 501", "customer", today);
    assert.equal(skipOdd501.deposit, undefined);
    const skipOddLabeled = parseIntakeText("원룸 월세 보증 509", "customer", today);
    assert.equal(skipOddLabeled.deposit, undefined);

    const keepRound = parseIntakeText("원룸 전세 500", "customer", today);
    assert.equal(keepRound.deposit, 500);
    const keepTripleOne = parseIntakeText("원룸 전세 111", "customer", today);
    assert.equal(keepTripleOne.deposit, 111);

    const sale509Apt = parseIntakeText("아파트 매매 509", "customer", today);
    assert.equal(sale509Apt.deposit, undefined);
    assert.equal(sale509Apt.dealType, "매매");
    const sale501Bare = parseIntakeText("매가 501", "property", today);
    assert.equal(sale501Bare.deposit, undefined);
    const sale509Bldg = parseIntakeText("건물 매매 509", "property", today);
    assert.equal(sale509Bldg.deposit, 5090000);
    const sale501Land = parseIntakeText("토지 매가 501", "property", today);
    assert.equal(sale501Land.deposit, 5010000);
    const saleEok = parseIntakeText("건물 매매 509억", "property", today);
    assert.equal(saleEok.deposit, 5090000);
    const saleFive = parseIntakeText("아파트 매매 5", "customer", today);
    assert.equal(saleFive.deposit, 50000);
    const saleTwelve = parseIntakeText("원룸 매매 12", "customer", today);
    assert.equal(saleTwelve.deposit, 120000);
    const saleAptFifty = parseIntakeText("아파트 매매 50", "customer", today);
    assert.equal(saleAptFifty.deposit, 500000);
    const saleThreeRoom = parseIntakeText("3룸+ 매매 80", "customer", today);
    assert.equal(saleThreeRoom.deposit, 800000);
    const saleAptJeonse = parseIntakeText("아파트 전세 12억", "customer", today);
    assert.equal(saleAptJeonse.deposit, 120000);
    const skipSmallSaleHigh = parseIntakeText("원룸 매매 80", "customer", today);
    assert.equal(skipSmallSaleHigh.deposit, undefined);
    const skipShopSaleHigh = parseIntakeText("상가 매매 80", "property", today);
    assert.equal(skipShopSaleHigh.deposit, undefined);
    const keepExplicitEok = parseIntakeText("원룸 매매 80억", "customer", today);
    assert.equal(keepExplicitEok.deposit, 800000);
    const skipHalfEok = parseIntakeText("원룸 전세 5억9", "customer", today);
    assert.equal(skipHalfEok.deposit, undefined);

    const eokCheon = parseIntakeText("원룸 전세 5억 9천", "customer", today);
    assert.equal(eokCheon.deposit, 59000);
    const eokPoint = parseIntakeText("원룸 전세 5.9억", "customer", today);
    assert.equal(eokPoint.deposit, 59000);
    const eokPointLong = parseIntakeText("아파트 매매 2.52억", "customer", today);
    assert.equal(eokPointLong.dealType, "매매");
    assert.equal(eokPointLong.deposit, 25200);
    const eokPointJeonse = parseIntakeText("원룸 전세 2.52억", "customer", today);
    assert.equal(eokPointJeonse.deposit, 25200);
    const saleEokCheon = parseIntakeText("건물 매매 5억 9천", "property", today);
    assert.equal(saleEokCheon.deposit, 59000);
    const spokenMix = parseIntakeText(
      "원룸 매매 3억 오천",
      "customer",
      today,
      "spoken"
    );
    assert.equal(spokenMix.deposit, 35000);
    const spokenAll = parseIntakeText(
      "원룸 매매 삼억 오천",
      "customer",
      today,
      "spoken"
    );
    assert.equal(spokenAll.deposit, 35000);
    const saleSpoken = parseIntakeText(
      "매매가 삼억오천",
      "property",
      today,
      "spoken"
    );
    assert.equal(saleSpoken.deposit, 35000);

    const shopSale = parseIntakeText("상가 매매 509", "property", today);
    assert.equal(shopSale.deposit, undefined);

    const unlabeledLowRange = parseIntakeText("원룸 80~100", "customer", today);
    assert.equal(unlabeledLowRange.deposit, undefined);
    assert.equal(unlabeledLowRange.monthlyRent, 80);
    assert.equal(unlabeledLowRange.monthlyRentTo, 100);
    const labeledDepositRange = parseIntakeText(
      "원룸 전세 80~100",
      "customer",
      today
    );
    assert.equal(labeledDepositRange.deposit, 80);
    assert.equal(labeledDepositRange.depositTo, 100);
    assert.equal(labeledDepositRange.monthlyRent, undefined);

    const feeOverRent = parseIntakeText("원룸 1000/20/25", "property", today);
    assert.equal(feeOverRent.deposit, 1000);
    assert.equal(feeOverRent.monthlyRent, 20);
    assert.equal(feeOverRent.maintenanceFee, 25);
  });

  it("매물 임대가능일 기간을 칸에 넣는다", () => {
    const today = new Date(2026, 7, 14);
    const parsed = parseIntakeText("원룸 전세 8월 20일 부터 9월 1일", "property", today);
    const next = applyIntakeToProperty(createEmptyProperty(), parsed);
    assert.equal(next.moveInFrom, "2026-08-20");
    assert.equal(next.moveInTo, "2026-09-01");
    assert.equal(next.moveInSingle, false);
  });

  it("고객 메시지에서 전화·보증금 2억을 넣고 날짜를 월세로 보지 않는다", () => {
    const parsed = parseIntakeText(
      `010-1234-5678
원룸 전세 강동구 암사동
보증금 2억
8월 20일    부터    9월 1일
대출 유 보증보험 유 주차 무 엘베 유
팀공유 유
디딤돌 천호동`,
      "customer"
    );
    assert.equal(parsed.phone, "010-1234-5678");
    assert.equal(parsed.deposit, 20000);
    assert.equal(parsed.monthlyRent, undefined);
    assert.equal(parsed.dealType, "전세");
  });

  it("하이픈 없는 11·10·9·7자리 전화도 넣는다", () => {
    assert.equal(
      parseIntakeText("01012345678 원룸 전세", "customer").phone,
      "010-1234-5678"
    );
    assert.equal(
      parseIntakeText("0101234567 원룸 전세", "customer").phone,
      "010-123-4567"
    );
    assert.equal(
      parseIntakeText("021234567 원룸 전세", "customer").phone,
      "02-123-4567"
    );
    assert.equal(
      parseIntakeText("4721313 원룸 전세", "customer").phone,
      "472-1313"
    );
    assert.equal(
      parseIntakeText("01011111111 원룸 전세", "customer").phone,
      "010-1111-1111"
    );
    assert.equal(
      parseIntakeText("020000000 원룸 전세", "customer").phone,
      "02-000-0000"
    );
    assert.equal(
      parseIntakeText("0559339493 원룸 전세", "customer").phone,
      "055-933-9493"
    );
    assert.equal(
      parseIntakeText("전세 01011111111 원룸", "customer").phone,
      "010-1111-1111"
    );
    assert.equal(
      parseIntakeText("전세 01011111111 원룸", "customer").deposit,
      undefined
    );
    assert.equal(
      parseIntakeText("010－1111－1111", "customer").phone,
      "010-1111-1111"
    );
    assert.equal(
      parseIntakeText("01011111111", "customer").phone,
      "010-1111-1111"
    );
    assert.equal(
      parseIntakeText(
        "공일공에 일일일일 일일일일 원룸 전세",
        "customer",
        new Date(),
        "spoken"
      ).phone,
      "010-1111-1111"
    );
    assert.equal(
      applyIntakeToProperty(
        createEmptyProperty(),
        parseIntakeText("01011111111 원룸 전세", "property")
      ).tenantPhone,
      "010-1111-1111"
    );
    assert.equal(formatPhoneInput("+82 10-1111-1111"), "010-1111-1111");
    assert.equal(formatPhoneInput("821011111111"), "010-1111-1111");
    assert.equal(formatPhoneInput("1011111111"), "010-1111-1111");
    assert.equal(
      parseIntakeText("+82 10-1111-1111 원룸 전세", "customer").phone,
      "010-1111-1111"
    );
    assert.equal(
      parseIntakeText("1011111111 원룸 전세", "customer").phone,
      "010-1111-1111"
    );
  });

  it("유/무는 순서와 표현에 상관없이 각각 읽는다", () => {
    const parsed = parseIntakeText(
      "주차 무 대출 유 보증보험 무 엘베 무",
      "property"
    );
    assert.equal(parsed.loan, "유");
    assert.equal(parsed.insurance, "무");
    assert.equal(parsed.parking, "무");
    assert.equal(parsed.elevator, "무");
  });

  it("매매가·날짜 수정·유/무를 칸에 넣는다", () => {
    const today = new Date(2026, 7, 15);
    const parsed = parseIntakeText(
      "원룸 매매 성내동 매매가 1억 8월 25일 8월 25일부터 8월 15일 아니 9월 15일 대출 무 보증보험 무 주차 무 엘베 무",
      "property",
      today
    );
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.dealType, "매매");
    assert.equal(parsed.deposit, 10000);
    assert.equal(parsed.moveInFrom, "2026-09-15");
    assert.equal(parsed.loan, "무");
    assert.equal(parsed.insurance, "무");
    assert.equal(parsed.parking, "무");
    assert.equal(parsed.elevator, "무");
    assert.doesNotMatch(parsed.notes, /1억|대출|보증보험|주차|엘베/);
  });

  it("구어체·오타에 가/불·가능/불가 표현도 칸에 넣는다", () => {
    const parsed = parseIntakeText(
      "원룸 전세 암사동 대출 가 보증보험 불 주차 가능 엘베 없어요",
      "property"
    );
    assert.equal(parsed.loan, "유");
    assert.equal(parsed.insurance, "무");
    assert.equal(parsed.parking, "유");
    assert.equal(parsed.elevator, "무");
    assert.doesNotMatch(parsed.notes, /대출|보증|주차|엘베/);
  });

  it("구어체·오타에 가까운 유/무 표현도 칸에 넣는다", () => {
    const parsed = parseIntakeText(
      "원룸 전세 암사동 대출 안돼요 보증보험 불가 주차 안됨 엘베 없어요",
      "property"
    );
    assert.equal(parsed.loan, "무");
    assert.equal(parsed.insurance, "무");
    assert.equal(parsed.parking, "무");
    assert.equal(parsed.elevator, "무");
    assert.doesNotMatch(parsed.notes, /대출|보증|주차|엘베/);
  });

  it("엘베는 없어도 되는데는 칸이 아니라 희망이고, 엘베 유는 남긴다", () => {
    const hopeOnly = parseIntakeText(
      "원룸 전세 2억 암사동 엘베는 없어도되는데 있으면 좋아요",
      "customer"
    );
    assert.equal(hopeOnly.elevator, undefined);
    assert.notEqual(hopeOnly.name, "엘베는");
    assert.notEqual(hopeOnly.name, "없어도되는데");

    const both = parseIntakeText(
      "원룸 월세 2000/65 강동구 천호동 엘리베이터 유 엘베는 없어도되는데 있으면 좋아요",
      "customer"
    );
    assert.equal(both.elevator, "유");
    assert.equal(both.deposit, 2000);
    assert.equal(both.monthlyRent, 65);
  });

  it("매매 1억(가 없음)도 거래가액 칸에 넣는다", () => {
    const parsed = parseIntakeText(
      "원룸 매매 강동구 성내동 매매 1억",
      "property"
    );
    assert.equal(parsed.roomType, "원룸");
    assert.equal(parsed.dealType, "매매");
    assert.equal(parsed.deposit, 10000);
    assert.doesNotMatch(parsed.notes, /1억|매매/);
  });

  it("매매가 1억원·8월25부터 구어체 날짜도 칸에 넣는다", () => {
    const today = new Date(2026, 7, 15);
    const parsed = parseIntakeText(
      "원룸 매매 성내동 매매가 1억원 8월25부터 9월15 대출 무",
      "property",
      today
    );
    assert.equal(parsed.deposit, 10000);
    assert.equal(parsed.moveInFrom, "2026-08-25");
    assert.equal(parsed.moveInTo, "2026-09-15");
    assert.equal(parsed.loan, "무");
    assert.doesNotMatch(parsed.notes, /1억|대출/);
  });

  it("현장 매매 메시지: 주소·매매가·실입주·단지명·설명", () => {
    const today = new Date(2026, 3, 15);
    const parsed = parseIntakeText(
      [
        "천호동 314-7 제이디파크빌 403호",
        "방2 거실 주방 화장실 다용도실",
        "엘레베이터 주차",
        "매매 32,000만원 실입주 가능",
        "(이사 협의 2~3개월)",
        "26.04.22",
      ].join("\n"),
      "property",
      today
    );
    assert.equal(parsed.dong, "천호동");
    assert.equal(parsed.jibun, "314-7");
    assert.equal(parsed.roomNo, "403호");
    assert.equal(parsed.buildingName, "제이디파크빌");
    assert.equal(parsed.roomCount, 2);
    assert.equal(parsed.dealType, "매매");
    assert.equal(parsed.deposit, 32000);
    assert.equal(parsed.moveInImmediate, true);
    assert.match(parsed.notes, /제이디파크빌/);
    assert.match(parsed.notes, /거실/);
    assert.match(parsed.notes, /이사 협의/);
    assert.doesNotMatch(parsed.notes, / \/ /);
    assert.match(parsed.notes, /\n/);
  });

  it("현장 월세 메시지: YY.MM.DD·1억/110/관5·주차1대", () => {
    const today = new Date(2026, 3, 15);
    const parsed = parseIntakeText(
      [
        "26.04.22",
        "성내동 427-63 201호",
        "방2화1",
        "1억/110/관5",
        "현임차인거주중 / 주차1대가능",
      ].join("\n"),
      "property",
      today
    );
    assert.equal(parsed.moveInFrom, "2026-04-22");
    assert.equal(parsed.dong, "성내동");
    assert.equal(parsed.jibun, "427-63");
    assert.equal(parsed.roomNo, "201호");
    assert.equal(parsed.roomCount, 2);
    assert.equal(parsed.bathroomCount, 1);
    assert.equal(parsed.dealType, "월세");
    assert.equal(parsed.deposit, 10000);
    assert.equal(parsed.monthlyRent, 110);
    assert.equal(parsed.maintenanceFee, 5);
    assert.equal(parsed.parking, "유");
    assert.match(parsed.notes, /현임차인/);
  });

  it("오피스텔은 유형 칸이고 방·화 기본 1·1이다", () => {
    const parsed = parseIntakeText("오피스텔 월세 성내동", "property");
    assert.equal(parsed.roomType, "오피스텔");
    assert.equal(parsed.roomCount, 1);
    assert.equal(parsed.bathroomCount, undefined);
    const applied = applyIntakeToProperty(createEmptyProperty(), parsed);
    assert.equal(applied.roomType, "오피스텔");
    assert.equal(applied.roomCount, 1);
    assert.equal(applied.bathroomCount, 1);

    const withRooms = parseIntakeText("오피 투룸 전세", "property");
    assert.equal(withRooms.roomType, "오피스텔");
    assert.equal(withRooms.roomCount, 2);

    const office = parseIntakeText("오피스 월세", "property");
    assert.equal(office.roomType, "사무실");
  });

  it("빌라 2룸은 투룸이고 빌라는 내용이다", () => {
    const parsed = parseIntakeText("빌라 2룸 전세 암사동", "property");
    assert.equal(parsed.roomType, "투룸");
    assert.match(parsed.notes, /빌라/);
  });

  it("주·임·세를 주차·주인·세입자로 가른다", () => {
    const park = parseIntakeText("원룸 전세 암사동 주1대 엘베", "property");
    assert.equal(park.parking, "유");

    const juOnly = parseIntakeText("원룸 전세 주", "property");
    assert.equal(juOnly.parking, "유");

    const owner = parseIntakeText(
      "원룸 전세 암사동 주 010-2222-3333",
      "property"
    );
    assert.equal(owner.landlordPhone, "010-2222-3333");
    assert.notEqual(owner.parking, "유");

    const landlord = parseIntakeText(
      "원룸 전세 임 010-1111-2222",
      "property"
    );
    assert.equal(landlord.landlordPhone, "010-1111-2222");

    const tenant = parseIntakeText(
      "원룸 전세 세 010-3333-4444",
      "property"
    );
    assert.equal(tenant.tenantPhone, "010-3333-4444");

    const jeonsePhone = parseIntakeText(
      "원룸 전세 010-1234-5678",
      "property"
    );
    assert.equal(jeonsePhone.tenantPhone, "010-1234-5678");
    assert.equal(jeonsePhone.landlordPhone, undefined);
  });

  it("짧은 관·엘·보·매와 어중간한 점은 칸/내용으로 가른다", () => {
    const fee = parseIntakeText("원룸 월세 1억.110.관5", "property");
    assert.equal(fee.deposit, 10000);
    assert.equal(fee.monthlyRent, 110);
    assert.equal(fee.maintenanceFee, 5);

    const sale = parseIntakeText("아파트 매 3.2억 성내동", "property");
    assert.equal(sale.dealType, "매매");
    assert.equal(sale.deposit, 32000);

    const today = new Date(2026, 3, 15);
    const dotted = parseIntakeText("원룸 전세 8.25", "customer", today);
    assert.equal(dotted.moveInFrom, "2026-08-25");
    assert.equal(dotted.moveInTo, "2026-08-25");

    const clearDate = parseIntakeText("원룸 전세 26.04.22", "customer", today);
    assert.equal(clearDate.moveInFrom, "2026-04-22");
  });
});
