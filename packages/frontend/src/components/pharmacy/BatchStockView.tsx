import { useQuery } from '@tanstack/react-query';
import { pharmacyService } from '../../services/pharmacy';
import type { BatchStock } from '../../services/pharmacy';

interface BatchStockViewProps {
  itemId: string;
  itemName?: string;
}

function statusBadge(batch: BatchStock) {
  if (batch.isExpired || batch.status === 'expired') {
    return { label: 'Expired', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' };
  }
  if (batch.status === 'quarantined') {
    return { label: 'Quarantined', bg: '#fefce8', color: '#854d0e', border: '#fde68a' };
  }
  if (batch.isNearExpiry) {
    return { label: 'Near Expiry', bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' };
  }
  return { label: 'Active', bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function BatchStockView({ itemId, itemName }: BatchStockViewProps) {
  const { data: batches = [], isLoading, error } = useQuery<BatchStock[]>({
    queryKey: ['batch-stock', itemId],
    queryFn: () => pharmacyService.batchStock.getByItem(itemId),
    enabled: !!itemId,
    staleTime: 30000,
  });

  const totalAvailable = batches.reduce((sum, b) => sum + (b.availableQuantity ?? 0), 0);
  const totalQuantity = batches.reduce((sum, b) => sum + (b.quantity ?? 0), 0);

  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
        Loading batch stock…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px' }}>
        Failed to load batch stock data.
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        {itemName && (
          <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>{itemName}</h3>
        )}
        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280' }}>
          <span>
            <strong>{batches.length}</strong> batch{batches.length !== 1 ? 'es' : ''}
          </span>
          <span>
            Total: <strong>{totalQuantity}</strong>
          </span>
          <span>
            Available: <strong>{totalAvailable}</strong>
          </span>
        </div>
      </div>

      {batches.length === 0 ? (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#9ca3af',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
          }}
        >
          No batch stock records found for this item.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle}>Batch #</th>
                <th style={thStyle}>Expiry Date</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Quantity</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Reserved</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Available</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const badge = statusBadge(batch);
                const rowBg = batch.isExpired
                  ? '#fef2f2'
                  : batch.isNearExpiry
                    ? '#fffbeb'
                    : 'transparent';

                return (
                  <tr key={batch.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: rowBg }}>
                    <td style={tdStyle}>
                      <code style={{ fontSize: '12px' }}>{batch.batchNumber}</code>
                    </td>
                    <td style={tdStyle}>{formatDate(batch.expiryDate)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{batch.quantity}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{batch.reservedQuantity}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                      {batch.availableQuantity}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 500,
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
