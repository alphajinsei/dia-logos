# dia-logos — プロジェクトの引き継ぎドキュメント

別チャットの Claude が最初に読む前提で書いている。このファイルで思想・現状・次の一手・
守るべき一線を把握できるようにしてある。運用手順の詳細は [README.md](./README.md)、
記事化ルールの正本は [.claude/skills/kijika/SKILL.md](./.claude/skills/kijika/SKILL.md)。

## これは何か

ユーザーが Claude との対話から選び取った「思考の軌跡」を公開するブログ。
`https://dia-logos.alphajinsei.com` で**完全公開**（認証なし）。

名前 `dia-logos` の由来：διά「〜を通して」＋ λόγος「言葉・理」＝
「対話を通して理に至る」。この企画の本質を一語で表している。

## なぜやるのか（思想 — ここを外すと的を外す）

1. **希少性の移動**：普遍的知識はAIに集約され誰でも取り出せる。だから「知っていること」は
   もう希少でない。希少なのは巨大な知の集合から**何を選び取ったか**、さらにその
   **選択の理由と軌跡**（点ではなく軌道）。
2. **本当の核＝AIによる思想の私的増幅への対抗**：みんながAIと話しすぎて各自の世界観を
   私的に増幅した結果、初対面での相互理解が難しくなった。自分の思考の軌跡を「名刺がわり」に
   開くことで、考え方の癖・迷い方・何を面白がるかを他者に渡す。エコーチェンバーの逆をやる。
3. **これは名刺であってブログではない**。読まれ方を最適化しない（バズを意識した瞬間に
   平均＝スープに戻り、情報量が下がる）。この姿勢が一貫性の核。

## 成果物の形（思想が構造に落ちている）

各記事＝1つの対話。2層のセットで、**並置ではなく入れ子**：

- **サマリー**（front matter の `summary`）＝自分用の索引。結論の要約。単体で読めて、
  同時に本文への目次になる。
- **軌跡**（本文）＝他者向けの、生に近い対話ログ。ここが情報量の本体。**丸めない**。
  迷い・反論・逡巡をそのまま残す（均すと情報量が下がる）。
- 各記事に**日付**を刻む＝「その時点の私」のスナップショット。思想が後で変わっても記事は直さない。
  名刺というより年輪。変化そのものを見せる。

## 守るべき一線（完全公開ゆえ絶対）

- **記事化時の個人情報の剪定は必須・妥協しない**。実名（本人・家族・第三者）、自宅が割れる地名、
  連絡先、ローカル絶対パス、認証情報、他プロジェクトの秘匿情報、本人がまだ見せたくない逡巡。
  迷ったら消す。剪定と誇張は別物：個人情報は削るが思考の生々しさは削らない。
- **生ログを公開リポに入れない**。`conversations.json` と `export/` は `.gitignore` 済み。
  リポに入るのは剪定済みの md だけ。

## 技術構成

```
[対話] --/記事化(Skill kijika)--> src/content/posts/*.md --git push--> [Cloudflare Pages が Astro をビルド] --> 公開
```

- **Astro**（静的サイト生成）＋ **Cloudflare Pages**（配信）＋ **GitHub**（真実のソース）
- リポ: `github.com/alphajinsei/dia-logos`（public）
- ドメイン: `alphajinsei.com` はお名前.com購入・CloudflareでDNS一元管理。
  サブドメイン `dia-logos.alphajinsei.com` を Pages のカスタムドメインに割当済み。
- **真実はこのリポの `src/content/posts/*.md`**。Astro もホストも「表示係」で丸ごと移設可能
  （＝データ主権はユーザーにある）。
- ページ: トップ（日付降順の索引）/ 記事ページ（サマリー→軌跡の入れ子）/ タグページ / RSS。
- `astro.config.mjs` の `site` は `https://dia-logos.alphajinsei.com`。

### 主要ファイル
- `src/content/config.ts` — 記事スキーマ（title / date / summary / tags / draft）。
  front matter はこれと一致させる。
- `src/pages/index.astro` / `posts/[...slug].astro` / `tags/[tag].astro` / `rss.xml.js`
- `src/layouts/Base.astro`, `src/styles/global.css`
- `.claude/skills/kijika/SKILL.md` — 記事化ルールの正本
- `scripts/split-export.mjs` — 過去ログ一括分割スクリプト

### ローカル
`npm install` → `npm run dev`（localhost:4321）／ `npm run build`（dist/ 出力）。
Node 22 / npm 10 / git は導入済み。`gh` CLI は**未導入**（GitHub操作はブラウザ＋手動 remote）。

## 進捗（2026-07-11 時点）

**完成・稼働中：**
- [x] Astro 雛形（一覧・日付索引・タグ・RSS・サマリー/軌跡の入れ子）
- [x] `/記事化` Skill（kijika）＝変換ルール固定・剪定必須
- [x] 過去ログ分割スクリプト
- [x] GitHub リポ `alphajinsei/dia-logos` に push 済み
- [x] Cloudflare Pages 連携・デプロイ（`.pages.dev` で公開確認済み）
- [x] カスタムドメイン `dia-logos.alphajinsei.com` 割当（200応答・稼働中）
- [x] 最初の記事（この企画そのものを綴ったもの）を公開

**残：**
- [ ] **過去ログの棚卸し**（本来の主目的の後半）。手順：
  ①claude.ai → Settings → Privacy → Export data をリクエスト（全会話がメールで届く）
  ②`conversations.json` をリポ直下に置く
  ③`node scripts/split-export.mjs` で会話ごとに `export/` へ分割（gitignore済）
  ④記事にしたい会話を選び、kijika と同じルールで記事化 → push
- [ ] 将来やりたくなるかもしれない拡張：対話特有の見せ方（発言者ごとの吹き出し等）。
  Astro を選んだのはこの拡張余地のため（Hugo比）。

## 日々の運用（ユーザーの操作はこれだけ）

- 新規：記事にしたい対話中に「記事化して」と言う（Skill kijika 起動）→ 剪定報告を確認 → push。
- 過去分：上の「残」の手順。新規と同じ Skill ルールで記事化する。

## Cloudflare の詰まりどころ（次に触る人へ）

新規作成の導線が Workers 優先になっていて「アプリケーションを作成する」だと Workers に飛ぶ。
Pages を作るには Workers & Pages 画面 → 作成 → 下部の「Pages を導入しようとお考えですか？始める」
→「既存の Git リポジトリをインポートする」から入る。Framework preset に **Astro** が出れば正解の画面。
（このプロジェクトは連携済みなので、通常はもう触らない。push すれば自動で再ビルドされる。）
