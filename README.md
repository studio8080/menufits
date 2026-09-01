# MenuFits（メニューフィッツ）

飲食店のためのメニュー作成ツール。ひらいて、打ちかえて、PDF。

https://menufits.kokokikaku.com/

## 特徴
- 登録・インストール不要。ブラウザだけで完結（単一HTML）
- デザイン11種（和・洋・中・エスニック・ポップ／縦書き・写真メニュー対応）
- 書体 和文21種 × 欧文18種、背景パターン23種、飾り枠9種（位置・拡縮・色の調整可）
- 文字装飾（太字・下線・マーカー・差し色）、品目ライブラリ、店舗プロフィール
- A4ぴったりのPDF出力。データは端末の localStorage にのみ保存

## 構成
- `index.html` — アプリ本体（LP・エディタ・スタイル・スクリプトすべて同梱）
- `page.css` / `analytics.js` — 静的サブページの共通スタイルとGA4ローダー
- `pro.html` — 料金・Proガイド（この1ページで購入まで完結させる）
- `pro-unlock.html` — 決済後のリダイレクト先（ライセンスキーの表示・解放）
- `faq.html` / `releases.html` — よくある質問・更新履歴
- `privacy.html` / `tokushoho.html` — プライバシー・免責／特定商取引法に基づく表記
- `CNAME` — カスタムドメイン設定（GitHub Pages）

有料プラン（MenuFits Pro）の設計と実装計画は `PRO-PLAN.md` を参照。

### 単一ファイル構成について
`index.html` は引き続き単一ファイルで完結させる（CSS・JSを外に出さない）。
`page.css` / `analytics.js` は静的サブページ専用。ただし **GA4ローダーだけは
`analytics.js` と `index.html` のインライン版で二重に持っている**ので、
測定IDを入れるときは両方に入れること。

## ローカルでの確認
サブページは相対パスで `page.css` / `analytics.js` を読むため、
`file://` で開くとスタイルが当たらない。簡易サーバーを立てて確認する。

```bash
python -m http.server 8123
```

## デプロイ
main ブランチへの push で GitHub Pages に自動反映されます。

© ここ企画
