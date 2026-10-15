// api/_lib.js — 서버 함수들이 공유하는 도우미
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,          // 브라우저에 절대 노출 금지
  { auth: { persistSession: false } }
);

export const TOSS_API = "https://api.tosspayments.com/v1";

/** 토스 시크릿 키로 Basic 인증 헤더를 만든다. 키 뒤 콜론을 빠뜨리면 안 된다. */
export function tossAuth() {
  const key = process.env.TOSS_SECRET_KEY;
  if (!key) throw new Error("TOSS_SECRET_KEY 환경변수가 없습니다");
  return "Basic " + Buffer.from(key + ":").toString("base64");
}

/** 상품 코드로 정가를 조회한다. 클라이언트가 보낸 금액은 절대 믿지 않는다. */
export async function priceOf(code) {
  const { data, error } = await db
    .from("products").select("code,name,amount,active")
    .eq("code", code).eq("active", true).single();
  if (error || !data) return null;
  return data;
}

export const newToken = () => crypto.randomBytes(24).toString("base64url");

export const isEmail = (s) =>
  typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

export function send(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).end(JSON.stringify(body));
}

/** 같은 IP에서 짧은 시간에 몰아치는 요청을 막는 아주 단순한 제한 */
const hits = new Map();
export function rateLimit(req, max = 30, windowMs = 60_000) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > windowMs) { rec.n = 0; rec.t = now; }
  rec.n += 1;
  hits.set(ip, rec);
  return rec.n <= max;
}
