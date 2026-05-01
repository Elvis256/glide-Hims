import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Package, Pill, FlaskConical, Wrench, ChevronDown } from 'lucide-react';
import api from '../../services/api';

export interface SelectedItem {
  id: string | null;
  source: 'inventory' | 'free_text';
  code: string;
  name: string;
  unit: string;
  lastPrice?: number;
  sellingPrice?: number;
  currentStock?: number;
  isControlled?: boolean;
  isDrug?: boolean;
  genericName?: string;
}

interface CatalogItemResult {
  id: string;
  source: 'inventory';
  code: string;
  name: string;
  unit: string;
  lastPurchasePrice: number;
  sellingPrice: number;
  currentStock?: number;
  isControlled?: boolean;
  isDrug?: boolean;
  genericName?: string;
  category?: string;
}

export interface CatalogItemPickerProps {
  value: SelectedItem | null;
  onChange: (item: SelectedItem | null) => void;
  module?: 'pharmacy' | 'general' | 'lab' | 'asset' | 'all';
  placeholder?: string;
  storeId?: string;
  disabled?: boolean;
  allowFreeText?: boolean;
  size?: 'sm' | 'md';
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SourceBadge({ isDrug, category }: { isDrug?: boolean; category?: string }) {
  if (isDrug) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
        <Pill className="w-3 h-3" />
        Pharmacy
      </span>
    );
  }
  if (category?.toLowerCase().includes('lab')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
        <FlaskConical className="w-3 h-3" />
        Lab
      </span>
    );
  }
  if (category?.toLowerCase().includes('asset')) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
        <Wrench className="w-3 h-3" />
        Asset
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
      <Package className="w-3 h-3" />
      Inventory
    </span>
  );
}

export function CatalogItemPicker({
  value,
  onChange,
  module = 'all',
  placeholder = 'Search items…',
  storeId,
  disabled = false,
  allowFreeText = false,
  size = 'md',
}: CatalogItemPickerProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(inputValue, 250);

  const { data: results = [], isFetching } = useQuery<CatalogItemResult[]>({
    queryKey: ['catalog-search', debouncedQuery, module, storeId],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const params = new URLSearchParams({ q: debouncedQuery.trim(), limit: '20' });
      if (module !== 'all') params.set('module', module);
      if (storeId) params.set('storeId', storeId);
      const res = await api.get<CatalogItemResult[]>(`/catalog/items/search?${params}`);
      return res.data;
    },
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 5 * 60 * 1000,
  });

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectItem = useCallback(
    (item: CatalogItemResult) => {
      onChange({
        id: item.id,
        source: 'inventory',
        code: item.code,
        name: item.name,
        unit: item.unit,
        lastPrice: item.lastPurchasePrice,
        sellingPrice: item.sellingPrice,
        currentStock: item.currentStock,
        isControlled: item.isControlled,
        isDrug: item.isDrug,
        genericName: item.genericName,
      });
      setInputValue('');
      setIsOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen && e.key !== 'Escape') {
        if (results.length > 0 || inputValue.trim()) setIsOpen(true);
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && results[highlightedIndex]) {
            selectItem(results[highlightedIndex]);
          } else if (allowFreeText && inputValue.trim()) {
            onChange({
              id: null,
              source: 'free_text',
              code: '',
              name: inputValue.trim(),
              unit: 'unit',
            });
            setInputValue('');
            setIsOpen(false);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setInputValue('');
          break;
      }
    },
    [isOpen, results, highlightedIndex, inputValue, selectItem, allowFreeText, onChange],
  );

  const inputPadding = size === 'sm' ? 'px-2 py-1 text-sm' : 'px-3 py-2';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  // If item is selected, show the selected state
  if (value) {
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border ${
          disabled
            ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
            : 'bg-indigo-50 border-indigo-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="min-w-0">
            <span className={`font-medium truncate block ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
              {value.name}
            </span>
            {value.code && (
              <span className={`font-mono text-gray-500 ${size === 'sm' ? 'text-xs' : 'text-xs'}`}>
                {value.code}
              </span>
            )}
          </div>
          {value.source !== 'free_text' && (
            <SourceBadge isDrug={value.isDrug} />
          )}
          {value.currentStock !== undefined && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              Stock: {value.currentStock}
            </span>
          )}
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Clear selection"
          >
            <X className={iconSize} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${iconSize} text-gray-400 pointer-events-none`} />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (inputValue.trim() || results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-8 pr-8 ${inputPadding} border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed`}
          autoComplete="off"
        />
        {isFetching && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className={`${iconSize} border-2 border-indigo-400 border-t-transparent rounded-full animate-spin`} />
          </div>
        )}
        {!isFetching && inputValue && (
          <button
            type="button"
            onClick={() => { setInputValue(''); setIsOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className={iconSize} />
          </button>
        )}
      </div>

      {isOpen && (inputValue.trim().length >= 1) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {results.length === 0 && !isFetching && (
            <div className="px-3 py-3 text-sm text-gray-500 text-center">
              {allowFreeText ? (
                <span>
                  No items found.{' '}
                  <button
                    type="button"
                    className="text-indigo-600 underline"
                    onClick={() => {
                      onChange({ id: null, source: 'free_text', code: '', name: inputValue.trim(), unit: 'unit' });
                      setInputValue('');
                      setIsOpen(false);
                    }}
                  >
                    Use "{inputValue.trim()}" as free text
                  </button>
                </span>
              ) : (
                'No items found'
              )}
            </div>
          )}
          {results.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
              className={`w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors ${
                idx === highlightedIndex ? 'bg-indigo-50' : ''
              } ${idx > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{item.name}</span>
                    <SourceBadge isDrug={item.isDrug} category={item.category} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="font-mono text-xs text-gray-500">{item.code}</span>
                    {item.genericName && item.genericName !== item.name && (
                      <span className="text-xs text-gray-400 italic truncate">{item.genericName}</span>
                    )}
                    <span className="text-xs text-gray-500">{item.unit}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {item.lastPurchasePrice > 0 && (
                    <div className="text-xs text-gray-600">
                      Cost: {item.lastPurchasePrice.toLocaleString()}
                    </div>
                  )}
                  {item.currentStock !== undefined && (
                    <div className={`text-xs ${item.currentStock <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                      Stock: {item.currentStock}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
