import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Globe, Pill, AlertTriangle, Calendar } from 'lucide-react';
import { pharmacyService, type DrugLabel } from '../../services/pharmacy';

interface DrugLabelPreviewProps {
  prescriptionItemId: string;
  patientName?: string;
  pharmacyName?: string;
  onClose?: () => void;
}

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'lg', name: 'Luganda' },
  { code: 'sw', name: 'Swahili' },
];

export default function DrugLabelPreview({
  prescriptionItemId,
  patientName,
  pharmacyName,
  onClose,
}: DrugLabelPreviewProps) {
  const [language, setLanguage] = useState('en');

  const { data: label, isLoading, error } = useQuery<DrugLabel>({
    queryKey: ['drug-label', prescriptionItemId, language],
    queryFn: () => pharmacyService.labels.generate(prescriptionItemId, language),
    enabled: !!prescriptionItemId,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Controls - hidden when printing */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-gray-500" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm bg-white"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            <Printer className="w-4 h-4" />
            Print Label
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Label Preview */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to generate label. Please try again.
        </div>
      )}

      {label && (
        <div className="border-2 border-dashed border-gray-400 rounded-lg p-6 bg-white max-w-md mx-auto print:border-solid print:border-black">
          {/* Header */}
          <div className="border-b border-gray-300 pb-3 mb-3">
            {pharmacyName && (
              <p className="text-xs text-gray-500 text-center mb-1">{pharmacyName}</p>
            )}
            <div className="flex items-center gap-2 justify-center">
              <Pill className="w-5 h-5 text-blue-600 print:text-black" />
              <h3 className="text-lg font-bold text-center">{label.header}</h3>
            </div>
            {label.raw.translatedDrugName !== label.raw.drugName && language !== 'en' && (
              <p className="text-sm text-gray-600 text-center italic mt-1">
                ({label.raw.translatedDrugName})
              </p>
            )}
          </div>

          {/* Patient Info */}
          {patientName && (
            <div className="mb-3 pb-2 border-b border-gray-200">
              <p className="text-sm">
                <span className="font-semibold">Patient:</span> {patientName}
              </p>
            </div>
          )}

          {/* Body */}
          <div className="space-y-2 mb-3 pb-3 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-semibold">Dose:</span> {label.raw.dose}
              </div>
              <div>
                <span className="font-semibold">Frequency:</span> {label.raw.frequency}
              </div>
              <div>
                <span className="font-semibold">Duration:</span> {label.raw.duration}
              </div>
              <div>
                <span className="font-semibold">Qty:</span> {label.raw.quantity}
              </div>
            </div>

            {label.raw.instructions && (
              <div className="text-sm mt-2">
                <span className="font-semibold">Instructions:</span> {label.raw.instructions}
              </div>
            )}

            {label.raw.translatedDirections && language !== 'en' && (
              <div className="text-sm italic text-gray-600 bg-gray-50 p-2 rounded">
                {label.raw.translatedDirections}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="space-y-1">
            {label.raw.translatedWarnings && (
              <div className="flex items-start gap-1 text-xs text-amber-700 bg-amber-50 p-2 rounded">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{label.raw.translatedWarnings}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{label.raw.date}</span>
              </div>
              <span>Rx#: {label.raw.prescriptionNumber}</span>
            </div>
          </div>
        </div>
      )}

      {/* Print-specific CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:border-solid, .print\\:border-solid * { visibility: visible; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
