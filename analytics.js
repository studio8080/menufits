/* ============================================================
   MenuFits — アクセス解析（GA4）ローダー
   ------------------------------------------------------------
   静的サブページ（pro / faq / privacy / tokushoho / releases /
   pro-unlock）が読み込む。index.html は単一ファイル構成を保つため
   同じ内容をインラインで持っている。**このファイルを直したら
   index.html 側のインライン版も必ず揃えること。**

   GA_ID が空のあいだは外部への通信は一切発生しない。
   計測を始めるときは、GA4 プロパティ（MenuFits 用に新規作成する。
   MiseFits のプロパティを使い回さないこと）の測定ID G-XXXXXXXXXX を
   下の GA_ID に入れ、index.html 側にも同じIDを入れる。

   プライバシー：privacy.html のオプトアウト（localStorage の
   menufitsAnalyticsOptOut）と Do Not Track を尊重する。
   ============================================================ */
(function () {
  var GA_ID = 'G-4L5JYWNVGJ'; // MenuFits の GA4 測定ID（2026-09-01 作成）

  window.MENUFITS_GA_ID = GA_ID;
  window.trackEvent = function () {}; // 解析が無効でも安全に呼べるダミー

  if (!GA_ID) return;

  try {
    if (localStorage.getItem('menufitsAnalyticsOptOut') === '1') {
      window['ga-disable-' + GA_ID] = true;
      return;
    }
  } catch (e) {}

  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { anonymize_ip: true });

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(s);

  // 計測を足すときは必ずこのラッパーを使う（無効時は何もしない）
  window.trackEvent = function (name, params) {
    try { window.gtag('event', name, params || {}); } catch (e) {}
  };
})();
