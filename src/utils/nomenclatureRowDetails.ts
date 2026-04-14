import { apiService } from '../services/api';

export type NomenclatureRowDetails = {
  id: number;
  changes: number | null;
  fact: number;
};

export type SpecDetailCacheRow = {
  changes: number | null;
  fact: number;
  factByForeman?: Record<number, number>;
};

function normalizeFactDate(d: string | undefined | null): string {
  return (d || '').slice(0, 10);
}

function getTodayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function collectFactsArray(factsResponse: any): any[] {
  let factsData: any[] = [];
  if (factsResponse?.data?.data && Array.isArray(factsResponse.data.data)) {
    factsData = factsResponse.data.data;
  } else if (factsResponse?.data && Array.isArray(factsResponse.data)) {
    factsData = factsResponse.data;
  } else if (Array.isArray(factsResponse)) {
    factsData = factsResponse;
  } else if (factsResponse?.data?.facts && Array.isArray(factsResponse.data.facts)) {
    factsData = factsResponse.data.facts;
  }
  return factsData;
}

/** Ответ GET /projects/{id}/nomenclature/changes или /facts — вытащить массив записей */
function collectProjectBulkArray(response: any): any[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.data)) return response.data.data;
  return collectFactsArray(response);
}

function nomIdFromChange(row: any): number | null {
  const id =
    row?.nomenclature_id ??
    row?.nomenclature?.id ??
    row?.project_nomenclature?.nomenclature_id ??
    row?.project_nomenclature?.nomenclature?.id;
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function nomIdFromFact(row: any): number | null {
  const id = row?.nomenclature_id ?? row?.nomenclature?.id;
  if (id == null) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function flattenMockChangesByNomenclatureId(
  perId: Record<string, { data?: any[] }>,
  nomIds: number[]
): any[] {
  const out: any[] = [];
  for (const id of nomIds) {
    const rows = perId[String(id)]?.data;
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      out.push({ ...r, nomenclature_id: id });
    }
  }
  return out;
}

function flattenMockFactsByNomenclatureId(perId: Record<string, any>, nomIds: number[]): any[] {
  const out: any[] = [];
  for (const id of nomIds) {
    const block = perId[String(id)];
    let facts: any[] = [];
    if (block?.data && Array.isArray(block.data)) {
      facts = block.data;
    } else if (Array.isArray(block)) {
      facts = block;
    }
    for (const r of facts) {
      out.push({ ...r, nomenclature_id: id });
    }
  }
  return out;
}

/**
 * Собирает кэш строк спецификации из массивов «все изменения» и «все факты» проекта (новые bulk API).
 */
export function buildSpecificationDetailCacheFromBulk(
  changesRows: any[],
  factsRows: any[],
  nomIds: number[],
  pivotFallbackById: Record<number, number>,
  includeFactByForeman: boolean
): Record<number, SpecDetailCacheRow> {
  const latestChange = new Map<number, number | null>();
  const byNom = new Map<number, any[]>();
  for (const row of changesRows) {
    const nid = nomIdFromChange(row);
    if (nid == null) continue;
    if (!byNom.has(nid)) byNom.set(nid, []);
    byNom.get(nid)!.push(row);
  }
  for (const [nid, list] of byNom) {
    list.sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return ta - tb;
    });
    const last = list[list.length - 1];
    const v = Number(last?.amount_change);
    latestChange.set(nid, Number.isFinite(v) ? v : null);
  }

  const factTotal = new Map<number, number>();
  const factByForemanToday = new Map<number, Record<number, number>>();
  const today = getTodayLocal();

  for (const f of factsRows) {
    if (f?.is_deleted) continue;
    const nid = nomIdFromFact(f);
    if (nid == null) continue;
    const amt = Number(f.amount) || 0;
    factTotal.set(nid, (factTotal.get(nid) || 0) + amt);
    if (includeFactByForeman && normalizeFactDate(f.fact_date) === today) {
      const uid = f.project_manager_id ?? f.user_id ?? f.user?.id;
      if (uid != null) {
        const key = Number(uid);
        if (!factByForemanToday.has(nid)) factByForemanToday.set(nid, {});
        const rec = factByForemanToday.get(nid)!;
        rec[key] = (rec[key] || 0) + amt;
      }
    }
  }

  const cache: Record<number, SpecDetailCacheRow> = {};
  for (const id of nomIds) {
    const changes = latestChange.has(id) ? latestChange.get(id)! : null;
    const sum = factTotal.has(id) ? factTotal.get(id)! : undefined;
    const pivot = pivotFallbackById[id] ?? 0;
    const factVal = sum !== undefined ? sum : pivot;
    const row: SpecDetailCacheRow = {
      changes,
      fact: Number.isFinite(factVal) ? factVal : 0,
    };
    if (includeFactByForeman) {
      const fm = factByForemanToday.get(id);
      if (fm && Object.keys(fm).length > 0) {
        row.factByForeman = fm;
      }
    }
    cache[id] = row;
  }
  return cache;
}

export type FetchProjectSpecificationDetailCacheOptions = {
  includeFactByForeman?: boolean;
  /** Полный ответ мока bulk (как у API) */
  mockChangesResponse?: any;
  mockFactsResponse?: any;
  /** Старый формат мока: по id номенклатуры */
  mockChangesByNomenclatureId?: Record<string, { data?: any[] }>;
  mockFactsByNomenclatureId?: Record<string, any>;
};

/**
 * Два запроса: все изменения + все факты по проекту; сборка кэша для строк спецификации.
 */
export async function fetchProjectSpecificationDetailCache(
  projectId: number,
  nomIds: number[],
  pivotFallbackById: Record<number, number>,
  options?: FetchProjectSpecificationDetailCacheOptions
): Promise<Record<number, SpecDetailCacheRow>> {
  let chRes: any;
  let fRes: any;

  if (options?.mockChangesResponse !== undefined) {
    chRes = options.mockChangesResponse;
  } else if (options?.mockChangesByNomenclatureId) {
    chRes = { data: flattenMockChangesByNomenclatureId(options.mockChangesByNomenclatureId, nomIds) };
  } else {
    chRes = await apiService.getProjectNomenclatureChangesAll(projectId);
  }

  if (options?.mockFactsResponse !== undefined) {
    fRes = options.mockFactsResponse;
  } else if (options?.mockFactsByNomenclatureId) {
    fRes = { data: flattenMockFactsByNomenclatureId(options.mockFactsByNomenclatureId, nomIds) };
  } else {
    fRes = await apiService.getProjectNomenclatureFactsAll(projectId);
  }

  const chArr = collectProjectBulkArray(chRes);
  const fArr = collectProjectBulkArray(fRes);
  return buildSpecificationDetailCacheFromBulk(
    chArr,
    fArr,
    nomIds,
    pivotFallbackById,
    options?.includeFactByForeman === true
  );
}

/**
 * Одна строка: per-id API (редкие сценарии / обратная совместимость).
 */
export async function fetchNomenclatureRowDetails(
  projectId: number,
  nomenclatureId: number,
  pivotFallbackFact: number
): Promise<NomenclatureRowDetails> {
  let lastChange: number | null = null;
  let factValue = pivotFallbackFact;

  try {
    const changesResponse = await apiService.getNomenclatureChanges(projectId, nomenclatureId);
    if (changesResponse?.data && Array.isArray(changesResponse.data) && changesResponse.data.length > 0) {
      const latestChange = changesResponse.data[changesResponse.data.length - 1];
      lastChange = latestChange.amount_change;
    }
  } catch {
    // без изменений
  }

  try {
    const factsResponse = await apiService.getNomenclatureFacts(projectId, nomenclatureId, {
      per_page: 500,
    });
    const factsData = collectFactsArray(factsResponse);
    factValue = factsData
      .filter((fact: any) => !fact.is_deleted)
      .reduce((sum: number, fact: any) => sum + (Number(fact.amount) || 0), 0);
  } catch {
    factValue = pivotFallbackFact;
  }

  return {
    id: nomenclatureId,
    changes: lastChange,
    fact: Number.isFinite(factValue) ? factValue : 0,
  };
}

export type NomenclatureRowDetailsWithForeman = NomenclatureRowDetails & {
  factByForeman?: Record<number, number>;
};

export type FetchNomenclatureRowDetailsWithForemanOptions = {
  mockChanges?: { data: any[] };
  mockFacts?: any;
};

/** Per-id (моки с ответом без nomenclature_id в каждой строке). */
export async function fetchNomenclatureRowDetailsWithForeman(
  projectId: number,
  nomenclatureId: number,
  pivotFallbackFact: number,
  options?: FetchNomenclatureRowDetailsWithForemanOptions
): Promise<NomenclatureRowDetailsWithForeman> {
  let lastChange: number | null = null;
  let factValue = pivotFallbackFact;
  let factByForeman: Record<number, number> = {};

  try {
    let changesResponse: any;
    if (options?.mockChanges) {
      changesResponse = options.mockChanges;
    } else {
      changesResponse = await apiService.getNomenclatureChanges(projectId, nomenclatureId);
    }
    const changesData = Array.isArray(changesResponse?.data)
      ? changesResponse.data
      : Array.isArray(changesResponse)
        ? changesResponse
        : [];
    if (changesData.length > 0) {
      const latestChange = changesData[changesData.length - 1];
      const numericChange = Number(latestChange?.amount_change);
      if (Number.isFinite(numericChange)) {
        lastChange = numericChange;
      }
    }
  } catch {
    // без изменений
  }

  try {
    let factsResponse: any;
    if (options?.mockFacts !== undefined) {
      factsResponse = options.mockFacts;
    } else {
      factsResponse = await apiService.getNomenclatureFacts(projectId, nomenclatureId, {
        per_page: 500,
      });
    }
    const factsData = collectFactsArray(factsResponse);
    const today = getTodayLocal();
    const activeFacts = factsData.filter((fact: any) => !fact.is_deleted);

    factValue = activeFacts.reduce((sum: number, fact: any) => sum + (Number(fact.amount) || 0), 0);

    activeFacts
      .filter((fact: any) => normalizeFactDate(fact.fact_date) === today)
      .forEach((fact: any) => {
        const uid = fact.project_manager_id ?? fact.user_id ?? fact.user?.id;
        if (uid != null) {
          const key = Number(uid);
          factByForeman[key] = (factByForeman[key] || 0) + (Number(fact.amount) || 0);
        }
      });
  } catch {
    factValue = pivotFallbackFact;
  }

  return {
    id: nomenclatureId,
    changes: lastChange,
    fact: Number.isFinite(factValue) ? factValue : 0,
    factByForeman: Object.keys(factByForeman).length > 0 ? factByForeman : undefined,
  };
}
