import { defineConfig } from 'astro/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://dia-logos.alphajinsei.com',
  // 物理・情報理論の記事に数式が出るので、LaTeX を描画できるようにする。
  markdown: {
    // 対話ログは原文のまま見せる。既定の引用符の自動変換（" → ” など）を止める。
    smartypants: false,
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});
