import { useEffect, useState } from 'react';
import { ArchiveView } from './components/ArchiveView';
import { DailyDigestView } from './components/DailyDigestView';
import { ExtensionBuilderView } from './components/ExtensionBuilderView';
import { Header, type WorkspaceTab } from './components/Header';
import { SynthesizerWorkspace } from './components/SynthesizerWorkspace';
import type { SynthesisResult } from './types/news';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('synthesizer');
  const [activeResult, setActiveResult] = useState<SynthesisResult | null>(null);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('stillpress-theme') === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('stillpress-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('stillpress-theme', 'light');
    }
  }, [isDark]);

  const handleDownloadExtension = () => {
    setActiveTab('extension');
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F6F6F4] text-slate-900 dark:bg-[#111315] dark:text-slate-100">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onPrimaryAction={handleDownloadExtension}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {activeTab === 'synthesizer' && (
          <SynthesizerWorkspace
            activeResult={activeResult}
            onResultReady={setActiveResult}
            isDark={isDark}
            onToggleTheme={() => setIsDark((prev) => !prev)}
          />
        )}

        {activeTab === 'digest' && <DailyDigestView />}

        {activeTab === 'extension' && <ExtensionBuilderView />}

        {activeTab === 'archive' && (
          <ArchiveView
            onOpenSynthesis={(item) => {
              setActiveResult(item);
              setActiveTab('synthesizer');
            }}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-[#16191D]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-serif font-semibold text-slate-800 dark:text-slate-200">
              Stillpress
            </span>
            <span aria-hidden="true">·</span>
            <span>Independent Calm Broadsheet &amp; Anti-Doomscroll Reader</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveTab('synthesizer')}
              className="hover:text-slate-900 cursor-pointer dark:hover:text-slate-200"
            >
              Synthesizer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('digest')}
              className="hover:text-slate-900 cursor-pointer dark:hover:text-slate-200"
            >
              Daily Digest
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('extension')}
              className="hover:text-slate-900 cursor-pointer dark:hover:text-slate-200"
            >
              Chrome Extension
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
