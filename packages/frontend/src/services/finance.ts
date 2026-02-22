import api from './api';

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
  isDefault: boolean;
  country?: string;
  createdAt?: string;
}

export interface ExchangeRate {
  id: string;
  fromCurrencyId: string;
  fromCurrency?: Currency;
  toCurrencyId: string;
  toCurrency?: Currency;
  rate: number;
  effectiveDate: string;
  expiryDate?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface CreateCurrencyDto {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  country?: string;
}

export interface CreateExchangeRateDto {
  fromCurrencyId: string;
  toCurrencyId: string;
  rate: number;
  effectiveDate: string;
  expiryDate?: string;
}

export const financeService = {
  // Currencies
  currencies: {
    list: async (): Promise<Currency[]> => {
      const response = await api.get<Currency[]>('/finance/currencies');
      return response.data;
    },
    getById: async (id: string): Promise<Currency> => {
      const response = await api.get<Currency>(`/finance/currencies/${id}`);
      return response.data;
    },
    create: async (data: CreateCurrencyDto): Promise<Currency> => {
      const response = await api.post<Currency>('/finance/currencies', data);
      return response.data;
    },
    update: async (id: string, data: Partial<CreateCurrencyDto>): Promise<Currency> => {
      const response = await api.patch<Currency>(`/finance/currencies/${id}`, data);
      return response.data;
    },
    setDefault: async (id: string): Promise<Currency> => {
      const response = await api.post<Currency>(`/finance/currencies/${id}/set-default`);
      return response.data;
    },
    toggleActive: async (id: string): Promise<Currency> => {
      const response = await api.patch<Currency>(`/finance/currencies/${id}/toggle-active`);
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/finance/currencies/${id}`);
    },
  },

  // Exchange Rates
  exchangeRates: {
    list: async (): Promise<ExchangeRate[]> => {
      const response = await api.get<ExchangeRate[]>('/finance/exchange-rates');
      return response.data;
    },
    getCurrent: async (fromCode: string, toCode: string): Promise<ExchangeRate> => {
      const response = await api.get<ExchangeRate>(`/finance/exchange-rates/current`, {
        params: { from: fromCode, to: toCode },
      });
      return response.data;
    },
    create: async (data: CreateExchangeRateDto): Promise<ExchangeRate> => {
      const response = await api.post<ExchangeRate>('/finance/exchange-rates', data);
      return response.data;
    },
    update: async (id: string, rate: number): Promise<ExchangeRate> => {
      const response = await api.patch<ExchangeRate>(`/finance/exchange-rates/${id}`, { rate });
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/finance/exchange-rates/${id}`);
    },
  },

  // Payment Methods
  paymentMethods: {
    list: async (): Promise<Array<{ id: string; name: string; code: string; isActive: boolean }>> => {
      const response = await api.get('/finance/payment-methods');
      return response.data;
    },
    create: async (data: { name: string; code: string }): Promise<{ id: string; name: string; code: string }> => {
      const response = await api.post('/finance/payment-methods', data);
      return response.data;
    },
    toggleActive: async (id: string): Promise<void> => {
      await api.patch(`/finance/payment-methods/${id}/toggle-active`);
    },
  },

  // Chart of Accounts
  accounts: {
    list: async (facilityId: string, params?: { type?: string; active?: boolean }) => {
      const response = await api.get('/finance/accounts', { params: { facilityId, ...params } });
      return response.data as any[];
    },
    tree: async (facilityId: string) => {
      const response = await api.get('/finance/accounts/tree', { params: { facilityId } });
      return response.data as any[];
    },
    create: async (facilityId: string, data: Record<string, any>) => {
      const response = await api.post('/finance/accounts', { facilityId, ...data });
      return response.data;
    },
    update: async (id: string, data: Record<string, any>) => {
      const response = await api.patch(`/finance/accounts/${id}`, data);
      return response.data;
    },
    deactivate: async (id: string) => {
      const response = await api.post(`/finance/accounts/${id}/deactivate`);
      return response.data;
    },
  },

  // Journal Entries
  journals: {
    list: async (facilityId: string, params?: { status?: string; startDate?: string; endDate?: string }) => {
      const response = await api.get('/finance/journals', { params: { facilityId, ...params } });
      return response.data as any[];
    },
    getById: async (id: string) => {
      const response = await api.get(`/finance/journals/${id}`);
      return response.data;
    },
    create: async (data: Record<string, any>) => {
      const response = await api.post('/finance/journals', data);
      return response.data;
    },
    post: async (id: string) => {
      const response = await api.post(`/finance/journals/${id}/post`);
      return response.data;
    },
  },

  // Fiscal Periods
  fiscalPeriods: {
    list: async (facilityId: string, year?: number) => {
      const response = await api.get('/finance/fiscal-periods', { params: { facilityId, year } });
      return response.data as any[];
    },
    createYear: async (facilityId: string, year: number, startDate: string, endDate: string) => {
      const response = await api.post('/finance/fiscal-years', { facilityId, year, startDate, endDate });
      return response.data;
    },
    closePeriod: async (id: string) => {
      const response = await api.post(`/finance/fiscal-periods/${id}/close`);
      return response.data;
    },
  },

  // Financial Reports
  reports: {
    trialBalance: async (facilityId: string, asOfDate?: string) => {
      const response = await api.get('/finance/reports/trial-balance', { params: { facilityId, asOfDate } });
      return response.data;
    },
    incomeStatement: async (facilityId: string, startDate: string, endDate: string) => {
      const response = await api.get('/finance/reports/income-statement', { params: { facilityId, startDate, endDate } });
      return response.data;
    },
    balanceSheet: async (facilityId: string, asOfDate?: string) => {
      const response = await api.get('/finance/reports/balance-sheet', { params: { facilityId, asOfDate } });
      return response.data;
    },
  },

  // Dashboard
  dashboard: async (facilityId: string) => {
    const response = await api.get('/finance/dashboard', { params: { facilityId } });
    return response.data;
  },
};

export default financeService;
