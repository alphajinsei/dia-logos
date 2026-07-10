# 思考の名刺 — AIとの対話から選び取った思考の軌跡を公開するブログ

AIが普遍的知識をならした後に希少なのは「何を選び取ったか」と「その理由と軌跡」だ、という考えに基づく。
各記事は **サマリー（自分用の索引）** と **軌跡（他者向けの生に近い対話ログ）** のセット。
記事には日付を刻み、「その時点の私」のスナップショットとして残す。

## 構成

- **Astro**（静的サイト生成） + **Cloudflare Pages**（配信） + **GitHub**（真実のソース）
- 真実はこのリポの `src/content/posts/*.md`。Astro もホストも「表示係」で、丸ごと移設可能（データ主権）。
- 完全公開（認証なし）。ゆえに記事化時の**個人情報の剪定は必須**。

```
[対話] --/記事化(Skill)--> src/content/posts/*.md --git push--> [Cloudflare Pages が Astro をビルド] --> 公開
```

## 日々の運用（あなたの操作はこれだけ）

### 新しい対話を記事にする
1. Claude Code で、記事にしたい対話中に **「記事化して」** と言う（Skill `kijika` が起動）
2. Skill が front matter＋サマリー＋軌跡を生成し、個人情報を剪定して `src/content/posts/` に保存
3. 剪定内容の報告を確認して `git push` → 数分で公開

### 過去の対話をまとめて記事にする（一度きりの棚卸し）
1. claude.ai → Settings → Privacy → **Export data** をリクエスト（全会話が届く）
2. 届いた zip を解凍し `conversations.json` をこのリポ直下に置く
3. `node scripts/split-export.mjs` → `export/` に1会話1ファイルで展開（`export/` は gitignore 済み）
4. 記事にしたい会話を選び、Claude に渡して記事化（新規と同じ Skill ルール）

## ローカルで確認

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ に静的出力
```

## Cloudflare Pages 設定（初回のみ）

- Framework preset: **Astro**
- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`
- 公開URLが決まったら `astro.config.mjs` の `site` を実URLに更新する。

## 剪定の原則

完全公開のため、実名・住所・連絡先・ローカルパス・認証情報・未公開の逡巡は必ず除去する。
一方で、思考の生々しさ・迷い・反論は削らない（丸めると情報量が下がる）。
詳細は `.claude/skills/kijika/SKILL.md`。
