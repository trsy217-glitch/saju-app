// api/order.js — 결제창을 띄우기 전에 서버에서 주문을 만든다.
// 금액을 클라이언트가 정하지 못하게 하는 것이 목적이다.
import { db, priceOf, newToken, isEmail, send, rateLimit } from "./_lib.js";
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { message: "POST만 허용됩니다" });
  if (!rateLimit(req)) return send(res, 429, { message: "잠시 후 다시 시도해주세요" });

  const { productCode, email, birth, giftEmail, giftMessage } = req.body || {};

  const product = await priceOf(productCode);
  if (!product) return send(res, 400, { message: "판매하지 않는 상품입니다" });
  if (!isEmail(email)) return send(res, 400, { message: "이메일 주소를 확인해주세요" });

  // 주문번호: 영문·숫자·- _ 로 6~64자
  const orderId = "ord_" + Date.now().toString(36) + "_" +
                  crypto.randomBytes(6).toString("hex");

  const { error } = await db.from("orders").insert({
    order_id: orderId,
    product_code: product.code,
    amount: product.amount,
    email: String(email).trim().toLowerCase(),
    status: "pending",
    birth: birth || null,
    access_token: newToken(),
    gift_email: giftEmail && isEmail(giftEmail) ? String(giftEmail).trim().toLowerCase() : null,
    gift_message: giftMessage ? String(giftMessage).slice(0, 300) : null,
  });
  if (error) return send(res, 500, { message: "주문 생성에 실패했습니다" });

  // 금액과 상품명은 서버가 정한 값을 그대로 돌려준다
  return send(res, 200, {
    orderId,
    amount: product.amount,
    orderName: product.name,
  });
}
