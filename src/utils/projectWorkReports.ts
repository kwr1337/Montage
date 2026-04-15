import { apiService } from '../services/api';

/** Извлекает массив отчётов из ответа API проекта */
export function extractWorkReportsArray(resp: any): any[] {
  const data = resp?.data?.data ?? resp?.data ?? resp;
  return Array.isArray(data) ? data : [];
}

function getLastPageFromResponse(resp: any): number {
  const n = Number(
    resp?.data?.last_page ?? resp?.data?.meta?.last_page ?? resp?.data?.pagination?.last_page ?? 1
  );
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function dedupeReportsById(reports: any[]): any[] {
  const seen = new Set<number>();
  const out: any[] = [];
  for (const r of reports) {
    const id = Number(r?.id);
    if (!Number.isFinite(id) || id <= 0) {
      out.push(r);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

/** Один проход по GET /projects/:id/work-reports (если бэкенд его отдаёт). */
async function fetchBulkProjectWorkReportsPages(
  projectId: number,
  options?: { maxPages?: number; perPage?: number }
): Promise<any[]> {
  const maxPages = options?.maxPages ?? 50;
  const perPage = options?.perPage ?? 1000;
  const all: any[] = [];
  let page = 1;
  let lastPage = 1;
  let safety = 0;

  while (page <= lastPage && safety < maxPages) {
    safety += 1;
    const resp = await apiService.getProjectWorkReports(projectId, { page, per_page: perPage });
    const arr = extractWorkReportsArray(resp);
    lastPage = getLastPageFromResponse(resp);
    all.push(...arr);
    if (arr.length < perPage) break;
    page += 1;
  }

  return all;
}

/** Документированный в API способ — GET /projects/:id/user/:userId/work-reports */
async function fetchAllReportsForUser(
  projectId: number,
  userId: number,
  options?: { maxPages?: number; perPage?: number }
): Promise<any[]> {
  const maxPages = options?.maxPages ?? 50;
  const perPage = options?.perPage ?? 1000;
  const all: any[] = [];
  let page = 1;
  let lastPage = 1;
  let safety = 0;

  while (page <= lastPage && safety < maxPages) {
    safety += 1;
    const resp = await apiService.getWorkReports(projectId, userId, { page, per_page: perPage });
    const arr = extractWorkReportsArray(resp);
    lastPage = getLastPageFromResponse(resp);
    all.push(...arr);
    if (arr.length < perPage) break;
    page += 1;
  }

  return all;
}

export type FetchAllProjectWorkReportsOptions = {
  maxPages?: number;
  perPage?: number;
  /** ID сотрудников проекта: если массовый endpoint недоступен или пустой, подгружаем отчёты по каждому (как в README API). */
  employeeIds?: number[];
};

/**
 * Все work-reports проекта.
 * Сначала пробуем GET /projects/:id/work-reports; если ответ пустой или запрос падает —
 * при переданном `employeeIds` собираем отчёты через документированный per-user API.
 */
export async function fetchAllProjectWorkReports(
  projectId: number,
  options?: FetchAllProjectWorkReportsOptions
): Promise<any[]> {
  const maxPages = options?.maxPages ?? 50;
  const perPage = options?.perPage ?? 1000;
  const employeeIds = [
    ...new Set((options?.employeeIds ?? []).filter((id) => Number.isFinite(id) && id > 0)),
  ].sort((a, b) => a - b);

  let bulk: any[] = [];
  try {
    bulk = await fetchBulkProjectWorkReportsPages(projectId, { maxPages, perPage });
  } catch (e) {
    console.warn(
      '[work-reports] GET /projects/:id/work-reports недоступен или ошибка; при наличии списка сотрудников используем per-user API',
      e
    );
  }

  if (bulk.length > 0) {
    return dedupeReportsById(bulk);
  }

  if (employeeIds.length === 0) {
    return [];
  }

  const perUserLists = await Promise.all(
    employeeIds.map((uid) =>
      fetchAllReportsForUser(projectId, uid, { maxPages, perPage }).catch((err) => {
        console.warn(`[work-reports] не удалось загрузить отчёты для user ${uid}`, err);
        return [];
      })
    )
  );
  return dedupeReportsById(perUserLists.flat());
}

/** Дедупликация параллельных вызовов с одним projectId и тем же набором employeeIds. */
const inflightByKey = new Map<string, Promise<any[]>>();

export function fetchAllProjectWorkReportsDeduped(
  projectId: number,
  options?: { employeeIds?: number[] }
): Promise<any[]> {
  const idsKey = (options?.employeeIds ?? [])
    .slice()
    .sort((a, b) => a - b)
    .join(',');
  const cacheKey = `${projectId}:${idsKey}`;
  const existing = inflightByKey.get(cacheKey);
  if (existing) return existing;
  const p = fetchAllProjectWorkReports(projectId, { employeeIds: options?.employeeIds }).finally(() => {
    inflightByKey.delete(cacheKey);
  });
  inflightByKey.set(cacheKey, p);
  return p;
}

/** Группировка по user_id с сортировкой дат (новые сверху) — как в экране фиксации */
export function groupWorkReportsByUserId(reports: any[]): Map<number, any[]> {
  const m = new Map<number, any[]>();
  for (const r of reports) {
    const uid = Number(r?.user_id ?? r?.employee_id ?? r?.user?.id);
    if (!Number.isFinite(uid) || uid <= 0) continue;
    let list = m.get(uid);
    if (!list) {
      list = [];
      m.set(uid, list);
    }
    list.push(r);
  }
  for (const list of m.values()) {
    list.sort((a, b) => {
      const dateA = new Date(String(a.report_date || '').slice(0, 10) + 'T00:00:00').getTime();
      const dateB = new Date(String(b.report_date || '').slice(0, 10) + 'T00:00:00').getTime();
      return dateB - dateA;
    });
  }
  return m;
}
