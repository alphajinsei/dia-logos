import { defineConfig } from 'astro/config';

// 公開URLは Cloudflare Pages 連携後に確定。決まったら site を書き換える。
export default defineConfig({
  site: 'https://blog.alphajinsei.com',
});
