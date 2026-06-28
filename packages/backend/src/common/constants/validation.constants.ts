/** Maximum monetary value accepted by any financial DTO (≈ 100 million). */
export const MAX_MONEY = 100_000_000;

/** Maximum quantity accepted by any inventory/procurement DTO. */
export const MAX_QUANTITY = 1_000_000;

/** Common IsNumber options: reject NaN and Infinity. */
export const NUMBER_OPTS = { allowNaN: false, allowInfinity: false } as const;
