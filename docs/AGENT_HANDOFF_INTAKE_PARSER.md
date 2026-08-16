# Agent Handoff: Intake Parser · Sample Collection · AI Strategy

> **용도:** 다음 Cursor Agent가 이 파일을 읽고 대화·작업을 이어가기 위한 문서.  
> **작성:** 2026-08-16 (커밋 `d2897fb` on `cursor/intake-samples-admin-3f06` 기준)  
> **동기화:** 2026-08-16 — 이 브랜치는 `origin/main` `a15ba82` 위에 리베이스됨. 워크스페이스도 이 브랜치로 맞춤. 다음 대화는 이 파일 + `.cursor/rules/intake-parser-handoff.mdc`를 읽으면 이어감.

---

## 0. 빠른 시작 (다음 Agent에게)

1. 브랜치: `cursor/intake-samples-admin-3f06` — **최신 `main`(`a15ba82`) 포함** + 파서/OCR/수집 커밋 (pushed)
2. PR: [#7](https://github.com/500stayviet/direction/pull/7) 메시지 파서, [#8](https://github.com/500stayviet/direction/pull/8) 샘플 수집·관리자 파서 탭
3. 배포 전: `supabase/migrations/021_intake_parse_samples.sql` Supabase 적용 필수
4. **AI:** 메시지·사진 leftover만 DeepSeek V4 Flash (`POST /api/intake-ai`). 마이크 제외. 실패 시 룰 결과만 반영.
5. **마이크:** AI 불필요 — `IntakeTalkModal` / `intakeSteps.ts` 건드리지 말 것 (main의 talk 수정은 이미 이 브랜치에 있음)

---

## 1. 입력 경로별 구조

| 경로 | 처리 | AI |
|------|------|-----|
| **메시지** | `IntakeMessageModal` → `parseIntakeText` → leftover면 `/api/intake-ai` | DeepSeek Flash |
| **사진** | `IntakePhotoPicker` → OCR → `normalizeOcrIntakeText` → 동일 | DeepSeek Flash |
| **마이크** | `IntakeTalkModal` + `intakeSteps.ts` 단계별 | **사용 안 함** (사용자 확정) |

---

## 2. 구현 완료 (코드)

### 2.1 메시지 파서 — `src/lib/intakeParse.ts` (PR #7)

현장 매물 메시지 형식 지원:

- `26.04.22` → `2026-04-22`
- `1억/110/관5`, `관N` 관리비 약어
- `실입주 가능` → 즉시입주 (**날짜와 같으면 실입주 우선**)
- `주차1대가능` → 주차 가능
- 단지명, 거실/주방, 현임차인, 이사 협의 → **의도 키워드만 메모** (파싱 잔여 텍스트는 메모에 넣지 않음)
- 버그 수정: `이사 협의 2~3개월`이 2억 금액으로 오인되던 문제

테스트: `src/lib/intakeParse.test.ts` — 현장 매매·월세 예시 2건

### 2.2 사진 OCR — `src/lib/intakeOcrNormalize.ts`

메시지와 동일 파이프라인:

- `26 . 04 . 22`, `1 억 / 110 / 관 5`, `32 , 000 만`, `방 2 화 1`
- 단지명 공백 제거 (`제이디 파크 빌` → `제이디파크빌`)
- 마지막에 `normalizeIntakeInput` 호출
- OCR 폼 라벨 제거 시 `주차`, `화장실`, `임차인` 등 **본문 단어가 지워지지 않도록** 라벨 목록에서 제외

테스트: `src/lib/intakeOcrNormalize.test.ts` — OCR 띄어쓰기 시뮬레이션 2건

### 2.3 샘플 수집 + 관리자 UI (PR #8)

**자동 수집**

- `PropertyEditor.tsx`, `CustomerForm.tsx` — **메시지·사진** 반영 시만
- `recordIntakeSample()` → `POST /api/intake-samples/collect`
- 전화·이름 마스킹 후 저장
- **마이크(대화)는 수집하지 않음**

**DB**

- `supabase/migrations/021_intake_parse_samples.sql`
- 테이블: `intake_parse_samples` (raw, parsed jsonb, missing_fields, status: new/exported/reviewed)

**관리자**

- `/admin` 상단바 **이벤트 우측 「파서」** (슈퍼 전용)
- `src/components/admin/IntakeParserAdminPanel.tsx`
- 통계, 샘플 목록, 기간 export (JSON + summary MD), Cursor 프롬프트 복사
- API: `src/app/api/admin/intake-samples/*`, `src/app/api/intake-samples/collect/route.ts`

**핵심 lib**

- `src/lib/intakeSampleCollect.ts`
- `src/lib/intakeSampleExport.ts`

**운영 흐름 (사용자 확정)**

1. 사용 시마다 raw+parsed 자동 수집
2. 원하는 날 관리자 **파서** 탭에서 export
3. Cursor에 붙여 **작업 리스트**만 받기 (코드 수정·커밋은 사람)
4. 반영 후 검토완료 표시

---

## 3. Git · PR

### 브랜치 `cursor/intake-samples-admin-3f06` (`origin/main` `a15ba82` +4, pushed)

```
701020a  Add agent handoff doc for intake parser and AI strategy
d2897fb  Add intake parser sample collection and admin 파서 tab
5e6237c  Align photo OCR normalization with message parser field formats
482ea2a  Improve message parser for field listing formats
```

`main`의 마이크/대화 입력 커밋은 이 브랜치에 이미 포함됨. 로컬 `main`도 `a15ba82`로 fast-forward됨. 다음 작업은 이 브랜치에서 이어갈 것.

### PR

- **#7** — message parser field formats (`cursor/message-parser-field-3f06` — 내용은 위 브랜치에 포함)
- **#8** — intake sample collection + admin 파서 tab

### 테스트

- `npm run test:unit` — 82 tests pass
- `npm run build` — success

---

## 4. 커밋 이후 대화 — 의사결정 (코드 없음)

### 4.1 파서 개선 운영

- 실패 diff 없이 **사용 기록 전부** 수집 → export → Cursor **작업 리스트** → 사람 merge
- PR #8이 이 파이프라인. 자동 merge / Cursor 스케줄 Automation은 **미구현**

### 4.2 외부 데이터

- 카톡형 매물 글 **공개 API/데이터셋 거의 없음**
- 최선: 앱 수집 + 중개사 익명 샘플 30~50건
- Cursor = 분석·개선용, 실시간 칸 채우기 엔진 아님

### 4.3 AI 적용 범위 (사용자 확정)

| 항목 | 결론 |
|------|------|
| **마이크** | AI **안 씀**, 룰(단계별) 유지 |
| **메시지·사진** | 룰 먼저 + (선택) AI |
| **단지명·메모** | **거의 항상 AI 사용** 의향 — 룰 로직 빼고 AI에 맡기기 검토 |
| **금액·유/무·거래** | **룰만** (CS). AI가 덮지 않음 |
| **빈 이름·동·날짜·단지명** | leftover가 분명하면 AI가 **빈 칸만** 채움 |

### 4.4 AI 비용 (DeepSeek V4 Flash, 월 2,000건, 메시지·사진만)

| 방식 | 월 비용 (감) |
|------|--------------|
| 룰만 | ~0원 |
| **단지명+메모만 AI (매번 1회, 200~300자)** | **~500~700원** ← 사용자 후보 |
| 룰 + AI fallback 30% | ~200~400원 |
| 전건 AI (200~300자) | ~700~1,300원 |

- **200자 cap:** ~700~1,000원/월
- **300자 cap:** ~850~1,300원/월
- 예시 매물 글(월세/매매): **~60~100자** → 200~300자 cap 충분

참고: DeepSeek 2026-08-16부터 peak/off-peak 요금 — [공식 Pricing](https://api-docs.deepseek.com/quick_start/pricing)

### 4.5 leftover AI (구현됨)

```
[룰]  금액·날짜·동·지번·호·거래·유/무·방/화 → 칸
[잔여] leftover 200자(사진 280) — 이미 칸/내용에 있으면 호출 생략
[AI]  DeepSeek V4 Flash JSON → 빈 칸 + buildingName/memo만
[실패] 룰 결과 그대로 반영. 관리자 에러 `[AI] …`
```

**룰에서 제거 후보 (AI 안정 후):**

- `extractBuildingNameMemo`
- `INTENT_MEMO_PATTERNS` 기반 메모 추출

**주의:** AI "100%" = 매번 호출 가능, **항상 정확은 아님** (환각·누락)

---

## 5. 다음 Agent 작업 후보

### P0 — 배포

- [ ] PR #7, #8 merge
- [ ] Supabase migration 021 적용
- [ ] 프로덕션 파서 탭·수집 확인

### P1 — DeepSeek leftover (구현됨)

- [x] 메시지·사진만 `POST /api/intake-ai` (`src/lib/intakeAi.ts`, `intakeAiClient.ts`)
- [x] DeepSeek V4 Flash, leftover 200자(사진 280)
- [x] 빈 칸 + `buildingName`/`memo`만. 금액·거래·전화 덮지 않음
- [x] env: `DEEPSEEK_API_KEY` (`.env.example`)
- [x] 실패·잔고·키 없음 → 룰 반영 + 관리자 에러 `[AI] …`
- [x] 마이크·`intakeSteps.ts` 변경 없음
- [ ] 기존 단지명·메모 룰은 AI 안정 후 단계적 제거 검토

### P2 — 선택

- [ ] Cursor Automation (주간 export → 작업 리스트)
- [ ] `docs/parser-reports/`에 Cursor 분석 결과 저장

---

## 6. 예시 입력 (테스트·샘플용)

### 월세

```
26.04.22
성내동 427-63 201호
방2화1
1억/110/관5
현임차인거주중 / 주차1대가능
```

### 매매

```
천호동 314-7 제이디파크빌 403호
방2 거실 주방 화장실 다용도실
엘레베이터 주차
매매 32,000만원 실입주 가능
(이사 협의 2~3개월)
26.04.22
```

---

## 7. 관련 파일 인덱스

| 파일 | 역할 |
|------|------|
| `src/lib/intakeAi.ts` | leftover 추출·빈 칸 병합·패치 검증 |
| `src/lib/intakeAiClient.ts` | 브라우저에서 `/api/intake-ai` 호출 |
| `src/app/api/intake-ai/route.ts` | DeepSeek Flash, 실패 시 `[AI]` 에러 로그 |
| `src/components/IntakeAiBusyOverlay.tsx` | 메시지·사진 반영 대기 화면 |
| `src/lib/intakeOcrNormalize.ts` | OCR 전처리 |
| `src/lib/intakeSampleCollect.ts` | 수집·마스킹 |
| `src/lib/intakeSampleExport.ts` | export·Cursor 프롬프트 |
| `src/lib/intakeSteps.ts` | 마이크 단계 (AI X) |
| `src/components/IntakeTalkModal.tsx` | 마이크 UI |
| `src/components/PropertyEditor.tsx` | 매물 intake + 수집 hook |
| `src/components/CustomerForm.tsx` | 고객 intake + 수집 hook |
| `src/components/admin/IntakeParserAdminPanel.tsx` | 관리자 파서 탭 |
| `src/app/admin/page.tsx` | 파서 nav (이벤트 우측) |
| `docs/parser-reports/README.md` | Cursor 리포트 저장 폴더 |

---

## 8. 다음 Agent 지시 예시 (복붙용)

```
docs/AGENT_HANDOFF_INTAKE_PARSER.md 를 읽고 이어서 작업해줘.

우선순위:
1. PR #7/#8 merge 가능 여부 확인, migration 021
2. (요청 시) 메시지·사진만 DeepSeek Flash로 단지명·memo JSON 추출 API 추가
   - 200~300자 cap, 마이크 건드리지 않음
   - 금액·주소 등 structured 필드는 parseIntakeText 룰 유지
3. AI 안정 후 extractBuildingNameMemo / intent memo 룰 단계적 제거
```

---

*End of handoff document.*
