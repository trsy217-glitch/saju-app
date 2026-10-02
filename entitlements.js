// api/entitlements.js — 이 사람이 무엇을 열람할 수 있는지 돌려준다.
// 토큰(기기에 저장된 값) 또는 이메일(기기를 바꾼 경우)로 조회한다.
import { db, send, rateLimit } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { message: "POST만 허용됩니다" });
  if (!rateLimit(req, 60)) return send(res, 429, { message: "잠시 후 다시 시도해주세요" });

  const { tokens, email } = req.body || {};
  let q = db.from("orders")
    .select("order_id,product_code,access_token,approved_at,viewed_at")
    .eq("status", "paid");

  if (Array.isArray(tokens) && tokens.length) {
    q = q.in("access_token", tokens.slice(0, 20));
  } else if (email) {
    q = q.eq("email", String(email).trim().toLowerCase());
  } else {
    return send(res, 400, { message: "토큰 또는 이메일이 필요합니다" });
  }

  const { data, error } = await q;
  if (error) return send(res, 500, { message: "조회에 실패했습니다" });

  // 최초 열람 시각을 남긴다. 환불 판단의 근거가 된다.
  const first = (data || []).filter(o => !o.viewed_at).map(o => o.order_id);
  if (first.length) {
    await db.from("orders")
      .update({ viewed_at: new Date().toISOString() })
      .in("order_id", first);
  }

  return send(res, 200, {
    unlocked: [...new Set((data || []).map(o => o.product_code))],
    orders: (data || []).map(o => ({
      orderId: o.order_id, productCode: o.product_code,
      accessToken: o.access_token, approvedAt: o.approved_at,
      viewed: !!o.viewed_at,
    })),
  });
}
