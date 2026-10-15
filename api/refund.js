// api/refund.js — 환불. 관리자 키가 있어야 호출된다.
// 열람 이력이 있으면 환불 규정에 따라 막고, 사유를 남긴다.
import { db, tossAuth, TOSS_API, send } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { message: "POST만 허용됩니다" });
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY)
    return send(res, 401, { message: "권한이 없습니다" });

  const { orderId, reason, force } = req.body || {};
  const { data: order, error } = await db
    .from("orders").select("*").eq("order_id", orderId).single();
  if (error || !order) return send(res, 404, { message: "주문을 찾을 수 없습니다" });
  if (order.status !== "paid") return send(res, 400, { message: "결제 완료 상태가 아닙니다" });

  if (order.viewed_at && !force)
    return send(res, 409, {
      message: "이미 열람한 콘텐츠입니다. 규정상 청약철회가 제한됩니다.",
      viewedAt: order.viewed_at,
      hint: "예외 처리하려면 force: true 로 다시 호출하세요.",
    });

  const r = await fetch(`${TOSS_API}/payments/${order.payment_key}/cancel`, {
    method: "POST",
    headers: { Authorization: tossAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ cancelReason: reason || "고객 요청" }),
  });
  const toss = await r.json();
  if (!r.ok) return send(res, 400, { message: toss.message || "취소에 실패했습니다" });

  await db.from("orders").update({
    status: "canceled",
    canceled_at: new Date().toISOString(),
    cancel_reason: reason || "고객 요청",
  }).eq("order_id", orderId);
  await db.from("refunds").insert({
    order_id: orderId, amount: order.amount, reason: reason || "고객 요청",
  });

  return send(res, 200, { ok: true, canceled: orderId });
}
