import Parser from 'rss-parser';
import crypto from 'node:crypto';
import type { RssArticleItem, RssCategory } from '../src/types/news.ts';

interface FeedSource {
  name: string;
  url: string;
  category: RssCategory;
}

const FEED_SOURCES: FeedSource[] = [
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world' },
  { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', category: 'world' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'technology' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'technology' },
  { name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/top/science.xml', category: 'science' },
  { name: 'NASA Breaking', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', category: 'science' },
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'policy' },
  { name: 'NPR Politics', url: 'https://feeds.npr.org/1014/rss.xml', category: 'policy' },
];

const parser = new Parser({
  timeout: 8000,
  headers: {
    'User-Agent': 'StillpressRSS/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  },
});

interface CachedFeed {
  items: RssArticleItem[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const feedCache = new Map<string, CachedFeed>();

function cleanSnippet(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
}

export async function fetchRssArticles(category: RssCategory | 'all' = 'all'): Promise<{
  items: RssArticleItem[];
  sourcesChecked: number;
  failedSources: string[];
}> {
  const cacheKey = category;
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      items: cached.items,
      sourcesChecked: FEED_SOURCES.filter((s) => category === 'all' || s.category === category).length,
      failedSources: [],
    };
  }

  const targetFeeds =
    category === 'all'
      ? FEED_SOURCES
      : FEED_SOURCES.filter((feed) => feed.category === category);

  const failedSources: string[] = [];

  const results = await Promise.allSettled(
    targetFeeds.map(async (source) => {
      const feed = await parser.parseURL(source.url);
      const items = (feed.items || []).slice(0, 8).map((entry): RssArticleItem => {
        const link = entry.link || entry.guid || '';
        const title = (entry.title || 'Untitled article').replace(/\s+/g, ' ').trim();
        const id = crypto
          .createHash('sha1')
          .update(`${source.name}:${link || title}`)
          .digest('hex')
          .slice(0, 12);

        return {
          id,
          title,
          link,
          source: source.name,
          category: source.category,
          pubDate: entry.isoDate || entry.pubDate || new Date().toISOString(),
          snippet: cleanSnippet(entry.contentSnippet || entry.content || entry.summary),
        };
      });
      return items;
    })
  );

  const collected: RssArticleItem[] = [];
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      collected.push(...result.value);
    } else {
      failedSources.push(targetFeeds[idx].name);
    }
  });

  // Sort newest first and deduplicate by link
  const seenLinks = new Set<string>();
  const deduped = collected
    .filter((item) => {
      if (!item.link || seenLinks.has(item.link)) return false;
      seenLinks.add(item.link);
      return true;
    })
    .sort((a, b) => {
      const ta = Date.parse(a.pubDate) || 0;
      const tb = Date.parse(b.pubDate) || 0;
      return tb - ta;
    });

  if (deduped.length > 0) {
    feedCache.set(cacheKey, { items: deduped, fetchedAt: Date.now() });
  }

  return {
    items: deduped,
    sourcesChecked: targetFeeds.length,
    failedSources,
  };
}
