import React from 'react';
import type { PagePreset } from '../lib/print';

interface Props {
  value: PagePreset;
  onChange: (v: PagePreset) => void;
  className?: string;
}

const FORMAT_OPTIONS: { value: PagePreset; label: string }[] = [
  { value: 'receipt', label: 'POS / Thermal' },
  { value: 'a4', label: 'A4' },
  { value: 'a5', label: 'A5' },
  { value: 'letter', label: 'Letter' },
];

export default function PrintFormatSelector({ value, onChange, className = '' }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PagePreset)}
      className={`text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${className}`}
      title="Print format"
    >
      {FORMAT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
