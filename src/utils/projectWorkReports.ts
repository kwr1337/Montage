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

/**
 * Все страницы work-reports проекта одним «водопадом» (не N запросов по сотрудникам).
 */
export async function fetchAllProjectWorkReports(
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

/** Дедупликация параллельных вызовов с одним projectId (два useEffect не дернут два полных обхода). */
const inflightByProject = new Map<number, Promise<any[]>>();

export function fetchAllProjectWorkReportsDeduped(projectId: number): Promise<any[]> {
  const existing = inflightByProject.get(projectId);
  if (existing) return existing;
  const p = fetchAllProjectWorkReports(projectId).finally(() => {
    inflightByProject.delete(projectId);
  });
  inflightByProject.set(projectId, p);
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
