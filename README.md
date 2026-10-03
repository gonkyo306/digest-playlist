# Playlish（digest-playlist）

好きな曲のダイジェスト（Apple公開の試聴音源、約30秒）をつないで、プレイリストとして連続再生できるアプリです（個人利用、Androidスマホ向けPWA）。

- 公開URL：https://gonkyo306.github.io/digest-playlist/
- 実装：素のJavaScript（HTML / CSS / JavaScript のみ、ビルド不要）

## 主な機能
- 曲・アーティスト・アルバムの検索（iTunes Search API）と、その場での試聴
- 複数のプレイリストの作成・編集（名前・画像・曲の削除）・削除
- プレイリストの連続再生（シャッフルON/OFF、2秒のクロスフェード、画面オフ・バックグラウンドでも継続）
- 端末内（IndexedDB）への保存。ログイン不要

## フォルダ構成
- `index.html` / `css/` / `js/` / `manifest.json` / `sw.js` / `icons/` … PWA本体（`js/views/` に各画面）
- `test/` … Unitテスト（`*.test.js`、Node.js標準のテストランナー）と、ブラウザ上での動作確認テスト（`test/e2e/`、Playwright）
- `.github/workflows/test.yml` … GitHub Actions（テストの自動実行）
- `docs/` … ドキュメント
  - `project-charter.md` … プロジェクト憲章（目的・利用者・制約）
  - `acceptance-criteria.md` … 受入基準（現在の仕様）
  - `acceptance-test-cases.md` … 受入テストケース一覧と実施状況

## 開発
- Unitテスト：`npm test`
- ブラウザ（E2E）テスト：`npm run test:e2e`（初回のみ `npm ci` のあと `npx playwright install chromium`）。リポジトリを静的サーバーで配信し、iTunes APIをモックして、実際のChromiumで画面の挙動（自動スクロール、編集モードの位置、曲の削除、作成・検索・追加など）を確認する。
- ローカル確認：リポジトリのルートで静的サーバーを起動する（例：`python3 -m http.server 8123`）

### ブランチ運用
- `main` に直接 push せず、作業ブランチを切ってプルリクエストを作り、テストが成功してから `main` にマージする（`main` へのプッシュ・`main` 宛てのプルリクエストで、GitHub Actions が Unitテストと E2E テストを実行する）。
- `main` の保護（GitHub の Settings → Branches → Add branch ruleset）で、「Require a pull request before merging」と「Require status checks to pass（`test`）」を有効にすると、テストが通らない変更を `main` に入れられなくなる（任意。リポジトリの管理者が設定する）。

### 更新手順
- `main` に反映されると、GitHub Pages に数分で公開される。
- **`sw.js` の `SHELL_FILES` に含まれるファイルを変更したときは、必ず `CACHE_NAME` の末尾の番号を増やすこと**（増やさないと、インストール済みの端末に古い画面が配信され続ける）。
- 端末側は、アプリを開き直すと新しい版に切り替わる（切り替わらないときはもう一度開き直す）。

## 公開設定（初回のみ、GitHub上で手動設定）
1. リポジトリの **Settings** → **Pages** を開く
2. 「Build and deployment」の **Source** を `Deploy from a branch` にする
3. **Branch** を `main` / `/ (root)` にして **Save**

## 技術メモ
- iTunes Search API・試聴音源とも `Access-Control-Allow-Origin: *` が返るため、ブラウザから直接利用できる（音源は `crossOrigin="anonymous"` で読み込む）。
- 画面オフ・バックグラウンドでも、Web Audio API のタイマー・音声再生・クロスフェードは止まらない（Galaxy S26で確認）。ロック画面・通知からの操作は Media Session API で行う。
- プレイリストには曲の識別情報（ID）のみを保存し、曲名・ジャケット等は表示時に取得する。画像（プレイリスト画像）は長辺800px程度にリサイズ・JPEG圧縮して保存する。
