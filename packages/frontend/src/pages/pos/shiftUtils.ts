/**
 * Maps a backend PosShift entity (cash_sales/mobile_money_sales/card_sales,
 * register/cashier RELATIONS, decimal-strings) onto the flat display shape the
 * POS pages use. Three pages had invented fields (totalCash, cashierName,
 * salesCount…) that never existed — every figure rendered blank/NaN/0.
 */
export interface ShiftDisplay {
  id: string;
  status: string;
  registerName: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  expectedBalance?: number;
  cashSales: number;
  mobileMoneySales: number;
  cardSales: number;
  totalSales: number;
  transactionCount: number;
  cashDifference?: number;
}

export function mapShift(s: any): ShiftDisplay {
  const cash = Number(s?.cashSales) || 0;
  const momo = Number(s?.mobileMoneySales) || 0;
  const card = Number(s?.cardSales) || 0;
  return {
    id: s?.id,
    status: s?.status || 'open',
    registerName: s?.register?.name || '—',
    cashierName: s?.cashier?.fullName || s?.cashier?.username || '—',
    openedAt: s?.openedAt,
    closedAt: s?.closedAt || undefined,
    openingBalance: Number(s?.openingBalance) || 0,
    closingBalance: s?.closingBalance != null ? Number(s.closingBalance) : undefined,
    expectedBalance: s?.expectedBalance != null ? Number(s.expectedBalance) : undefined,
    cashSales: cash,
    mobileMoneySales: momo,
    cardSales: card,
    totalSales: cash + momo + card,
    transactionCount: Number(s?.transactionCount) || 0,
    cashDifference: s?.cashDifference != null ? Number(s.cashDifference) : undefined,
  };
}
