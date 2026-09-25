# HANDOFF-FROM-MISEFITS-20260925.md — MiseFits 英語版の開通で分かったこと

作成: 2026-09-25（MiseFits のスレッドから引き継ぎ）。
`INTERNATIONAL-PLAN.md` の方針（Stripe Managed Payments・AU/SG/NZ・US$19 内税・14日返金・UAE 対象外）は
そのまま有効。このファイルは、**MiseFits で実際に開通させたときに踏んだこと・決めた設定・MenuFits 側に残っている作業**だけをまとめる。
MiseFits 側の正本は `Misefits/AGENTS.md` の「英語版（海外向け）」節。

---

## 1. MenuFits に関係する「いまの状態」（2026-09-25 時点）

| 項目 | 状態 |
|---|---|
| `menufitsStripeWebhook` | **2026-09-25 に再デプロイ済み**（MiseFits リポジトリから `--only functions:menufitsStripeWebhook`） |
| 使っている Stripe の鍵 | `STRIPE_SECRET_KEY_MENUFITS` **v4**・`STRIPE_WEBHOOK_SECRET_MENUFITS` **v4**（再デプロイ前は v1 / v2）。**2026-09-25 13:31 に確認済み**：Stripe で別商品のイベントを手動再送 → `200 ignored (unrelated price)`（署名検証＝Webhook シークレット v4 と、`listLineItems`＝シークレットキー v4 の両方を通過） |
| 控えメール（SMTP） | `SMTP_PASS` **v6**（Google のアプリ パスワード）に切り替え済み。**再デプロイ前は v2 で、9/1 から送信に失敗していた**（`menufitsLicenses/MNPRO-5KK8-…` に `mailError: 535 Username and Password not accepted`） |
| 日本語版の決済リンク | `https://buy.stripe.com/bJecMY2tI5nC0f1dSz9R601`（変更なし） |
| 英語版（MP）の商品・リンク | **2026-09-25 に作成済み**。`https://buy.stripe.com/4gM28kc4i8zO7HtbKr9R607`（MenuFits Pro (English)・US$19・MP 有効）。手順は下の 3 |

### 残っている確認（英語版ができたときにまとめて）

鍵は上の方法で確認済み。控えメール（SMTP v6）は MiseFits で送信成功を確認済みで、MenuFits も同じシークレットと同じ送信処理。
MenuFits 自体の購入での通し確認は、英語版の商品を作った後にテスト購入（日本語版・英語版とも）で行う。

#### 鍵だけを購入なしで確かめる方法

Stripe の Webhook「イベントの配信」で、MenuFits 用エンドポイントの**直近の試行**を「再送する」。
処理順が「署名検証 → `listLineItems`（秘密鍵）→ 重複ガード」なので、`200` が返れば両方の鍵が正しい
（別商品なら `ignored (unrelated price)`、処理済みの MenuFits 購入なら `already processed` で、どちらもキーやメールは出ない）。

### テスト購入で確認すること（日本語版・¥1,480）

1. 上のリンクで購入 → 購入完了ページにキーが出る
2. Firestore `menufitsLicenses/{キー}` に `mailSentAt` が付く（`mailError` ならまだ失敗）
3. Stripe の Webhook「イベントの配信」で `menufitsStripeWebhook` 宛てが **200**
4. ダッシュボードから全額返金

**もし 500 や署名エラーになったら**、v4 の鍵が間違っている。Stripe の本番画面から鍵（`sk_live_…`）と
MenuFits 用 Webhook の署名シークレット（`whsec_…`）を取り直して `secrets:set` → `menufitsStripeWebhook` だけ再デプロイ。

---

## 2. 共有の仕組みで踏んだ罠（MenuFits でも同じことが起きる）

- **Firebase プロジェクト `misefits` に3製品の関数が同居**：MiseFits（`stripeWebhook` ほか）、MenuFits（`menufits*`、MiseFits リポジトリの `functions/menufits.js`）、
  全銀ポン（codebase `zenginpon`、`repos/zengin-pon` からデプロイ）。**デプロイは必ず関数名を指定**する。
- **`secrets:set` の最後の質問「再デプロイして古いバージョンを破棄するか」には `n`。** `Y` だと3製品の関数がまとめて再デプロイされる。
- **デプロイは「その時点の最新バージョン」の鍵を全部つかむ。** SMTP だけ直したいつもりでも、未デプロイの新しい Stripe 鍵まで一緒に切り替わる。
  MenuFits はまさにこの状態だったので、テスト購入とセットで再デプロイした。
- **`SMTP_PASS` はアプリ パスワード（16桁）でないと送れない。** 通常のパスワードだと `534-5.7.9 Application-specific password required`、
  古い／誤ったものだと `535-5.7.8 Username and Password not accepted`。v2・v4・v5 は失敗、**v6 で成功**（v5 は通常パスワードだったため破棄済み）。
- **Firebase CLI のログインは `studio@kokokikaku.com`**（`firebase login:add` → `firebase login:use`）。`mikan@` は misefits の旧オーナー権限として残っているだけ。
- `gcloud` は再認証が必要な状態（非対話では止まる）。ログやバージョンの確認は `firebase functions:log` / `functions:secrets:get` で足りる。
- **Stripe ダッシュボードは遷移するとサンドボックスに戻る**。本番は `https://dashboard.stripe.com/acct_1U9FT33C6tqke0fy/...` を直接開く。

## 3. Managed Payments の商品・リンクを作るときの手順（MiseFits で実施済みの順）

1. 設定 › Managed Payments › 「使ってみる」。既定の商品カテゴリーは「SaaS：業務使用（`txcd_10103001`）」に設定済み
   （**既存の商品の税コードは触らなかった**。ウィザードの「商品を確認する」で対象商品が1つあれば先へ進める）
2. 決済用リンクの作成画面で **新しい商品を追加**：USD・1回限り・**価格に税金を含める＝はい（内税）**・カテゴリー SaaS 業務使用
3. 「Managed Payments を有効にする」にチェックが入っていることを確認。**リンク作成後は MP の有効/無効を変えられない**
4. 支払い完了ページ → 「確認ページを表示しない」→ リダイレクト先 `https://menufits.kokokikaku.com/en/pro-unlock.html?session_id={CHECKOUT_SESSION_ID}`
   （入力欄は表示が途中で切れるので、保存前に DOM から実値を読んで照合した）
5. 作ったら Price ID を `Misefits/functions/.env` に（例：`STRIPE_PRICE_ID_MENUFITS_EN`）→ `menufits.js` で日英どちらの Price でも受けるようにする。
   MiseFits は `STRIPE_PRICE_ID`（日本語）と `STRIPE_PRICE_ID_EN`（英語）の**どちらに一致したかで控えメールの言語を切り替えている**（`functions/index.js` を参照）

## 4. MiseFits で入れた機能（MenuFits にも入れるなら）

- **返金でキーを無効化**：webhook で `charge.refunded` も購読し、`paymentIntents/{pi}` → キーを引いて `revoked: true`。
  `verifyLicense` は `revoked` なら `{valid:false, reason:'revoked'}`。MenuFits 用 webhook エンドポイントにも `charge.refunded` の購読追加が要る
- **MP が税を扱わない国（UAE 等）からの英語版注文に印**：`customer_details.address.country` が MP の対象国一覧に無ければ `outsideMpTax: true` とログ警告 → 返金して案内
  （テスト購入では請求先の国 `AU` が正しく記録された。住所収集をオフのままでも国は取れる）
- **英語の控えメール**（件名 `Your MiseFits Pro license key`）
- 英語の規約に「UAE など MP が税を扱わない国からの注文は返金する」「14日以内は理由を問わず全額返金」「各国の消費者法を制限しない」を明記

## 5. Stripe アカウント全体の設定（MenuFits にも効いている）

- **公開ビジネス名：`Koko Kikaku`**（決済画面の「〜に支払う」表示。日本語版の決済画面もこの表記になった）
- **サポート用メール：`studio@kokokikaku.com`**（MP では Link からのエスカレーション先。48時間以内に返事がないと Stripe が無承認で返金しうる）
- 明細書表記：`KOKOKIKAKU`（変更なし）。MP の決済は `LINK.COM* …` と表示される
- ダッシュボードに「マイナス残高を補填するため JPY の最低額を設定」という警告あり（未対応）

## 6. テスト購入のやり方（本番リンクで・全額返金前提）

- Chrome に保存済みの Link アカウントが自動で出ると国の選択欄が出ない → **「別の方法で支払う」→「カード」→「国または地域」をオーストラリアに**
- **日本のままにしない**（日本の事業者 → 日本の客は MP の税処理の対象外で、国内課税売上になる）
- 控えメールだけを再テストしたいときは、Firestore の `sessions/{cs_live_…}`（MenuFits は `menufitsSessions/…`）を**本人が**削除 →
  Stripe の Webhook「イベントの配信」で**直近の試行**を「再送する」（古い試行は再送できない）→ 新しいキーが出るので、最後に `charge.refunded` も再送して無効化

## 7. 細かい修正（MenuFits にも同じ構造があれば）

- **404.html の画像・CSS は絶対パス**（`/assets/...`）にする。`/en/` 配下で 404 になると相対パスが解決できずアイコンが壊れた
- 英語の購入完了ページはキー表示後に「取得中…」の文言を隠す
- Windows で Python から書き換えると CRLF になることがある（`open(..., newline='')` で読み書き）
