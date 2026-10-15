// api/feedback.js — 적중 체크 기록과 통계
// 로그인 없이 기기에서 만든 익명 키로 묶습니다. 생년월일 원본은 보내지 않습니다.
import { db, send, rateLimit } from "./_lib.js";

export default async function handler(req, res) {
  if (!rateLimit(req, 60)) return send(res, 429, { message: "잠시 후 다시 시도해주세요" });

  // 기록
  if (req.method === "POST") {
    const { userKey, kind, refId, field, hit, note, birthHash } = req.body || {};
    if (!userKey || !kind || typeof hit !== "boolean")
      return send(res, 400, { message: "필수 값이 빠졌습니다" });

    const { error } = await db.from("feedback").insert({
      user_key: String(userKey).slice(0, 64),
      kind: String(kind).slice(0, 24),
      ref_id: refId ? String(refId).slice(0, 64) : null,
      field: field ? String(field).slice(0, 24) : null,
      hit,
      note: note ? String(note).slice(0, 500) : null,
      birth_hash: birthHash ? String(birthHash).slice(0, 64) : null,
    });
    if (error) return send(res, 500, { message: "기록에 실패했습니다" });
    return send(res, 200, { ok: true });
  }

  // 통계 — 내 적중률
  if (req.method === "GET") {
    const userKey = (req.query && req.query.userKey) || "";
    if (!userKey) return send(res, 400, { message: "userKey가 필요합니다" });

    const { data, error } = await db.from("feedback")
      .select("kind,field,hit").eq("user_key", userKey).limit(2000);
    if (error) return send(res, 500, { message: "조회에 실패했습니다" });

    const byField = {};
    (data || []).forEach(r => {
      const k = r.field || r.kind;
      byField[k] = byField[k] || { n: 0, hit: 0 };
      byField[k].n += 1;
      if (r.hit) byField[k].hit += 1;
    });
    const stats = Object.entries(byField)
      .map(([k, v]) => ({ field: k, total: v.n, hit: v.hit, rate: Math.round(v.hit / v.n * 100) }))
      .sort((a, b) => b.total - a.total);
    const total = (data || []).length;
    const hits = (data || []).filter(r => r.hit).length;

    return send(res, 200, {
      total, hits, rate: total ? Math.round(hits / total * 100) : null, stats,
    });
  }

  return send(res, 405, { message: "GET 또는 POST만 허용됩니다" });
}
