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
  var GA_ID = 'G-4L5JYWWVGJ'; // MenuFits の GA4 測定ID（2026-09-01 作成）

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
  // EEA・英国・スイスは解析Cookieを既定で拒否（同意バナーは未設置）。
  // 地域は Google がIPで判定する。日本からのアクセスの計測は変わらない。
  window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied',
    region: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
      'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH'] });
  window.gtag('js', new Date());
  // 表示言語。/en/ 配下は <html lang="en">、それ以外は日本語
  var uiLang = 'ja';
  try { if (document.documentElement.lang === 'en') uiLang = 'en'; } catch (e) {}
  window.gtag('set', 'user_properties', { ui_lang: uiLang });
  // 購入完了ページの URL にある session_id は、それだけで購入から30日間ライセンスキーを
  // 取り出せる。gtag は既定で URL をそのまま page_location に送るので、値を伏せて渡す。
  // **index.html のインライン版にも同じ処理がある。片方だけ直さないこと。**
  var config = { anonymize_ip: true };
  try {
    var u = new URL(location.href);
    if (u.searchParams.has('session_id')) {
      u.searchParams.set('session_id', 'redacted');
      config.page_location = u.toString();
    }
  } catch (e) {}
  window.gtag('config', GA_ID, config);

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(s);

  // 計測を足すときは必ずこのラッパーを使う（無効時は何もしない）
  window.trackEvent = function (name, params) {
    try { window.gtag('event', name, params || {}); } catch (e) {}
  };
})();
