# I.Bunyanovsky Library v1.1

複数人でCD・DVDなどを登録し、一つの共有ライブラリを作るWebアプリです。

## 利用方法
- 個別の利用者ログイン画面はありません。
- 画面では共通パスワードだけを入力します。
- 入力者名は各端末に保存され、登録データに記録されます。
- アプリ内の表示文言は標準語です。

## Supabase設定
1. Supabaseで `ibunyanovsky-library` プロジェクトを作成します。
2. SQL Editorで `schema.sql` を全文実行します。
3. Authentication → Users → Add user で共通アカウントを1つ作成します。
   - Email: 管理用の実在メールアドレス
   - Password: 利用者に共有する共通パスワード
4. Settings → API Keys で Project URL と Publishable key (`sb_publishable_...`) を取得します。
5. `config.js` を編集します。

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxxx.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxx",
  SHARED_AUTH_EMAIL: "共通アカウントのメールアドレス"
};
```

Secret key / service_role key はGitHubやブラウザ側に置かないでください。

## GitHub Pages
ファイル一式をGitHubリポジトリへアップロードし、Settings → Pages から main / root を公開してください。
