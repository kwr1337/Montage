/**
 * Количества в спецификации: без принудительного floor — как в файле и в БД.
 */

function normalizeNumString(raw: string): string {
  return raw.trim().replace(/\s/g, '').replace(',', '.');
}

/** Парсинг ввода пользователя / файла (запятая или точка как разделитель). */
export function parseSpecQuantityInput(raw: string): number | null {
  const t = normalizeNumString(raw);
  if (t === '' || t === '-' || t === '+' || t === '.' || t === '+.' || t === '-.') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Отображение в таблице спецификации (ru-RU, до 8 знаков после запятой, без floor).
 */
export function formatSpecQuantityForDisplay(
  value: number | string | null | undefined,
  empty: string = ''
): string {
  if (value === null || value === undefined || value === '') return empty;
  const n =
    typeof value === 'string'
      ? Number(normalizeNumString(value))
      : Number(value);
  if (!Number.isFinite(n)) return empty;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
    useGrouping: true,
  }).format(n);
}
