import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import broadsheetDeskImg from '../assets/images/calm_broadsheet_desk_1794635726251.jpg';
import type { DailyDigestResult, RssArticleItem, RssCategory } from '../types/news';

export const DailyDigestView: React.FC = () => {
  const [category, setCategory] = useState<RssCategory | 'all'>('all');
  const [articles, setArticles] = useState<RssArticleItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [digest, setDigest] = useState<DailyDigestResult | null>(null);
  const [showPlainText, setShowPlainText] = useState(false);
  const [showCronPanel, setShowCronPanel] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const loadFeeds = async (cat: RssCategory | 'all') => {
    setLoadingFeed(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/rss?category=${cat}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load RSS feeds.');
      const list = (data.items || []) as RssArticleItem[];
      setArticles(list);
      // Pre-select top 5 balanced articles
      setSelectedIds(new Set(list.slice(0, 5).map((item) => item.id)));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to fetch RSS feeds.');
    } finally {
      setLoadingFeed(false);
    }
  };

  useEffect(() => {
    loadFeeds(category);
  }, [category]);

  const toggleArticle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 7) {
        next.add(id);
      }
      return next;
    });
  };

  const handleCompileDigest = async () => {
    const chosen = articles.filter((a) => selectedIds.has(a.id));
    if (chosen.length === 0) {
      setErrorMsg('Select at least 1 headline (up to 7) to compile today’s calm digest.');
      return;
    }

    setCompiling(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Digest compilation failed.');
      setDigest(data as DailyDigestResult);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate daily digest.');
    } finally {
      setCompiling(false);
    }
  };

  const handleCopyPlainText = async () => {
    if (!digest) return;
    await navigator.clipboard.writeText(digest.plainTextEmail);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!digest) return;
    const blob = new Blob([digest.plainTextEmail], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stillpress-digest-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-stillpress-host.com';

  const cronYaml = `name: Stillpress 8AM Calm Digest
on:
  schedule:
    - cron: '0 13 * * *' # 08:00 AM EST daily
  workflow_dispatch:

jobs:
  send-digest:
    runs-on: ubuntu-latest
    steps:
      - name: Compile Daily Digest from RSS Wire
        run: |
          curl -s -X POST "${origin}/api/digest" \\
            -H "Content-Type: application/json" \\
            -d '{}' > digest.json
          node -e '
            const fs = require("fs");
            const data = JSON.parse(fs.readFileSync("digest.json", "utf8"));
            console.log(data.plainTextEmail);
          ' > morning-briefing.txt`;

  return (
    <div className="space-y-8">
      {/* Masthead Card */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#16191D]">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-stretch">
          <div className="p-6 sm:p-8 lg:col-span-7 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Once-A-Day Calm Briefing
              </p>
              <h1 className="headline-balance mt-2 font-serif text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-slate-100">
                Daily RSS Digest Edition
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Replace endless feeds with a single morning edition. Pick up to 7 stories from verified RSS feeds and compile them into one plain-text briefing you can finish in three minutes.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={compiling || loadingFeed || selectedIds.size === 0}
                onClick={handleCompileDigest}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-950 disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                {compiling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compiling {selectedIds.size} stories...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Compile Morning Digest ({selectedIds.size})
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowCronPanel((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Terminal className="h-3.5 w-3.5" />
                {showCronPanel ? 'Hide Cron Automation' : 'Cron Automation Setup'}
              </button>
            </div>
          </div>

          <div className="relative min-h-[220px] lg:col-span-5 bg-slate-100 dark:bg-slate-900">
            <img
              src={broadsheetDeskImg}
              alt="Morning coffee beside a folded broadsheet newspaper in soft window light"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {showCronPanel && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#16191D]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Automated 8:00 AM Daily Digest Cron Workflow
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Schedule this GitHub Actions workflow to invoke Stillpress’s live RSS + Gemini digest endpoint every morning and pipe the plain-text briefing to Resend or SendGrid.
              </p>
            </div>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <code>{cronYaml}</code>
          </pre>
        </section>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
        >
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left: Live RSS Feed Selector */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-[#16191D]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Live RSS Queue (Max 7)
            </h2>
            <button
              type="button"
              onClick={() => loadFeeds(category)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer dark:text-slate-400 dark:hover:text-slate-100"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingFeed ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(['all', 'world', 'technology', 'science', 'policy'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  category === cat
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loadingFeed ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading live RSS stories...
            </div>
          ) : (
            <ul className="mt-4 max-h-[540px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
              {articles.map((item) => {
                const checked = selectedIds.has(item.id);
                return (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleArticle(item.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {item.source}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{item.category}</span>
                        </div>
                        <p className="mt-0.5 text-xs font-medium leading-snug text-slate-900 dark:text-slate-100">
                          {item.title}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right: Compiled Calm Digest */}
        <section className="lg:col-span-7">
          {digest ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10 dark:border-slate-800 dark:bg-[#16191D]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5 dark:border-slate-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-900 dark:text-blue-400">
                    {digest.editionDate}
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    Stillpress Morning Edition
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPlainText((prev) => !prev)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {showPlainText ? 'Broadsheet View' : 'Plain-Text Email View'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPlainText}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {copiedText ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedText ? 'Copied' : 'Copy Email'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    .txt
                  </button>
                </div>
              </div>

              {showPlainText ? (
                <pre className="mt-6 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-5 font-mono text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  {digest.plainTextEmail}
                </pre>
              ) : (
                <div className="mt-6 space-y-7">
                  <p className="max-w-[68ch] text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {digest.overview}
                  </p>

                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {digest.briefings.map((item, idx) => (
                      <article key={idx} className="py-6 first:pt-2 last:pb-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono tabular-nums">0{idx + 1}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-blue-900 dark:text-blue-400">
                            {item.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.source}</span>
                        </div>

                        <h3 className="headline-balance mt-1.5 font-serif text-xl font-semibold text-slate-900 dark:text-slate-100">
                          {item.neutralHeadline}
                        </h3>

                        <ul className="mt-3 max-w-[68ch] space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          {item.coreFacts.map((fact, fIdx) => (
                            <li key={fIdx} className="flex gap-2.5">
                              <span
                                aria-hidden="true"
                                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                              />
                              <span>{fact}</span>
                            </li>
                          ))}
                        </ul>

                        {item.perspectiveNote && (
                          <p className="mt-3 max-w-[68ch] text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Perspectives:{' '}
                            </span>
                            {item.perspectiveNote}
                          </p>
                        )}

                        {item.historicalContext && (
                          <p className="mt-2 max-w-[68ch] text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              Historical Context:{' '}
                            </span>
                            {item.historicalContext}
                          </p>
                        )}

                        {item.originalUrl && (
                          <a
                            href={item.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-blue-900 hover:underline dark:text-blue-400"
                          >
                            Source report
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-8 sm:p-12 text-center dark:border-slate-800 dark:bg-[#16191D]">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Digest Ready to Compile
              </p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Select up to 7 stories on the left
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Stillpress will read the selected RSS feeds, remove sensationalist language, and produce one calm morning briefing with an exportable plain-text email.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
