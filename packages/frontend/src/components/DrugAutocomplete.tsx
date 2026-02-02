import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { storesService, type Drug } from '../services/stores';

interface DrugAutocompleteProps {
  value: string;
  onChange: (drug: { name: string; id?: string; genericName?: string }) => void;
  placeholder?: string;
  className?: string;
}

export default function DrugAutocomplete({
  value,
  onChange,
  placeholder = 'Search drug...',
  className = '',
}: DrugAutocompleteProps) {
  const [search, setSearch] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update search when value changes externally
  useEffect(() => {
    setSearch(value);
  }, [value]);

  // Search drugs query
  const { data: drugs = [], isLoading } = useQuery({
    queryKey: ['drugs-search', search],
    queryFn: () => storesService.items.search(search, true, 20),
    enabled: search.length >= 2 && focused,
    staleTime: 30000,
  });

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (drug: Drug) => {
    setSearch(drug.name);
    onChange({ name: drug.name, id: drug.id, genericName: drug.genericName });
    setIsOpen(false);
    setFocused(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange({ name: val });
    setIsOpen(val.length >= 2);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => {
            setFocused(true);
            if (search.length >= 2) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="input text-sm pl-8"
        />
        <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
        {isLoading && (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-2 top-1/2 -translate-y-1/2" />
        )}
      </div>

      {isOpen && drugs.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {drugs.map((drug) => (
            <button
              key={drug.id}
              type="button"
              onClick={() => handleSelect(drug)}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 flex justify-between items-center"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{drug.name}</p>
                {drug.genericName && drug.genericName !== drug.name && (
                  <p className="text-xs text-gray-500">{drug.genericName}</p>
                )}
              </div>
              <span className="text-xs text-gray-400">{drug.code}</span>
            </button>
          ))}
        </div>
      )}

      {isOpen && !isLoading && drugs.length === 0 && search.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
          No drugs found
        </div>
      )}
    </div>
  );
}
