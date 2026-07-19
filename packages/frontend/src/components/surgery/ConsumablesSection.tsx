import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Plus, Trash2, Loader2, Search } from 'lucide-react';
import { surgeryService } from '../../services/surgery';
import inventoryService from '../../services/inventory';
import { getApiErrorMessage } from '../../services/api';
import { formatCurrency } from '../../lib/currency';
import { confirmDialog } from '../ConfirmDialog';

interface Props {
  caseId: string;
}

export default function ConsumablesSection({ caseId }: Props) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [qty, setQty] = useState('1');
  const [phase, setPhase] = useState<'pre_op' | 'intra_op' | 'post_op'>('intra_op');

  const { data: consumables = [] } = useQuery({
    queryKey: ['surgery-consumables', caseId],
    queryFn: async () => (await surgeryService.consumables.list(caseId)).data,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['consumable-item-search', itemSearch],
    queryFn: () => inventoryService.items.list({ search: itemSearch, limit: 5 }),
    enabled: adding && itemSearch.length >= 2 && !selectedItem,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      surgeryService.consumables.record(caseId, {
        surgeryCaseId: caseId,
        itemId: selectedItem.id,
        quantityUsed: Number(qty),
        unitCost: Number(selectedItem.unitPrice ?? selectedItem.sellingPrice ?? selectedItem.costPrice ?? 0),
        usagePhase: phase,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgery-consumables', caseId] });
      setSelectedItem(null);
      setItemSearch('');
      setQty('1');
      toast.success('Consumable recorded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record consumable')),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => surgeryService.consumables.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgery-consumables', caseId] });
      toast.success('Consumable removed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to remove consumable')),
  });

  const total = consumables.reduce(
    (s: number, c: any) => s + Number(c.totalCost ?? Number(c.quantityUsed) * Number(c.unitCost)),
    0,
  );

  return (
    <div className="pt-4 border-t">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Consumables {consumables.length > 0 && `(${formatCurrency(total)})`}
        </h4>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {adding && (
        <div className="p-3 bg-gray-50 rounded-lg mb-2 space-y-2">
          {selectedItem ? (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{selectedItem.name}</span>
              <button onClick={() => setSelectedItem(null)} className="text-gray-400 text-xs">change</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search stock items..."
                className="w-full pl-7 pr-2 py-1.5 border rounded text-sm"
              />
              {items.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow max-h-32 overflow-y-auto">
                  {items.map((it: any) => (
                    <button
                      key={it.id}
                      onClick={() => setSelectedItem(it)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      {it.name} <span className="text-gray-400 text-xs">{it.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="number" min="0.1" step="0.1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-20 px-2 py-1.5 border rounded text-sm"
              title="Quantity"
            />
            <select value={phase} onChange={(e) => setPhase(e.target.value as any)} className="flex-1 px-2 py-1.5 border rounded text-sm">
              <option value="pre_op">Pre-op</option>
              <option value="intra_op">Intra-op</option>
              <option value="post_op">Post-op</option>
            </select>
            <button
              onClick={() => addMutation.mutate()}
              disabled={!selectedItem || Number(qty) <= 0 || addMutation.isPending}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm disabled:opacity-50 flex items-center gap-1"
            >
              {addMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}

      {consumables.length === 0 ? (
        <p className="text-xs text-gray-400">No consumables recorded.</p>
      ) : (
        <div className="space-y-1">
          {consumables.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
              <div>
                <span className="font-medium">{c.item?.name || c.itemId}</span>
                <span className="text-gray-500"> × {Number(c.quantityUsed)}</span>
                <span className="text-xs text-gray-400 ml-2 capitalize">{String(c.usagePhase).replace('_', '-')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{formatCurrency(Number(c.totalCost ?? Number(c.quantityUsed) * Number(c.unitCost)))}</span>
                <button
                  onClick={async () => {
                    if (await confirmDialog(`Remove ${c.item?.name || 'item'} from this case?`)) {
                      removeMutation.mutate(c.id);
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
