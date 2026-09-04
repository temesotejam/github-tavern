# Project Tavern

公開GitHubリポジトリを、無機質な一覧ではなく「酒場の依頼・記録」のように選べる個人ポータルです。

## できること

- `temesotejam` が所有する**公開リポジトリをGitHub APIから自動取得**
- リポジトリ名・Description・Topics・言語・Copilot要約を横断検索
- 技術領域ごとの簡易分類
- カードを選ぶと、その場で概要を表示
- Copilot解析済みなら、README・構成・設定ファイルなどを根拠にした日本語説明を表示
- Copilot未解析の新規リポジトリでも、READMEから暫定説明を自動表示
- GitHub Pagesとして静的ホスティング可能

## Copilotによる自動説明

`.github/workflows/copilot-summaries.yml` が6時間ごとに公開リポジトリ一覧を確認します。

前回の `pushed_at` から変更がないリポジトリは再解析しません。新規または更新されたリポジトリだけを対象に、GitHub Copilot CLIが以下を参照して `data/summaries.json` を更新します。

- Repository metadata / Description / Topics
- README
- 使用言語
- ルートのファイル構成
- 直近コミット
- package.json / requirements.txt / platformio.ini など主要設定ファイル
- 小さなトップレベルソースファイル（必要な場合）

Repositoryは個人所有なので、現在のGitHub Copilot CLIはActionsの `GITHUB_TOKEN` と `copilot-requests: write` を使って実行できます。長期PATをPagesへ埋め込む構成にはしていません。

初回は公開リポジトリ数が多いため、定期実行では1回最大8件ずつ解析します。Actionsの **Refresh Copilot summaries → Run workflow** から `max_repos` を増やして手動実行することもできます。

## GitHub Pagesを有効にする（最初の1回だけ）

1. このリポジトリの **Settings** を開く
2. **Pages** を開く
3. **Build and deployment → Source** を `Deploy from a branch` にする
4. Branchを `main`、Folderを `/(root)` にする
5. Save

公開URLは通常こちらです。

`https://temesotejam.github.io/github-tavern/`

## ファイル構成

```text
index.html                          酒場UI
styles.css                         酒場テーマ
app.js                             GitHub API取得・検索・詳細表示
data/summaries.json                Copilot生成説明のキャッシュ
scripts/update-summaries.mjs       Copilot自動解析スクリプト
.github/agents/tavern-keeper.agent.md
.github/workflows/copilot-summaries.yml
```

## 方針

サイト側では公開GitHub APIしか読みません。Private Repositoryは対象外です。リポジトリの削除・変更・Issue作成などの書き込み操作は行いません。
