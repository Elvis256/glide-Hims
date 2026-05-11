import {
  toCents,
  fromCents,
  sumCents,
  eqCents,
  cmpMoney,
  maxMoney,
} from '../money';

describe('common/utils/money', () => {
  describe('toCents', () => {
    it('handles strings (TypeORM decimal output) without float drift', () => {
      expect(toCents('0.1')).toBe(10);
      expect(toCents('0.2')).toBe(20);
      expect(toCents('99.99')).toBe(9999);
      expect(toCents('1234567.89')).toBe(123456789);
    });
    it('handles numbers and edge cases', () => {
      expect(toCents(0)).toBe(0);
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
      expect(toCents('')).toBe(0);
      expect(toCents(NaN)).toBe(0);
    });
    it('rounds sub-cent inputs to nearest cent', () => {
      expect(toCents(0.005)).toBe(1);
      expect(toCents(0.004)).toBe(0);
    });
  });

  describe('sumCents + eqCents', () => {
    it('sums 0.1 + 0.2 exactly to 0.30 (the canonical IEEE 754 trap)', () => {
      const total = sumCents('0.1', '0.2');
      expect(total).toBe(30);
      expect(fromCents(total)).toBe(0.3);
      expect(eqCents(total, toCents('0.30'))).toBe(true);
    });
    it('sums many lines without drift', () => {
      const lines = Array.from({ length: 1000 }, () => '0.01');
      expect(sumCents(...lines)).toBe(1000); // exactly $10.00
    });
  });

  describe('cmpMoney', () => {
    it('compares decimal strings correctly across thresholds', () => {
      expect(cmpMoney('9999.99', '10000.00')).toBe(-1);
      expect(cmpMoney('10000.00', '10000.00')).toBe(0);
      expect(cmpMoney('10000.01', '10000.00')).toBe(1);
    });
  });

  describe('maxMoney', () => {
    it('returns the larger amount as decimal number', () => {
      expect(maxMoney('100.50', '200.75', '50.00')).toBe(200.75);
      expect(maxMoney(0, 0)).toBe(0);
    });
  });
});
