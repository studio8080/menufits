# INTERNATIONAL-PLAN.md — MenuFits の海外展開

作成: 2026-09-25。MiseFits で検討した海外展開の考え方を MenuFits に当てはめ、
決済・対象地域・価格・工程を決めた記録。**数字の出典は末尾の「参照」。**

> **2026-09-25 更新：MiseFits の決定に合わせた。** 開通時に分かったことは `HANDOFF-FROM-MISEFITS-20260925.md`。
> EU・英国・スイス・UAE からの英語版の注文は、MiseFits と同じく**まだ売らない（返金する）**。
> 地域はオーストラリア・シンガポール・NZ から、UAE は対象外、価格は US$19、返金は14日以内なら全額。
> 姉妹ツールで条件がばらばらだと説明がややこしくなるため、条件は MiseFits と同じにする。

---

## 0. 結論（先に）

| 項目 | 決定 |
|---|---|
| 決済 | **Stripe Managed Payments**（Lemon Squeezy ではなく、同じ Stripe の販売代行機能） |
| 狙う相手 | **海外の日本食レストラン**（寿司・ラーメン・居酒屋など）。和文と英語を並べたメニュー |
| 第1弾の地域 | **オーストラリア・シンガポール・ニュージーランド**（英語・A4・Managed Payments が税を処理する国） |
| 第2弾 | 英国・EU（解析の同意バナーを整えてから）、米国・カナダ（レターサイズ対応が要る） |
| 対象外 | **UAE**（Managed Payments が UAE の VAT を処理しない）、中国本土（Google Fonts が読めない） |
| 価格 | **US$19・税込・買い切り**（MiseFits と同額。現地通貨へは Stripe が自動換算） |
| 返金 | **購入から14日以内なら全額**（豪州の消費者法では「返金不可」と書くこと自体が問題になりうる） |
| 消費税（日本） | 海外分は**不課税**（取引相手は米国の Link, LLC。本人が確認済み）。英語版を日本から買った分は国内の課税売上として自分で扱う |
| 国内版 | 何も変えない（¥1,480・既存の Payment Link・特商法ページのまま） |

---

## 1. 決済：Lemon Squeezy ではなく Stripe Managed Payments にする

当初は Lemon Squeezy（Stripe 傘下の販売代行）を想定していたが、調べた結果やめた。

### 理由

1. **Lemon Squeezy は Stripe Managed Payments へ統合される途中。**
   2026年1月に Lemon Squeezy 自身が「既存ユーザーを Stripe Managed Payments へ移す道を作る」
   と発表している。いまから Lemon Squeezy で始めると、あとで移行作業がもう一度発生する。
2. **日本の事業者が使える。** Stripe の利用資格ページで、対応する事業所在地に **JP** が入っている
   （アジア太平洋は AU / HK / JP / SG）。
3. **いまの仕組みがほぼそのまま使える。** Managed Payments は Checkout と Payment Links の上で動く
   （`managed_payments` を有効にするだけ）。つまり
   - 決済は既存の Stripe アカウントに USD の Payment Link を1本足すだけ
   - ライセンス発行は既存の webhook（`Misefits/functions/menufits.js`、`checkout.session.completed`）
   - Lemon Squeezy なら、webhook の署名検証・イベント形式・管理画面・入金口座がすべて別になる
4. **手数料もほぼ同じか安い。** 少額（$19）だと Lemon Squeezy の固定 50¢ が重い。

| | Stripe Managed Payments（日本アカウント） | Lemon Squeezy |
|---|---|---|
| 手数料 | カード 3.6% ＋ Managed Payments 3.5% ＝ **7.1%**（通貨換算が起きれば＋2%） | **5% ＋ 50¢**（海外取引は追加料金あり） |
| $19 のとき | 約 $1.35〜$1.73 | 約 $1.45＋α |
| 税（VAT/GST/売上税） | Stripe が計算・徴収・申告・納付（80か国以上） | 同じ |
| チャージバック対応 | Stripe が代行 | 同じ |
| 入金 | 既存の Stripe 口座へ円で | 別口座（銀行または PayPal） |

### 知っておくべき違い（Managed Payments 側の仕様）

- **販売者の名義は「Link」になる。** 決済画面・領収書・カード明細（`LINK.COM* …`）に Link が出る。
  領収書メールは Link から送られ、Stripe ダッシュボードの領収書設定は効かない
- **販売者は米国の Link, LLC**（領収書に「Sold through Link, LLC」）。こちらから見た取引相手は海外法人なので、
  日本の消費税は不課税（本人が確認済み）
- **Managed Payments が税を処理する国に UAE は入っていない。** UAE の客に売ると UAE の VAT はこちらの責任になる
  → UAE は対象にしない（宣伝しない）。Payment Link で国を絞れるかは、作成時に確かめる
- **日本の客への販売の消費税は Managed Payments の対象外。** 英語版を日本から買った分は国内の課税売上として扱う
- 購入者からの返金依頼には **Stripe が 60 日以内なら返金することがある**。
  問い合わせに 48 時間以内に答えないと、承認なしで返金されうる → **ダッシュボードのサポート用メールを最新にしておく**
- 商品に**税コードの設定が必須**。MenuFits は `txcd_10103001`（SaaS・事業用）
- 決済画面の独自ドメインは使えない（いまも使っていないので影響なし）
- 購入できない国：中国・ロシア・イラン・北朝鮮・キューバ・シリアなど（Stripe 側の制限）

### 国内版に Managed Payments を使わない理由

国内の購入者には、Managed Payments の 3.5% を足す理由が無い（消費税の扱いはいまのまま）。
**円の Payment Link（`PRO_PURCHASE_URL`）は触らない。** 英語 UI のときだけ USD のリンクを使う。

> 海外の購入者に対する各国の税は、販売者（マーチャント・オブ・レコード）の Link, LLC が負う。
> 日本の消費税の区分は「不課税」で確認済み（2026-09-25、MiseFits のスレッドで本人が確認）。

---

## 2. 誰に売るか：海外の日本食レストラン

英語圏の「メニュー作成ツール」は Canva・Adobe Express・MustHaveMenus などがひしめいていて、
汎用のメニューメーカーとして出ても勝ち目は薄い。

**MenuFits が海外で唯一持っている強みは、本物の日本語組版。**

- 和文書体21種（明朝・筆文字・丸ゴシックなど）。海外ツールの「Japanese テンプレート」は
  欧文書体に和風の飾りを付けたものが多く、日本語そのものは組めない
- 和文と欧文を別々に選べる。カテゴリー名・店名に英字のサブタイトル欄がもともとある
  （＝**日英併記メニュー**がそのまま作れる）
- 本格的な縦書き（KINARI）

海外の日本食レストランは **約18.1万店**（農水省 2025年調査）。アジア約11.2万・欧州約1.9万・
中南米約1.5万・大洋州約2,800・中東約1,600。経営者・店長は日本人とは限らないので、
**英語 UI で、日本語の品書きを本物らしく組める**ことに価値がある。

訴求は「Japanese & bilingual menu maker」。和食以外（カフェ・ビストロ）も作れるが、入口は日本食に絞る。

---

## 3. 地域

### 第1弾：オーストラリア・シンガポール・ニュージーランド

いまの紙面は **A4 固定**（`.page` が 210×296.6mm、`@page{size:A4}`）。3か国とも A4 なのでそのまま出せる。
英語が通じ、支払い意欲が高く、Managed Payments が各国の GST を処理する。
英語サンプルの住所と通貨もこの3か国に合わせた（寿司＝オークランド、居酒屋・カフェ＝豪州、ラーメン＝シンガポール。すべて $）。

### 第2弾：英国・EU

税は Managed Payments が持つが、**解析の同意バナー**を整えてからにする（MiseFits と同じ判断）。
MenuFits は GA4 の同意モードで EEA・英国・スイスを既定で拒否にしてある（§5-3）ので、
英国・EU から来た人を法的に困らせることは無いが、宣伝はまだしない。

### 第2弾：米国・カナダ（レターサイズ）

北米はレター（215.9×279.4mm）。A4 の PDF もプリンタの「用紙に合わせる」で 94% 程度に縮めて刷れるので、
第1段階でも使えなくはない（英語の印刷案内にそう書いておく）。
ただ 11 デザインそれぞれの高さ調整が要るので、**反応を見てから**レター対応を入れる。

### 対象外

- **UAE**：Managed Payments が UAE の VAT を処理しない
- **中国本土**：Google Fonts が読み込めず、紙面が成り立たない。Managed Payments でも購入不可
- 現地語 UI（タイ語・韓国語など）は、英語版の流入を見てから

---

## 4. 価格：US$19・税込・買い切り

- **MiseFits と同額にそろえる。** 国内は両方 ¥1,480 なので、海外も同じ値段のほうが説明が簡単
- 国内 ¥1,480 ≒ US$10 では安すぎる。競合は月額（年 $120〜144 前後）なので、**買い切り $19 でも十分に安い**。
  月額にはしない（国内版と同じ理由。PRO-PLAN.md §0）
- **税込み表示にする。** 豪州・NZ・シンガポールの消費者向け表示は税込みが原則。税込みなら国によって手取りが
  少し変わるが、表示が1種類で済む
- **返金は購入から14日以内なら全額**（`en/privacy.html#terms`）。返金されたキーは新しい端末では解放できなくする
- 現地通貨への換算は Stripe の Adaptive Pricing に任せる（地域別の値付けはしない。
  購買力に合わせた値引きは、流入が見えてから検討）
- 無料／Pro の範囲は国内と同じ（`FREE_*` 定数を共有）。**1つのコードで両方を切り分ける**
- 1キー5台まで・ライセンス検証も国内と共通（`menufitsVerifyLicense`）

---

## 5. 実装

### 5-1. アプリ本体（`index.html`）— 単一ファイルのまま2言語にする

- **言語の決め方**：`?lang=en` / `?lang=ja` → `localStorage` の `menufitsLang` → それ以外は日本語。
  ブラウザの言語設定では自動で切り替えない（日本語の利用者の挙動を一切変えないため）
- 文字列は **`T('日本語','English')`** でその場に並べて持つ（辞書を別に持たない）。
  直すときに片方だけ直す事故を減らすため。静的な HTML は `data-en` / `data-en-title` 属性
- 英語のときは**日本語の LP を出さず、いきなりエディタを開く**。英語の入口は `/en/`
- サンプルは同じキー（`cafe` / `washoku` / `bistro` / `chuka` / `blank`）で英語版を持つ。
  `washoku` は日英併記の日本食（寿司・居酒屋）にする
- 価格表記に `$` / `€`（前・後）/ `£` を足す（国内にも効くが、既存の3種は変えない）
- 購入：`PRO_PURCHASE_URL_EN`（USD・Managed Payments の Payment Link）。**空のあいだは
  「準備中」と表示**して、円のリンクへは飛ばさない（海外の消費者に円で売ると、各国の税の義務が
  こちらに残るため）
- `.json` の保存形式・スロット・ライセンスは言語と無関係に共通

### 5-2. 英語の静的ページ（`/en/`）

- `/en/index.html` … 英語の LP（日本食レストラン向け）
- `/en/privacy.html` … プライバシー・利用条件・返金（英語）。**特商法ページは日本語のまま**
- `/en/pro-unlock.html` … 英語版の購入完了ページ。処理は `pro-unlock.html` と同じ（直すときは両方）
- `hreflang` はトップの ja ↔ en の組にだけ張る（中身が対応していないページには張らない）
- 広告（`ads.js`）は英語ページに出さない（もしも・A8 は国内専用）

### 5-3. 解析と同意（EU・英国）

GA4 の同意モードで、**EEA・英国・スイスからのアクセスは解析 Cookie を既定で拒否**にする
（`gtag('consent','default',{…, region:[…]})`）。Google が IP で地域を判定するので、
日本の利用者の計測は変わらない。第1段階では同意バナーを出さない（＝EU・英国の計測は
Cookie なしの集計だけになる）。バナーは流入が見えてから検討。
**`analytics.js` とインラインローダーの両方を直すこと。**

UI の言語は GA4 のユーザープロパティ `ui_lang` で送る（国と言語でファネルを分けて見るため）。

### 5-4. 決済まわり（Stripe の設定が済んでから）

MiseFits と同じ Stripe アカウント・同じ Firebase（`misefits`）なので、**MiseFits の `feature/global-en` の
`functions/index.js` と同じ作りにする**（2026-09-25 時点で MiseFits 側は未コミットで作業中。
同じ作業ツリーを2つのセッションで同時に触らないよう、MiseFits 側がコミットしてから `functions/menufits.js` に入れる）。

1. Stripe ダッシュボードで Managed Payments を有効化（利用資格の審査あり）— **本人**（MiseFits と共通）
2. 商品「MenuFits Pro（US$）」に USD の価格 $19（税込）、税コード `txcd_10103001` — 作成前に確認を取る
3. Managed Payments を有効にした Payment Link を作る。完了後の遷移先は
   `https://menufits.kokokikaku.com/en/pro-unlock.html?session_id={CHECKOUT_SESSION_ID}`
4. `functions/menufits.js`（MiseFits の `stripeWebhook` と同じ形）
   - `STRIPE_PRICE_ID_MENUFITS_EN` を足し、日本語版・英語版どちらの Price に一致したかで `lang` を決める。
     どちらにも一致しなければキーを出さない（MiseFits の決済を拾わないため）
   - `licenses` に `paymentIntent` と `lang` を保存し、`menufitsPaymentIntents/{pi}` → キーの対応を残す
   - `charge.refunded`（全額）でキーに `revoked: true`。`menufitsVerifyLicense` は `revoked` なら
     `{valid:false, reason:'revoked'}`（解放済みの端末は動き続ける。アカウント無しの設計上、遡って止めない）
   - 控えメールの英語版（`sendLicenseMail(email, key, lang)`）
   - MenuFits 用の webhook エンドポイント（`we_1UAonw…`）で **`charge.refunded` も購読**する
5. `index.html` の `PRO_PURCHASE_URL_EN` に Payment Link を入れ、`en/index.html` の「launching soon」を購入ボタンに差し替える
6. **テストモードで通しの購入 → キー発行 → 解放 → 返金で無効化まで確認してからライブへ**
   （PRO-PLAN.md §7-4 の「本番切替で踏んだ罠」を必ず読むこと。サンドボックスの Price ID が本番に混ざると無音で壊れる）

---

## 6. 工程と状態

| # | 作業 | 担当 | 状態 |
|---|---|---|---|
| 1 | 決済・地域・価格の調査と決定（この文書） | エージェント | 済（2026-09-25） |
| 2 | `index.html` の英語 UI・英語サンプル・通貨記号 | エージェント | 済（ローカル・未 push） |
| 3 | 解析の同意モード（EEA/英国/スイス）と `ui_lang` | エージェント | 済（ローカル・未 push） |
| 4 | `/en/` の LP・プライバシー・返金・購入完了ページ、hreflang、sitemap、llms.txt | エージェント | 済（ローカル・未 push） |
| 4b | MiseFits の決定に合わせる（AU/SG/NZ・UAE 除外・US$19・14日返金） | エージェント | 済（ローカル・未 push） |
| 5 | Stripe で Managed Payments を有効化（MiseFits と共通） | **本人** | 未 |
| 6 | `functions/menufits.js` を MiseFits と同じ作りに（§5-4 の4）＋ UAE/英国/EU の注文に印・購入完了ページの取得期限30日 | エージェント | 済（Misefits リポジトリ・未コミット・未デプロイ。模造環境で全経路を確認） |
| 6b | 英語の規約 `en/terms.html`（MiseFits と同条件）、返金済みキー・期限切れの画面表示、404 の英語対応 | エージェント | 済（ローカル・未 push） |
| 6c | Stripe で MenuFits の US$19 商品と Payment Link | エージェント | 済（2026-09-25。`prod_VK5rr8tq0kDIle` / `price_1UJRfQ3C6tqke0fyHkZdHWOS` / `plink_1UJRgN3C6tqke0fyxLVdLlf7`、MP 有効・内税・住所収集なし・完了後 `en/pro-unlock.html` へ） |
| 6d | MenuFits 用 webhook エンドポイントで `charge.refunded` を購読、`STRIPE_PRICE_ID_MENUFITS_EN` を入れて `menufitsStripeWebhook` だけ再デプロイ | 両方 | 未 |
| 7 | テストモードで通し確認 → ライブ切替 | 両方 | 未 |
| 8 | Search Console に `/en/` を送信、2〜3か月流入を見る | 本人／エージェント | 未 |
| 8b | GA4 管理画面でユーザースコープのカスタムディメンション `ui_lang` を登録（登録しないとレポートで分けられない） | 本人 | 未 |
| 9 | 英語の集客記事（例：日本語メニューの英訳の付け方、寿司店のメニュー） | エージェント | 反応を見て |
| 10 | レターサイズ対応（米国・カナダ） | エージェント | 反応を見て |

英語 UI は、決済が未設定でも**無料の範囲で先に公開できる**（Pro は「準備中」と出る）。
公開して検索の反応を見始めるのと、Stripe の審査を並行させるのが最短。

---

## 7. 国内向けの派生（おまけの施策）

同じ「日英併記」の強みは、**国内のインバウンド対応**にも効く（「英語メニュー 作り方」
「インバウンド メニュー 英語」）。日本語の集客ページを1枚足すだけで、既存の決済・広告のまま試せる。
候補：`menu-english.html`（日英併記メニューの作り方）。

---

## 参照（2026-09-25 確認）

- Stripe「Managed Payments の利用資格」— 対応する事業所在地に JP、税コード一覧、購入できない国
  https://docs.stripe.com/payments/managed-payments/eligibility
- Stripe「Managed Payments の仕組み」— Link が販売者名義、60日以内の返金、明細表記
  https://docs.stripe.com/payments/managed-payments/how-it-works
- Stripe 日本の料金 — Managed Payments は決済手数料に加えて 3.5%、カード 3.6%、通貨換算 2%
  https://stripe.com/jp/pricing
- Lemon Squeezy「2026 Update: Lemon Squeezy + Stripe Managed Payments」
  https://www.lemonsqueezy.com/blog/2026-update
- Lemon Squeezy 料金 — 5% ＋ 50¢
  https://www.lemonsqueezy.com/pricing
- 農林水産省「海外における日本食レストラン数の調査結果（令和7年）」— 約18.1万店
  https://www.maff.go.jp/j/press/yusyutu_kokusai/kaitaku/251128.html
- JETRO ビジネス短信（同調査の地域別の数字）
  https://www.jetro.go.jp/biznews/2025/12/5b3b792ffec5ac1e.html

**検索需要（英語キーワードの月間検索数）はまだ実数を見ていない。** 公開後の Search Console で確かめる。
