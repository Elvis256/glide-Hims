import { useState, useMemo } from 'react';
import { formatCurrency } from '../../../lib/currency';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Calendar,
  ChevronDown,
  Eye,
  Edit2,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

type EntryStatus = 'draft' | 'posted' | 'reversed';

interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference: string;
  status: EntryStatus;
  lines: JournalLine[];
  createdBy: string;
  createdAt: string;
  reversedFromId?: string;
}

const entries: JournalEntry[] = [];

const accountsList: { code: string; name: string }[] = [];

const statusConfig: Record<EntryStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  posted: { label: 'Posted', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  reversed: { label: 'Reversed', color: 'bg-gray-100 text-gray-500', icon: RotateCcw },
};

export default function JournalEntriesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EntryStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { id: 'new-1', accountCode: '', accountName: '', description: '', debit: 0, credit: 0 },
    { id: 'new-2', accountCode: '', accountName: '', description: '', debit: 0, credit: 0 },
  ]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        entry.entryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.reference.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
      const matchesDateFrom = !dateFrom || entry.date >= dateFrom;
      const matchesDateTo = !dateTo || entry.date <= dateTo;
      const matchesAccount = !accountFilter ||
        entry.lines.some((line) => line.accountCode === accountFilter);
      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo && matchesAccount;
    });
  }, [searchQuery, statusFilter, dateFrom, dateTo, accountFilter]);

  const summaryStats = useMemo(() => {
    const totalDebits = entries.flatMap((e) => e.lines).reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = entries.flatMap((e) => e.lines).reduce((sum, line) => sum + line.credit, 0);
    const draftCount = entries.filter((e) => e.status === 'draft').length;
    const postedCount = entries.filter((e) => e.status === 'posted').length;
    return { totalDebits, totalCredits, draftCount, postedCount };
  }, []);



  const getEntryTotals = (lines: JournalLine[]) => {
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
    return { totalDebit, totalCredit, isBalanced: totalDebit === totalCredit };
  };

  const newLinesTotals = useMemo(() => getEntryTotals(newLines), [newLines]);

  const addNewLine = () => {
    setNewLines([...newLines, { id: `new-${Date.now()}`, accountCode: '', accountName: '', description: '', debit: 0, credit: 0 }]);
  };

  const removeNewLine = (id: string) => {
    if (newLines.length > 2) {
      setNewLines(newLines.filter((line) => line.id !== id));
    }
  };

  const updateNewLine = (id: string, field: keyof JournalLine, value: string | number) => {
    setNewLines(newLines.map((line) => {
      if (line.id === id) {
        if (field === 'accountCode') {
          const account = accountsList.find((a) => a.code === value);
          return { ...line, accountCode: value as string, accountName: account?.name || '' };
        }
        return { ...line, [field]: value };
      }
      return line;
    }));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
            <p className="text-sm text-gray-500 mt-1">Record and manage accounting transactions</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Entry
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="text-sm text-blue-600">Total Debits</div>
            <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(summaryStats.totalDebits)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="text-sm text-green-600">Total Credits</div>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(summaryStats.totalCredits)}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <Clock className="w-4 h-4" />
              Draft Entries
            </div>
            <p className="text-xl font-bold text-yellow-700 mt-1">{summaryStats.draftCount}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4" />
              Posted Entries
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{summaryStats.postedCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EntryStatus | 'all')}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="reversed">Reversed</option>
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <Filter className="w-4 h-4" />
            More Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account</label>
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Accounts</option>
                {accountsList.map((acc) => (
                  <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                ))}
              </select>
            </div>
            {(dateFrom || dateTo || accountFilter) && (
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setAccountFilter('');
                }}
                className="text-sm text-blue-600 hover:underline mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entry #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reference</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Credit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredEntries.map((entry) => {
                const StatusIcon = statusConfig[entry.status].icon;
                const totals = getEntryTotals(entry.lines);
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span
                        className="font-medium text-blue-600 hover:underline cursor-pointer"
                        onClick={() => setViewingEntry(entry)}
                      >
                        {entry.entryNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {entry.date}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                      <p className="text-xs text-gray-500">{entry.lines.length} lines</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.reference}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(totals.totalDebit)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(totals.totalCredit)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[entry.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[entry.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingEntry(entry)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {entry.status === 'draft' && (
                          <>
                            <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 hover:bg-green-100 rounded-lg text-green-600" title="Post">
                              <Check className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {entry.status === 'posted' && (
                          <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Reverse">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredEntries.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No journal entries found</p>
            </div>
          )}
        </div>
      </div>

      {/* View Entry Modal */}
      {viewingEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{viewingEntry.entryNumber}</h2>
                <p className="text-sm text-gray-500">{viewingEntry.description}</p>
              </div>
              <button onClick={() => setViewingEntry(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(80vh-140px)]">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{viewingEntry.date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reference</p>
                  <p className="font-medium">{viewingEntry.reference}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[viewingEntry.status].color}`}>
                    {statusConfig[viewingEntry.status].label}
                  </span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Debit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {viewingEntry.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-2 text-sm">
                          <span className="text-gray-500">{line.accountCode}</span> - {line.accountName}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{line.description}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">
                          {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-right font-medium">
                          {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-right font-semibold">Totals</td>
                      <td className="px-4 py-2 text-right font-bold">
                        {formatCurrency(getEntryTotals(viewingEntry.lines).totalDebit)}
                      </td>
                      <td className="px-4 py-2 text-right font-bold">
                        {formatCurrency(getEntryTotals(viewingEntry.lines).totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-4 text-sm text-gray-500">
                Created by {viewingEntry.createdBy} on {viewingEntry.createdAt}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              {viewingEntry.status === 'draft' && (
                <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <Check className="w-4 h-4" />
                  Post Entry
                </button>
              )}
              {viewingEntry.status === 'posted' && (
                <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100">
                  <RotateCcw className="w-4 h-4" />
                  Create Reversing Entry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Entry Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Create Journal Entry</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-180px)]">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Entry Date</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., INV-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Entry description"
                  />
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Account</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 w-32">Debit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 w-32">Credit</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {newLines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-2">
                          <select
                            value={line.accountCode}
                            onChange={(e) => updateNewLine(line.id, 'accountCode', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select account</option>
                            {accountsList.map((acc) => (
                              <option key={acc.code} value={acc.code}>{acc.code} - {acc.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateNewLine(line.id, 'description', e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Line description"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={line.debit || ''}
                            onChange={(e) => updateNewLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={line.credit || ''}
                            onChange={(e) => updateNewLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => removeNewLine(line.id)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
                            disabled={newLines.length <= 2}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-2">
                        <button
                          onClick={addNewLine}
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Add Line
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right font-bold">
                        {formatCurrency(newLinesTotals.totalDebit)}
                      </td>
                      <td className="px-4 py-2 text-right font-bold">
                        {formatCurrency(newLinesTotals.totalCredit)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {!newLinesTotals.isBalanced && (newLinesTotals.totalDebit > 0 || newLinesTotals.totalCredit > 0) && (
                <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Entry is not balanced. Difference: {formatCurrency(Math.abs(newLinesTotals.totalDebit - newLinesTotals.totalCredit))}
                </div>
              )}
              {newLinesTotals.isBalanced && newLinesTotals.totalDebit > 0 && (
                <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Entry is balanced
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Save as Draft
              </button>
              <button
                disabled={!newLinesTotals.isBalanced || newLinesTotals.totalDebit === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
