import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, X, Loader2 } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  prefix?: string; // e.g. flag emoji or dial code
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  noOptionsText?: string;
  allowFreeText?: boolean; // allow typing a custom value not in options
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  loading = false,
  disabled = false,
  className = '',
  noOptionsText = 'No options found',
  allowFreeText = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.prefix ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const handleOpen = useCallback(() => {
    if (disabled || loading) return;
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [disabled, loading]);

  const handleSelect = useCallback((opt: SelectOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        className={`input text-sm py-1.5 flex items-center gap-1 cursor-pointer select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0" />
        ) : null}
        {selected ? (
          <>
            {selected.prefix && <span className="shrink-0">{selected.prefix}</span>}
            <span className="flex-1 truncate">{selected.label}</span>
            <X
              className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 shrink-0"
              onClick={handleClear}
            />
          </>
        ) : (
          <span className="flex-1 text-gray-400 truncate">{placeholder}</span>
        )}
        {!loading && <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (allowFreeText && e.key === 'Enter' && query.trim()) {
                  onChange(query.trim());
                  setOpen(false);
                  setQuery('');
                }
              }}
              placeholder={allowFreeText ? 'Type to search or enter custom...' : 'Type to search...'}
              className="w-full text-sm px-2 py-1 border border-gray-200 rounded outline-none focus:border-blue-400"
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              allowFreeText && query.trim() ? (
                <li
                  onClick={() => { onChange(query.trim()); setOpen(false); setQuery(''); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-blue-600"
                >
                  <span>＋ Add &ldquo;{query.trim()}&rdquo;</span>
                </li>
              ) : (
                <li className="px-3 py-2 text-sm text-gray-400 text-center">{noOptionsText}</li>
              )
            ) : (
              filtered.map(opt => (
                <li
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${
                    opt.value === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {opt.prefix && <span className="shrink-0">{opt.prefix}</span>}
                  <span className="truncate">{opt.label}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
