// api/confirm.js — 결제 승인. 결제창이 성공 URL로 돌아오면 여기를 호출한다.
import { db, tossAuth, TOSS_API, send, rateLimit } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { message: "POST만 허용됩니다" });
  if (!rateLimit(req)) return send(res, 429, { message: "잠시 후 다시 시도해주세요" });

  const { paymentKey, orderId, amount } = req.body || {};
  if (!paymentKey || !orderId || amount == null)
    return send(res, 400, { message: "필수 값이 빠졌습니다" });

  // 1) 우리가 만든 주문이 맞는지, 금액이 일치하는지 먼저 확인한다.
  const { data: order, error } = await db
    .from("orders").select("*").eq("order_id", orderId).single();
  if (error || !order) return send(res, 404, { message: "주문을 찾을 수 없습니다" });

  if (order.status === "paid") {
    // 새로고침 등으로 두 번 들어온 경우. 다시 승인하지 않고 그대로 돌려준다.
    return send(res, 200, {
      ok: true, alreadyPaid: true,
      accessToken: order.access_token, productCode: order.product_code,
    });
  }
  if (Number(amount) !== Number(order.amount)) {
    await db.from("orders").update({ status: "failed" }).eq("order_id", orderId);
    return send(res, 400, { message: "결제 금액이 주문 금액과 다릅니다" });
  }

  // 2) 토스에 승인 요청. 이 호출이 성공해야 실제로 돈이 빠져나간다.
  let toss;
  try {
    const r = await fetch(`${TOSS_API}/payments/confirm`, {
      method: "POST",
      headers: { Authorization: tossAuth(), "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: order.amount }),
    });
    toss = await r.json();
    if (!r.ok) {
      await db.from("orders").update({
        status: "failed", raw: toss,
      }).eq("order_id", orderId);
      return send(res, 400, { message: toss.message || "결제 승인에 실패했습니다", code: toss.code });
    }
  } catch (e) {
    return send(res, 502, { message: "결제 서버와 통신하지 못했습니다" });
  }

  // 3) 승인 성공. 주문을 확정하고 열람 권한을 준다.
  await db.from("orders").update({
    status: "paid",
    payment_key: paymentKey,
    method: toss.method || null,
    approved_at: toss.approvedAt || new Date().toISOString(),
    raw: toss,
  }).eq("order_id", orderId);

  return send(res, 200, {
    ok: true,
    accessToken: order.access_token,
    productCode: order.product_code,
    amount: order.amount,
    method: toss.method || null,
  });
}
