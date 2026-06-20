import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { BookOpen, FileText, Loader2, ExternalLink } from 'lucide-react';

interface DocPage {
  slug: string;
  title: string;
}
interface DocSection {
  title: string;
  pages: DocPage[];
}

export default function SystemDocsPage() {
  const [sections, setSections] = useState<DocSection[]>([]);
  const [loadingToc, setLoadingToc] = useState(true);
  const [tocError, setTocError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ sections: DocSection[] }>('/system/docs')
      .then((res) => {
        if (cancelled) return;
        setSections(res.data?.sections || []);
        setLoadingToc(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setTocError(err?.response?.data?.message || err.message || 'Failed to load documentation');
        setLoadingToc(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allPages = useMemo(() => sections.flatMap((s) => s.pages), [sections]);
  const activeSlug = searchParams.get('p') || allPages[0]?.slug || 'index';
  const activePage = allPages.find((p) => p.slug === activeSlug);

  const iframeSrc = `${api.defaults.baseURL}/system/docs/${activeSlug}`;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      <aside className="w-64 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2 text-gray-900">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Documentation</h2>
        </div>
        {loadingToc ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : tocError ? (
          <p className="text-sm text-red-600">{tocError}</p>
        ) : (
          <nav className="space-y-4">
            {sections.map((section) => (
              <div key={section.title}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {section.pages.map((page) => {
                    const active = page.slug === activeSlug;
                    return (
                      <li key={page.slug}>
                        <button
                          type="button"
                          onClick={() => setSearchParams({ p: page.slug })}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                            active
                              ? 'bg-blue-50 font-medium text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <FileText className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                          <span className="truncate">{page.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {activePage?.title || 'Documentation'}
            </h1>
            <p className="text-xs text-gray-500">Operator documentation • System administrators only</p>
          </div>
          <a
            href={iframeSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
          </a>
        </div>
        <iframe
          key={activeSlug}
          src={iframeSrc}
          title={activePage?.title || 'Documentation'}
          className="flex-1 w-full bg-white"
          sandbox="allow-scripts allow-popups allow-forms"
        />
      </main>
    </div>
  );
}
