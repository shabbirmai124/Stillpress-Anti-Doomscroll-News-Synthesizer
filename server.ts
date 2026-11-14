import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { extractArticleFromUrl } from './server/extractor.ts';
import {
  deleteArchivedSynthesis,
  generateDailyDigest,
  getArchivedSyntheses,
  synthesizeArticle,
} from './server/gemini.ts';
import { fetchRssArticles } from './server/rss.ts';
import { buildExtensionFiles, buildExtensionZipBuffer } from './server/extensionBuilder.ts';
import type { ExtractedMeta, RssArticleItem, RssCategory } from './src/types/news.ts';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Allow requests from the packaged Chrome Extension popup
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'stillpress' });
  });

  app.post('/api/extract', async (req, res) => {
    try {
      const { url } = req.body as { url?: string };
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'A valid article URL is required.' });
        return;
      }
      const extracted = await extractArticleFromUrl(url);
      res.json(extracted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Extraction failed.';
      res.status(422).json({ error: message });
    }
  });

  app.post('/api/synthesize', async (req, res) => {
    try {
      const { url, text, title, siteName, byline, crossVerify = true } = req.body as {
        url?: string;
        text?: string;
        title?: string;
        siteName?: string;
        byline?: string;
        crossVerify?: boolean;
      };

      let articleText = text?.trim() || '';
      let meta: ExtractedMeta = {
        title: title?.trim() || 'Submitted News Article',
        byline: byline || null,
        siteName: siteName || null,
        url: url || null,
        excerpt: null,
        wordCount: articleText ? articleText.split(/\s+/).filter(Boolean).length : 0,
      };

      if (!articleText && url) {
        const extracted = await extractArticleFromUrl(url);
        articleText = extracted.text;
        meta = extracted.meta;
      }

      if (!articleText) {
        res.status(400).json({ error: 'Provide either an article URL or pasted article text.' });
        return;
      }

      const synthesis = await synthesizeArticle({
        text: articleText,
        meta,
        crossVerify: Boolean(crossVerify),
      });

      res.json(synthesis);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to synthesize article.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/rss', async (req, res) => {
    try {
      const categoryParam = String(req.query.category || 'all').toLowerCase();
      const allowed: Array<RssCategory | 'all'> = ['all', 'world', 'technology', 'science', 'policy'];
      const category = allowed.includes(categoryParam as RssCategory | 'all')
        ? (categoryParam as RssCategory | 'all')
        : 'all';

      const data = await fetchRssArticles(category);
      res.json(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load RSS feeds.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/digest', async (req, res) => {
    try {
      const { articles } = req.body as { articles?: RssArticleItem[] };
      let targetArticles = articles;

      if (!targetArticles || targetArticles.length === 0) {
        const feed = await fetchRssArticles('all');
        targetArticles = feed.items.slice(0, 6);
      }

      const digest = await generateDailyDigest(targetArticles);
      res.json(digest);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to compile daily digest.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/archive', async (_req, res) => {
    try {
      const items = await getArchivedSyntheses();
      res.json({ items });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load archive.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/archive/:id', async (req, res) => {
    try {
      const removed = await deleteArchivedSynthesis(req.params.id);
      res.json({ removed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove item.';
      res.status(500).json({ error: message });
    }
  });

  function resolveOrigin(req: express.Request): string {
    if (process.env.APP_URL) return process.env.APP_URL;
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
    return `${proto}://${host}`;
  }

  app.get('/api/extension/files', async (req, res) => {
    try {
      const origin = resolveOrigin(req);
      const { files } = await buildExtensionFiles(origin);
      res.json({ origin, files });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate extension files.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/extension/download', async (req, res) => {
    try {
      const origin = resolveOrigin(req);
      const zipBuffer = await buildExtensionZipBuffer(origin);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="stillpress-chrome-extension.zip"');
      res.send(zipBuffer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to package extension ZIP.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stillpress server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
