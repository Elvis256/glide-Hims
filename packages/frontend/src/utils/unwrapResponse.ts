/**
 * Safely extract an array from API response data.
 *
 * The backend ResponseTransformInterceptor may unwrap `{ data, total }` into
 * `{ statusCode, data: [...], meta: {total}, timestamp }`, then the Axios
 * response interceptor strips the envelope so the caller receives a flat array.
 *
 * However, some callers still do `.data` on the result expecting the original
 * `{ data: [...], total }` shape. This helper normalises both cases:
 *   - If the value is already an array, return it.
 *   - If it's an object with a `.data` array property, return that.
 *   - Otherwise return an empty array.
 */
export function asList<T = any>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && 'data' in data) {
    const inner = (data as Record<string, unknown>).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}
