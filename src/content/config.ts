import { defineCollection, z } from 'astro:content';

// 記事＝1つの対話。front matter がサマリー（自分用の索引）、本文が軌跡（他者向けの生ログ）。
const posts = defineCollection({
  type: 'content',
  schema: z.object({
    // 表題（一覧・記事ページの見出し）
    title: z.string(),
    // スナップショットの日付。「これは <date> 時点の私」を明示するために必須。
    date: z.coerce.date(),
    // サマリー＝結論の要約。一覧では概要、記事ページでは冒頭のTL;DR兼目次になる。
    summary: z.string(),
    // 要点＝内容そのものの結晶。サマリー(索引)と軌跡(過程)の中間の粒度。
    // 「何の話だったか」でも「どう考えたか」でもなく、「何が分かったか」を構造化して置く層。
    // markdown で書ける（箇条書き・強調が使える）。無い記事もあるので任意。
    notes: z.string().optional(),
    // 何を選び取ったかのタグ（テーマ）。日付以外の索引軸。
    tags: z.array(z.string()).default([]),
    // 下書きフラグ。true の記事は本番ビルドから除外。
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
