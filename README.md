# digest-playlist

好きな曲のダイジェスト・メドレーを作って聴けるアプリ（個人利用）。

現在はフェーズ0（技術検証）の段階です。詳しくは `plan.md`（プロジェクトのplanningフォルダ）を参照してください。

## 公開設定（初回のみ、手動で設定が必要です）

このリポジトリをGitHub Pagesで公開するには、GitHub上で以下の設定を一度だけ行ってください。

1. このリポジトリの **Settings** タブを開く
2. 左メニューの **Pages** を選ぶ
3. 「Build and deployment」の **Source** を `Deploy from a branch` にする
4. **Branch** を `main` / `/ (root)` にして **Save**
5. 数分待つと、`https://gonkyo306.github.io/digest-playlist/` で公開されます

## フォルダ構成
- `index.html` / `css/` / `js/` / `manifest.json` / `sw.js` / `icons/` … PWA本体
