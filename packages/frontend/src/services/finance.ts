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
};

export default financeService;
