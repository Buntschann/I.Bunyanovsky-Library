# I.Bunyanovsky Library v1.7.0

I.Bunyanovsky Library v1.7.0

バーコードなし検索を追加します。DBの追加変更はないためSQL実行は不要です。

更新順
1. Supabase → Edge Functions → lookup-media → Code/Edit
   v1.7.0 の index.ts を全文貼り替え → Deploy
2. GitHubで次を差し替え
   - index.html
   - styles.css
   - app.js
   - version.json
   - update-history.json
   config.jsは変更しない
3. アプリ → 設定 → アプリを更新

使い方
新規登録 → 品番・タイトルから検索
検索条件:
- 規格品番
- タイトル
- アーティスト / 作曲者
- レーベル / 発売元
- 発売年

規格品番だけの検索では、主にMusicBrainzとDiscogsが使われます。
楽天ブックスCD/DVD APIはメーカー品番を直接検索する入力パラメータを持たないため、タイトル・アーティスト・レーベルが入力されている場合の補助検索として利用します。

---

# I.Bunyanovsky Library v1.4.0 — Archive Explorer

v1.4.0では、バーコード検索の仕組みを大きく変更しました。

従来:
GitHub Pages（Safari） → 外部APIへ直接アクセス

v1.4.0:
GitHub Pages → Supabase Edge Function → 複数の外部データベース

これにより、ブラウザのCORS制限や外部APIへの直接アクセス問題を避けやすくなります。

## 検索順

Edge Functionは次を探索します。

1. 楽天ブックス CD（任意設定）
2. 楽天ブックス DVD/Blu-ray（任意設定）
3. MusicBrainz
4. Discogs（任意設定）
5. MusicBrainz CDStub
6. UPCitemdb

検索結果は候補として統合され、優先度の高いものを登録画面へ自動入力します。

---

# 既存v1.3.1からの更新手順

## 1. Supabase SQL Editor

`migration_v1.4.0.sql` を全文貼り付けて Run してください。

既存データは消えません。
追加される項目は以下だけです。

- cover_url
- source_name
- source_url

## 2. Supabase Edge Functionを作る

Supabase Dashboardで Edge Functions を開き、
`lookup-media` という名前のFunctionを作成してください。

このZIP内の

`supabase/functions/lookup-media/index.ts`

の内容を全文貼り付けてDeployします。

Functionはログイン済みアプリから呼び出す前提です。

## 3. GitHubのファイルを更新

以下をv1.4.0のものに差し替えてください。

- index.html
- styles.css
- app.js
- version.json
- update-history.json

追加:
- migration_v1.4.0.sql（GitHub公開は任意）

`config.js` は現在動作しているものをそのまま残してください。

---

# 追加検索サービス

追加設定なしでも以下は利用できます。

- MusicBrainz
- MusicBrainz CDStub
- UPCitemdb

## 楽天ブックスを有効にする（日本盤におすすめ）

楽天Web Serviceでアプリケーションを作成し、

- Application ID
- Access Key

を取得します。

Supabase DashboardのEdge Function用Secretsに次を設定します。

- `RAKUTEN_APPLICATION_ID`
- `RAKUTEN_ACCESS_KEY`

値はGitHubのconfig.jsには書きません。

楽天ブックスCD/DVD APIはJANコード検索に対応しているため、
日本国内のCD、落語、朗読、DVDなどの補完に向いています。

## Discogsを有効にする（音楽CDにおすすめ）

DiscogsでPersonal Access Tokenを取得し、
Supabase Secretsに次を設定します。

- `DISCOGS_TOKEN`

Discogsは音楽リリースのデータベースで、
クラシック、ジャズ、輸入盤、旧盤などの補完に向いています。

---

# 設定後の確認

アプリで

設定 → 検索サービス診断

を開きます。

例:

✓ 楽天ブックス CD/DVD
✓ MusicBrainz
✓ Discogs
✓ MusicBrainz CDStub
✓ UPCitemdb

「－」は故障ではなく、任意の追加設定がまだ行われていないサービスです。

---

# v1.4.0の遊び要素

検索中は「Archive Explorer」が表示され、
複数のデータベースを順番に探索します。

アプリ内の文言は標準的な日本語のみを使用しています。
