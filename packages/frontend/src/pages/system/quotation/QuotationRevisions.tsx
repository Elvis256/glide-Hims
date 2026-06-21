import type { Quotation } from '../saas/_shared';
import { fmtMoney, fmtDateTime } from '../saas/_shared';

interface Props {
  quotation: Quotation;
}

export default function QuotationRevisions({ quotation }: Props) {
  const revisions = [...(quotation.revisions || [])].sort((a, b) => b.revisionNumber - a.revisionNumber);

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revision</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {revisions.map((rev) => (
            <tr key={rev.id} className={rev.revisionNumber === quotation.currentRevisionNumber ? 'bg-blue-50' : ''}>
              <td className="px-4 py-3 font-medium">
                v{rev.revisionNumber}{' '}
                {rev.revisionNumber === quotation.currentRevisionNumber && <span className="text-xs text-blue-600">(current)</span>}
              </td>
              <td className="px-4 py-3 text-right">{fmtMoney(rev.subtotalMinor, quotation.currency)}</td>
              <td className="px-4 py-3 text-right font-semibold">{fmtMoney(rev.totalMinor, quotation.currency)}</td>
              <td className="px-4 py-3 text-gray-600">{rev.lineItems?.length || 0} items</td>
              <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{rev.changeNotes || '\u2014'}</td>
              <td className="px-4 py-3 text-gray-500">{fmtDateTime(rev.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
