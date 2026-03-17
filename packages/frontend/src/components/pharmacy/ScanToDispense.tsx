import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import BarcodeScanner from './BarcodeScanner';
import api from '../../services/api';

interface ScannedItem {
  id: string;
  code: string;
  name: string;
  genericName?: string;
  barcode?: string;
  sellingPrice: number;
  quantity: number;
}

interface DrugLookupResult {
  id: string;
  code: string;
  name: string;
  genericName?: string;
  barcode?: string;
  sellingPrice: number;
  unitCost: number;
  status: string;
}

export default function ScanToDispense() {
  const [dispenseQueue, setDispenseQueue] = useState<ScannedItem[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLooking, setIsLooking] = useState(false);

  const lookupDrug = useCallback(
    async (code: string) => {
      setIsLooking(true);
      setLookupError(null);
      setLastScanned(code);

      try {
        // Search by barcode first, then by item code
        const response = await api.get<{ data?: DrugLookupResult[]; } & DrugLookupResult[]>(
          '/stores/inventory/items',
          { params: { search: code, limit: 5 } },
        );

        const results: DrugLookupResult[] = Array.isArray(response.data)
          ? response.data
          : response.data?.data ?? [];

        // Find exact match by barcode or code
        const match =
          results.find(
            (item) =>
              item.barcode === code || item.code === code || item.code?.toLowerCase() === code.toLowerCase(),
          ) || results[0];

        if (!match) {
          setLookupError(`No item found for code "${code}"`);
          return;
        }

        // Check if already in queue
        const existingIdx = dispenseQueue.findIndex((qi) => qi.id === match.id);
        if (existingIdx >= 0) {
          setDispenseQueue((prev) =>
            prev.map((item, idx) =>
              idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item,
            ),
          );
        } else {
          setDispenseQueue((prev) => [
            ...prev,
            {
              id: match.id,
              code: match.code,
              name: match.name,
              genericName: match.genericName,
              barcode: match.barcode,
              sellingPrice: Number(match.sellingPrice) || 0,
              quantity: 1,
            },
          ]);
        }
      } catch {
        setLookupError(`Failed to look up item with code "${code}". Please try again.`);
      } finally {
        setIsLooking(false);
      }
    },
    [dispenseQueue],
  );

  const updateQuantity = (id: string, delta: number) => {
    setDispenseQueue((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (id: string) => {
    setDispenseQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    setDispenseQueue([]);
    setLastScanned(null);
    setLookupError(null);
  };

  const totalAmount = dispenseQueue.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity,
    0,
  );
  const totalItems = dispenseQueue.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ width: '100%' }}>
      {/* Scanner */}
      <div style={{ marginBottom: '16px' }}>
        <BarcodeScanner
          onScan={lookupDrug}
          placeholder="Scan barcode or enter item code…"
          autoFocus
        />
      </div>

      {/* Status messages */}
      {isLooking && (
        <div style={{ padding: '8px 12px', color: '#6b7280', fontSize: '13px', marginBottom: '8px' }}>
          Looking up "{lastScanned}"…
        </div>
      )}
      {lookupError && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '8px',
          }}
        >
          {lookupError}
        </div>
      )}

      {/* Dispense queue */}
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Queue header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '14px' }}>
            Dispense Queue{' '}
            <span style={{ fontWeight: 400, color: '#6b7280' }}>
              ({totalItems} item{totalItems !== 1 ? 's' : ''})
            </span>
          </div>
          {dispenseQueue.length > 0 && (
            <button
              type="button"
              onClick={clearQueue}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                color: '#ef4444',
                backgroundColor: 'transparent',
                border: '1px solid #fecaca',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {dispenseQueue.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '13px',
            }}
          >
            Scan items to add them to the dispense queue
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                  <th style={thStyle}>Item</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Qty</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Subtotal</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {dispenseQueue.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {item.code}
                        {item.genericName ? ` · ${item.genericName}` : ''}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          style={qtyBtnStyle}
                        >
                          −
                        </button>
                        <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 600 }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          style={qtyBtnStyle}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {item.sellingPrice.toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {(item.sellingPrice * item.quantity).toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '14px',
                          color: '#ef4444',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#f9fafb',
                borderTop: '2px solid #e5e7eb',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              <span>Total</span>
              <span>{totalAmount.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#374151',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  whiteSpace: 'nowrap',
};

const qtyBtnStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  lineHeight: 1,
};
