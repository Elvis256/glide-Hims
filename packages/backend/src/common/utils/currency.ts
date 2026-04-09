import Decimal from 'decimal.js';

export function multiply(a: number, b: number): number {
  return new Decimal(a).times(b).toDecimalPlaces(2).toNumber();
}

export function add(a: number, b: number): number {
  return new Decimal(a).plus(b).toDecimalPlaces(2).toNumber();
}

export function subtract(a: number, b: number): number {
  return new Decimal(a).minus(b).toDecimalPlaces(2).toNumber();
}

export function divide(a: number, b: number): number {
  return new Decimal(a).dividedBy(b).toDecimalPlaces(2).toNumber();
}

export function roundCurrency(value: number): number {
  return new Decimal(value).toDecimalPlaces(2).toNumber();
}
