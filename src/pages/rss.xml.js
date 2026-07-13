import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rss({
    title: 'dia-logos',
    description: 'AIとの対話から選び取った、思考の軌跡。',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      // RSS は平文なので、要約中の強調記号は落とす。
      description: post.data.summary.replace(/\*\*/g, ''),
      link: `/posts/${post.slug}/`,
    })),
  });
}
