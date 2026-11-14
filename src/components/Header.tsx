import React from 'react';

export type WorkspaceTab = 'synthesizer' | 'digest' | 'extension' | 'archive';

interface HeaderProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onPrimaryAction: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onPrimaryAction,
}) => {
  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'synthesizer', label: 'Synthesizer' },
    { id: 'digest', label: 'Daily Digest' },
    { id: 'extension', label: 'Chrome Extension' },
    { id: 'archive', label: 'Archive' },
  ];

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-[#16191D]/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('synthesizer');
          }}
          className="font-serif text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-100"
        >
          Stillpress
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-900 ${
                  isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-blue-900 dark:bg-blue-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-950 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            Download Extension
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav className="flex md:hidden items-center gap-5 overflow-x-auto border-t border-slate-200 px-4 py-2.5 text-xs font-medium dark:border-slate-800">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'font-semibold text-blue-900 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
