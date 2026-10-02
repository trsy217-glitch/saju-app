/**
 * pay.js — 결제 흐름을 담당한다. 세 페이지가 공유한다.
 *
 *   <script src="https://js.tosspayments.com/v2/standard"></script>
 *   <script src="/pay.js"></script>
 *
 *   Pay.unlocked("destiny")            결제 여부
 *   await Pay.sync()                   서버에서 권한 갱신
 *   Pay.open("destiny", birth)         결제창 열기
 *   Pay.restore(email)                 기기 변경 시 복원
 */
(function (global) {
  "use strict";

  const CLIENT_KEY = global.TOSS_CLIENT_KEY || "test_ck_REPLACE_ME";
  const TOKENS_KEY = "saju.tokens.v1";
  const UNLOCK_KEY = "saju.unlocked.v1";

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const Pay = {
    tokens:   () => read(TOKENS_KEY, []),
    unlocked: (code) => read(UNLOCK_KEY, []).includes(code),
    list:     () => read(UNLOCK_KEY, []),

    /** 서버에서 열람 권한을 다시 받아온다. 페이지 로드 때 한 번 호출한다. */
    async sync(email) {
      const tokens = Pay.tokens();
      if (!tokens.length && !email) return Pay.list();
      try {
        const r = await fetch("/api/entitlements", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(email ? { email } : { tokens }),
        });
        if (!r.ok) return Pay.list();
        const j = await r.json();
        write(UNLOCK_KEY, j.unlocked || []);
        const merged = [...new Set([...tokens, ...(j.orders || []).map(o => o.accessToken)])];
        write(TOKENS_KEY, merged);
        return j.unlocked || [];
      } catch { return Pay.list(); }
    },

    /** 다른 기기에서 산 것을 이메일로 되살린다 */
    async restore(email) {
      const list = await Pay.sync(email);
      return list;
    },

    /**
     * 결제창을 연다.
     * @param {string} productCode life | wealth | destiny | year | compat
     * @param {object} birth       구매 시점의 생년월일 입력값 (재조회용)
     * @param {string} email       영수증과 복원에 쓰인다
     */
    async open(productCode, birth, email, gift) {
      if (!email) throw new Error("이메일이 필요합니다");

      // 1) 서버에서 주문을 만든다. 금액은 서버가 정한다.
      const r = await fetch("/api/order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCode, email, birth,
          giftEmail: gift && gift.email, giftMessage: gift && gift.message }),
      });
      const order = await r.json();
      if (!r.ok) throw new Error(order.message || "주문 생성에 실패했습니다");

      // 2) 결제창을 띄운다
      const toss = global.TossPayments(CLIENT_KEY);
      const payment = toss.payment({ customerKey: global.TossPayments.ANONYMOUS });

      const base = location.origin;
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: order.amount },
        orderId: order.orderId,
        orderName: order.orderName,
        customerEmail: email,
        successUrl: `${base}/success.html?product=${encodeURIComponent(productCode)}` +
                    `&from=${encodeURIComponent(location.pathname)}`,
        failUrl:    `${base}/fail.html?from=${encodeURIComponent(location.pathname)}`,
        card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false, useAppCardOnly: false },
      });
    },

    /** success.html 에서 호출한다 */
    async confirm(params) {
      const r = await fetch("/api/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentKey: params.get("paymentKey"),
          orderId: params.get("orderId"),
          amount: Number(params.get("amount")),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "결제 승인에 실패했습니다");
      const tokens = [...new Set([...Pay.tokens(), j.accessToken])];
      write(TOKENS_KEY, tokens);
      write(UNLOCK_KEY, [...new Set([...Pay.list(), j.productCode])]);
      return j;
    },
  };

  global.Pay = Pay;
})(window);
