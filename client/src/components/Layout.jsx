import { useState } from 'react';
import { Menu, ChevronLeft } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout({ title, subtitle, actions, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen">
      {sidebarOpen && <Sidebar />}
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-neutral-200 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-700"
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
              {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
