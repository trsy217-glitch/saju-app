# 사주 리포트 — 출시 안내서

Vercel + Supabase + 토스페이먼츠. 이 순서대로 따라가면 출시됩니다.

```
api/              Vercel 서버리스 함수 (시크릿 키는 여기서만)
  _lib.js           공용 — Supabase 클라이언트, 토스 인증, 가격 조회, 요청 제한
  order.js          주문 생성 (금액은 서버가 결정, 선물하기 포함)
  confirm.js        결제 승인 + 열람 권한 부여
  entitlements.js   열람 권한 조회 + 최초 열람 시각 기록
  refund.js         환불 (관리자 키 필요, 열람 이력 확인)
  webhook.js        토스 웹훅 (가상계좌 입금, 카드사 취소)
  feedback.js       적중 체크 기록과 통계
public/
  home.html         홈 — 상품 3종 + 무료 도구 4종
  index.html        평생사주 (아이보리)
  wealth.html       재물사주 (라벤더)
  destiny.html      인연사주 (핑크·민트)
  tools.html        택일·결정·사람서랍·적중기록
  taekil.html       택일 단독 (검색 유입)
  today.html        오늘의 일진 (검색 유입)
  samjae.html       삼재 계산기 (검색 유입)
  terms.html        이용약관·환불규정·개인정보 처리방침
  success.html      결제 성공 → 승인 호출
  fail.html         결제 실패
  pay.js            결제 프론트 모듈
  manifest.json / sw.js / robots.txt / sitemap.xml
supabase/schema.sql
```

---

## 출시 체크리스트

### ☐ 0단계 — 가장 오래 걸리는 것부터

토스페이먼츠 전자결제는 토스 심사 1~2일, **카드사 심사 최대 14일**입니다.
다만 심사관이 실제 사이트를 보므로 1~3단계를 먼저 끝낸 뒤 신청하세요.

### ☐ 1단계 — Supabase (10분)

1. supabase.com → New project (리전 **Northeast Asia / Seoul**)
2. SQL Editor 에 `supabase/schema.sql` 전체를 붙여넣고 실행
3. Settings → API 에서 복사
   - Project URL
   - **service_role** 키 ← anon 키가 아닙니다

테이블 여섯 개가 생깁니다. products, orders, refunds, webhook_events, feedback, subscriptions.
RLS는 켜져 있고 정책이 없어 브라우저에서는 접근이 전부 막힙니다. 의도한 설정입니다.

### ☐ 2단계 — GitHub + Vercel (10분)

1. GitHub 레포 생성 (**Private** 권장)
2. 이 폴더의 **내용물**을 레포 루트에 업로드
   레포 첫 화면에 `api`, `public`, `vercel.json` 이 바로 보여야 합니다
3. vercel.com → Add New → Project → 레포 선택 → Deploy
4. Settings → Environment Variables 에 등록

| 이름 | 값 |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 |
| `TOSS_SECRET_KEY` | 테스트 키 `test_sk_...` |
| `ADMIN_KEY` | 환불 API용 임의의 긴 문자열 |

5. Settings → **Deployment Protection 을 끄세요**. 켜져 있으면 다른 사람이 못 봅니다.

### ☐ 3단계 — 도메인과 사업자 정보 (필수)

**도메인 연결** — Vercel → Settings → Domains

**치환 세 군데**

| 파일 | 바꿀 것 |
|---|---|
| `public/robots.txt` | `REPLACE_WITH_DOMAIN` → 실제 도메인 |
| `public/sitemap.xml` | `REPLACE_WITH_DOMAIN` → 실제 도메인 (9곳) |
| `public/terms.html` | `__SANGHO__` `__DAEPYO__` `__SAUPJA_NO__` `__TONGSIN_NO__` `__JUSO__` `__TEL__` `__EMAIL__` `__CPO__` `__SHIHAENGIL__` |

terms.html 의 사업자 정보가 비어 있으면 **카드사 심사에서 걸립니다.**

**사업자 쪽 준비**
- 홈택스 → 사업자등록 정정 → 업태 정보통신업 / 종목 전자상거래 소매업 추가
- 정부24 → 통신판매업 변경신고 (취급품목에 디지털콘텐츠 추가)

### ☐ 4단계 — 테스트 결제

토스 개발자센터에서 테스트 키를 받아 치환합니다.

```bash
cd public
sed -i '' 's/test_ck_REPLACE_ME/실제_테스트_클라이언트키/g' index.html wealth.html destiny.html
```

그리고 세 파일의 `window.TEST_MODE = true;` 를 **false** 로 바꿔야 결제창이 뜹니다.

확인할 것 다섯 가지입니다.
- 결제창이 열리고 승인 후 success.html 에서 리포트가 열리는가
- 새로고침해도 열린 상태가 유지되는가
- 다른 브라우저에서 "이메일로 불러오기" 가 되는가
- Supabase `orders` 에 `status = paid` 로 남는가
- 적중 기록이 `feedback` 에 쌓이는가

### ☐ 5단계 — 웹훅 등록

토스 개발자센터 → 웹훅 → `https://도메인/api/webhook`

### ☐ 6단계 — 검색 등록

1. 구글 서치콘솔 → 속성 추가 → 사이트맵 제출
2. 네이버 서치어드바이저 → 사이트 등록 → 사이트맵 제출

색인까지 1~3주 걸립니다. 그 전에는 SNS로 트래픽을 만드세요.

### ☐ 7단계 — 라이브 전환

카드사 심사 통과 후 두 곳을 바꿉니다.
- Vercel 환경변수 `TOSS_SECRET_KEY` → `live_sk_...`
- `public/*.html` 의 클라이언트 키 → `live_ck_...`

마지막으로 `window.TEST_MODE = false` 를 다시 확인하세요.

---

## 상품 구성

| 코드 | 상품 | 가격 |
|---|---|---|
| `life` | 평생사주 30문항 | 29,000원 |
| `wealth` | 재물사주 30문항 | 24,000원 |
| `destiny` | 인연사주 30문항 | 24,000원 |
| `year` | 올해의 운세 | 9,900원 |
| `compat` | 궁합 리포트 | 19,000원 |
| `sub` | 구독 (택일·결정상담·월간리포트) | 4,900원/월 |

가격은 Supabase `products` 테이블에서 관리합니다. 코드를 고치지 않고 가격만 바꿀 수 있고,
서버가 이 값으로 검증하므로 **클라이언트에서 금액을 조작할 수 없습니다.**

무료: 홈, 택일, 오늘의 일진, 삼재, 결정 상담, 사람 서랍, 적중 기록, 궁합 미리보기, 명식 카드, 성향 유형.

---

## 안전장치

| 위험 | 대응 |
|---|---|
| 금액 조작 | 주문 생성·승인 모두 서버가 products 금액으로 검증 |
| 시크릿 키 노출 | 서버 함수에서만 사용, 클라이언트 번들에 없음 |
| 중복 승인 | 이미 paid 인 주문은 재승인 없이 기존 토큰 반환 |
| 웹훅 중복 | webhook_events 의 event_id 로 차단 |
| 무단 환불 | x-admin-key 헤더 검증 |
| 열람 후 환불 요구 | viewed_at 기록으로 근거 확보 |
| DB 직접 접근 | RLS 활성화, 정책 없음 (service_role 만 통과) |
| 요청 폭주 | IP 기준 분당 제한 |

---

## 감수 없이 출시하는 대신 넣은 장치

역술 전문가 감수를 받지 않았습니다. 대신 세 가지로 위험을 낮췄습니다.

1. **두 관점 병기** — 억부법과 조후법을 함께 보여주고, 갈릴 때는 그 사실을 그대로 알립니다.
2. **방법론 고지** — 결제 전 화면에 "어떤 방법으로 읽는지"를 노출하고, 격국론은 반영하지 않았음을 밝힙니다.
3. **적중 기록** — 사용자 피드백이 쌓이면 자주 틀리는 문항을 찾아 고칠 수 있습니다.

출시 후 테스트 참여자에게 "역술원에서 들은 내용과 비슷한가요"를 물어보세요.
열에 일고여덟이 비슷하다고 하면 충분하고, 그렇지 않으면 그때 감수를 받으시면 됩니다.

---

## 알려진 한계

- 격국론 미반영
- 조후용신표의 丙일간 卯월 한 칸은 출처 간 표기가 갈려 확인 필요 (`JOHU_UNCERTAIN`)
- PDF 저장, 카카오 공유 없음
- 구독(`sub`)은 스키마와 상품만 있고 빌링키 자동결제 미구현
- 선물하기는 주문에 기록되지만 수신 메일 발송 미구현
- PWA 아이콘 `icon-192.png` `icon-512.png` 없음

---

## 출시 후 할 일

1. 적중 기록이 쌓이면 자주 "안 맞다"고 체크된 문항을 고칩니다. `report.js` 의 문장 블록만 수정하면 됩니다.
2. 무료 페이지 유입을 보고 검색어별 페이지를 늘립니다.
3. 결제 전환율이 낮으면 가격보다 **무료 구간의 설득력**을 먼저 의심하세요.
