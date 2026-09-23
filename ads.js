/* ============================================================
   MenuFits — 広告枠（アフィリエイト）ローダー
   ------------------------------------------------------------
   静的サブページの「記事下」に置いた <aside class="adbox" data-ad>
   と、ページ冒頭の [data-ad-note]（広告を含む旨の表示）を処理する。
   アプリ本体（index.html）には読ませない。

   ■ 出さない条件（どれか1つでも当てはまれば DOM ごと削除する）
     1. MenuFits Pro を購入済み（localStorage の menufitsWebLicense）
     2. テンプレート要素の中が空（＝まだ広告コードを貼っていない）
     3. 解析オプトアウト中（menufitsAnalyticsOptOut）／Do Not Track
        → アフィリエイトタグも Cookie を置くため、意思表示を尊重する

   広告コードはテンプレート要素の中に置く。表示条件を満たしたときに
   初めて DOM へ差し込むので、**出さない相手には画像リクエストすら
   発生しない**（インプレッションも立たない）。

   ■ 「広告」の表示について（消さないこと）
   ステマ規制（景品表示法／令和5年内閣府告示第19号）と、広告主の掲載条件への対応。
   ラクスル等は「ファーストビュー等、一般消費者が認識できる位置に
   広告と分かる表示」を求めており、無い場合は提携を解除されうる。
   そのため2か所に出す。**広告を出すときだけ、両方を同時に出す。**
     - ページ冒頭の [data-ad-note] … 「このページには広告が含まれます」
     - 広告枠のすぐ上の .ad-lbl … 「広告」（このスクリプトが生成する）

   ■ 広告コードを貼るときの注意
   - **バナー／テキスト（a と img だけ）のコードを使うこと。**
     document.write を使う形式のコードは、読み込み後に差し込むため
     動かない（ページが白紙になることもある）。
     もしもアフィリエイト・A8.net とも、静的な形式が選べる。
   - 貼ったら、そのページの CSP（Content-Security-Policy の meta）に
     配信元ドメインが入っているか確認する。既定で
     *.a8.net / *.moshimo.com の img-src を通してある。
   - プロトコル相対URL（//example.com）は https:// に直す。
     http に降格すると CSP で弾かれ、画像が黙って消える。
   ============================================================ */
(function () {
  /* ■ 掲載スイッチ（いまは ON）
     false にすると、全ページの広告枠と冒頭の断り書きが DOM ごと消える。
     画像リクエストも飛ばないので、インプレッションも立たない。

     2026-09-17、もしもアフィリエイトで MenuFits のメディア登録が削除されたため
     いったん OFF にした。登録がない間はクリックが計測されないだけでなく、
     未登録メディアでの掲載としてガイドライン違反に問われうる。

     同日、サポートデスクから登録復活の連絡が来た。管理画面でメディアが「承認」、
     プリントアースが「提携中」（申請中ではない）であることを確かめてから ON に戻した。
     また登録が外れたら、まずここを false にすること。 */
  var ENABLED = true;
  var boxes = document.querySelectorAll('[data-ad]');
  var notes = document.querySelectorAll('[data-ad-note]');
  if (!boxes.length && !notes.length) return;

  function remove(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].parentNode) list[i].parentNode.removeChild(list[i]);
    }
  }
  function dropAll() { remove(boxes); remove(notes); }

  // 0. 掲載を止めている間
  if (!ENABLED) return dropAll();

  // 1. Pro購入者には出さない
  try {
    if (localStorage.getItem('menufitsWebLicense')) return dropAll();
  } catch (e) {}

  // 3. 解析オプトアウト／DNT を尊重する
  try {
    if (localStorage.getItem('menufitsAnalyticsOptOut') === '1') return dropAll();
  } catch (e) {}
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return dropAll();

  var shown = 0;
  for (var i = 0; i < boxes.length; i++) {
    var box = boxes[i];
    var tpl = box.querySelector('template');

    // 2. コード未設定なら枠ごと消す（空の「広告」ラベルを出さない）
    if (!tpl || !tpl.innerHTML.replace(/<!--[\s\S]*?-->/g, '').trim()) {
      if (box.parentNode) box.parentNode.removeChild(box);
      continue;
    }

    var label = document.createElement('div');
    label.className = 'ad-lbl';
    label.textContent = '広告';

    var slot = document.createElement('div');
    slot.className = 'ad-slot';
    slot.appendChild(tpl.content.cloneNode(true));
    // 既存リンクの遷移を妨げず、記事内広告のクリックを集計する。
    // URL・クエリ・リンク本文は送信しない。
    slot.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (!link || !this.contains(link)) return;
      var provider;
      try {
        var host = new URL(link.href, window.location.href).hostname;
        if (/(^|\.)a8\.net$/.test(host)) provider = 'a8';
        else if (/(^|\.)moshimo\.com$/.test(host)) provider = 'moshimo';
        else return;
        if (window.trackEvent) window.trackEvent('affiliate_click', {provider: provider, placement: 'article'});
      } catch (e) {}
    });

    box.removeChild(tpl);
    box.appendChild(label);
    box.appendChild(slot);
    box.hidden = false;
    shown++;
  }

  // 広告が1つも出なかったなら、冒頭の断り書きも出さない
  if (!shown) return remove(notes);
  for (var j = 0; j < notes.length; j++) notes[j].hidden = false;
})();
