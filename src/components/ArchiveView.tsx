import React, { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Search, Trash2 } from 'lucide-react';
import type { SynthesisResult } from '../types/news';

interface ArchiveViewProps {
  onOpenSynthesis: (item: SynthesisResult) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({ onOpenSynthesis }) => {
  const [items, setItems] = useState<SynthesisResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadArchive = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/archive');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load archive.');
      setItems(data.items || []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load archive.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/archive/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch {
      // Ignore delete error
    }
  };

  const filtered = items.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.neutralHeadline.toLowerCase().includes(q) ||
      item.topicCategory.toLowerCase().includes(q) ||
      (item.extractedMeta?.siteName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Shared Server Cache
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Synthesized Archive
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Previously neutralized articles are cached on the server to eliminate duplicate AI calls and keep repeat lookups instantaneous.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter archive..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading cached briefings...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#16191D]">
          <h2 className="font-serif text-xl font-semibold text-slate-900 dark:text-slate-100">
            {items.length === 0 ? 'No cached briefings yet' : 'No matching briefings found'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {items.length === 0
              ? 'Synthesize any article URL, sample story, or Live Wire headline and it will automatically be stored here for instant retrieval.'
              : 'Try clearing your search filter to see all cached briefings.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#16191D]">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-blue-900 dark:text-blue-400">
                    {item.topicCategory}
                  </span>
                  {item.extractedMeta?.siteName && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{item.extractedMeta.siteName}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {new Date(item.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <h3 className="mt-1 font-serif text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {item.neutralHeadline}
                </h3>
                <p className="mt-1 line-clamp-1 text-xs text-slate-600 dark:text-slate-400">
                  {item.coreFacts[0] || item.historicalContext}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenSynthesis(item)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Read Briefing
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove cached briefing"
                  onClick={() => handleDelete(item.id)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer dark:border-slate-700 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
