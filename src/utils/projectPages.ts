/** Одна страница ответа GET /projects (Laravel paginator и «сломанные» варианты). */
export function parseProjectsPagesResponse(response: any): { rows: any[]; lastPage: number } {
  let rows: any[] = [];
  let lastPage = 1;
  if (!response) return { rows, lastPage };
  const r = response;
  if (Array.isArray(r)) return { rows: r, lastPage: 1 };
  if (Array.isArray(r.data)) {
    rows = r.data;
    lastPage = Number(r.meta?.last_page ?? r.last_page ?? 1) || 1;
  } else if (r.data && typeof r.data === 'object' && Array.isArray(r.data.data)) {
    rows = r.data.data;
    const meta = r.data.meta || r.meta || {};
    lastPage = Number(meta.last_page ?? r.last_page ?? 1) || 1;
  } else if (r.data && typeof r.data === 'object' && Array.isArray((r.data as any).items)) {
    rows = (r.data as any).items;
    const meta = (r.data as any).meta || r.meta || {};
    lastPage = Number(meta.last_page ?? r.last_page ?? 1) || 1;
  }
  return { rows, lastPage: Math.max(1, lastPage) };
}

function hasExplicitLastPage(response: any): boolean {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return false;
  const r = response as any;
  const candidates = [r.meta?.last_page, r.last_page, r.data?.meta?.last_page, r.data?.last_page];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1) return true;
  }
  return false;
}

/** Сколько всего записей по метаданным пагинатора (если есть). */
function readMetaTotal(response: any): number | null {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return null;
  const r = response as any;
  for (const v of [r.meta?.total, r.total, r.data?.meta?.total]) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Собирает все страницы проектов.
 *
 * Нельзя обрывать догрузку по `rows.length < per_page`: часть API отдаёт фиксированный размер
 * страницы меньше запрошенного (например 8 из 15) — тогда в таблице остаётся одна порция и одна страница UI.
 * Учитываем `meta.total` (в т.ч. запоминаем с первой страницы, если дальше meta не приходит).
 * Без total и без last_page догружаем, пока не придёт пустая страница.
 */
export async function fetchAllProjectPages(
  fetchPage: (page: number, perPage: number) => Promise<any>,
  perPage: number,
  options?: { maxPages?: number }
): Promise<any[]> {
  const maxPages = options?.maxPages ?? 500;
  const all: any[] = [];
  let page = 1;
  let resolvedTotal: number | null = null;

  while (page <= maxPages) {
    const response = await fetchPage(page, perPage);
    const { rows, lastPage: lp } = parseProjectsPagesResponse(response);

    const pageTotal = readMetaTotal(response);
    if (pageTotal != null) resolvedTotal = pageTotal;

    if (rows.length === 0) break;
    all.push(...rows);

    if (resolvedTotal != null && all.length < resolvedTotal) {
      page += 1;
      continue;
    }

    if (hasExplicitLastPage(response)) {
      if (page >= lp) break;
      page += 1;
      continue;
    }

    page += 1;
  }

  return all;
}
