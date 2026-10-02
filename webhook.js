// api/webhook.js — 토스 웹훅. 가상계좌 입금, 카드사 취소 등 비동기 상태 변화를 받는다.
// 개발자센터 > 웹훅에 이 주소를 등록하세요: https://<도메인>/api/webhook
import { db, send } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { message: "POST만 허용됩니다" });
  const body = req.body || {};
  const eventId = body.eventId || body.data?.paymentKey || String(Date.now());

  // 같은 이벤트가 두 번 와도 한 번만 처리한다
  const { error: dup } = await db.from("webhook_events")
    .insert({ event_id: eventId, type: body.eventType || null, payload: body });
  if (dup) return send(res, 200, { ok: true, duplicated: true });

  const d = body.data || {};
  if (d.orderId && d.status) {
    const map = { DONE: "paid", CANCELED: "canceled", PARTIAL_CANCELED: "canceled",
                  ABORTED: "failed", EXPIRED: "failed" };
    const status = map[d.status];
    if (status) {
      await db.from("orders").update({
        status,
        payment_key: d.paymentKey || undefined,
        approved_at: d.approvedAt || undefined,
        raw: d,
      }).eq("order_id", d.orderId);
    }
  }
  return send(res, 200, { ok: true });
}
