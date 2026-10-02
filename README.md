# 사주 리포트 — 배포 안내

Vercel + Supabase + 토스페이먼츠로 돌아갑니다. 순서대로 따라 하시면 됩니다.

```
api/            Vercel 서버리스 함수 (시크릿 키는 여기서만 씁니다)
  _lib.js         공용 도우미
  order.js        주문 생성 — 금액을 서버가 정합니다
  confirm.js      결제 승인
  entitlements.js 열람 권한 조회
  refund.js       환불 (관리자 키 필요)
  webhook.js      토스 웹훅 수신
public/         정적 파일
  index.html      평생사주
  wealth.html     재물사주
  destiny.html    인연사주
  success.html    결제 성공 → 승인 호출
  fail.html       결제 실패
  terms.html      환불 규정·개인정보 처리방침
  pay.js          결제 프론트 모듈
  manifest.json   PWA
  sw.js           서비스 워커
supabase/schema.sql
```

## 1단계 — Supabase

1. supabase.com 에서 프로젝트를 만듭니다 (리전은 Northeast Asia / Seoul).
2. SQL Editor 에 `supabase/schema.sql` 을 통째로 붙여넣고 실행합니다.
3. Settings → API 에서 두 값을 복사합니다.
   - Project URL
   - **service_role** 키 (anon 키가 아닙니다. 절대 브라우저에 넣지 마세요.)

RLS는 켜져 있고 정책을 하나도 만들지 않았습니다. 의도한 설정입니다. 브라우저에서는 DB에 직접 접근할 수 없고, 서버 함수만 service_role 키로 들어갑니다.

## 2단계 — 토스페이먼츠 (테스트)

1. developers.tosspayments.com 회원가입.
2. 계약 전에도 **테스트 키**가 발급됩니다. 이걸로 먼저 개발하세요.
3. 테스트 클라이언트 키(`test_ck_...`)를 세 HTML의 `__TOSS_CLIENT_KEY__` 자리에 넣습니다.

```bash
cd public
sed -i 's/__TOSS_CLIENT_KEY__/test_ck_실제값/g' index.html wealth.html destiny.html
```

## 3단계 — Vercel 배포

1. 이 폴더를 GitHub 레포에 올립니다.
2. Vercel 에서 Import 합니다. 빌드 설정은 건드릴 것이 없습니다.
3. Settings → Environment Variables 에 네 개를 등록합니다.

| 이름 | 값 |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 |
| `TOSS_SECRET_KEY` | 테스트 시크릿 키 (`test_sk_...`) |
| `ADMIN_KEY` | 환불 API용 임의의 긴 문자열 |

4. 배포 후 개발자센터 → 웹훅에 `https://<도메인>/api/webhook` 을 등록합니다.

## 4단계 — 테스트 결제

배포된 사이트에서 리포트를 만들고 결제 버튼을 누릅니다. 테스트 환경에서는 유효한 카드번호를 넣어도 **실제로 돈이 빠져나가지 않습니다.** 개발자센터의 "내 테스트 결제내역"에서 승인·취소를 확인할 수 있습니다.

확인할 것 네 가지입니다.

- 결제 후 success.html 에서 승인이 되고 리포트가 열리는가
- 새로고침해도 열린 상태가 유지되는가 (`Pay.sync`)
- 다른 브라우저에서 "이메일로 불러오기"가 되는가
- Supabase `orders` 테이블에 `status = paid` 로 남는가

## 5단계 — 실제 결제 전환

1. `terms.html` 의 `__SANGHO__`, `__SAUPJA_NO__` 등 빈칸을 실제 정보로 채웁니다.
2. 토스페이먼츠에 전자결제를 신청합니다. 토스 심사 1~2일, 카드사 심사 최대 14일입니다.
3. 심사 통과 후 라이브 키를 받으면 두 곳을 바꿉니다.
   - Vercel 환경변수 `TOSS_SECRET_KEY` → `live_sk_...`
   - HTML의 클라이언트 키 → `live_ck_...`

카드사 심사에 필요한 준비물입니다.

- 판매 상품이 실제로 보이고 결제까지 연동되어 있을 것
- 비실물 상품이므로 **제공기간과 환불정책이 명시**되어 있을 것 (terms.html이 그 역할입니다)
- 사업자 정보가 화면에 표시될 것

## 아이콘

`public/icon-192.png`, `public/icon-512.png` 두 개를 만들어 넣으셔야 PWA 설치 아이콘이 제대로 뜹니다. 아직 없습니다.

## 안전장치 정리

| 위험 | 대응 |
|---|---|
| 금액 조작 | 주문 생성과 승인 모두 서버가 `products` 테이블 금액으로 검증 |
| 시크릿 키 노출 | 서버 함수에서만 사용, 클라이언트 번들에 없음 |
| 중복 승인 | 이미 `paid` 인 주문은 재승인하지 않고 기존 토큰 반환 |
| 웹훅 중복 | `webhook_events` 테이블의 `event_id` 로 차단 |
| 무단 환불 | `x-admin-key` 헤더 검증 |
| 열람 후 환불 요구 | `viewed_at` 기록으로 근거 확보, `force` 없이는 거부 |

## 아직 안 된 것

- `icon-192.png` / `icon-512.png`
- PDF 저장, 카카오 공유
- 관리자 화면 (지금은 Supabase 대시보드에서 직접 봐야 합니다)
- 궁합·연운 결제 연동 (평생·재물·인연 세 개만 붙어 있습니다)
