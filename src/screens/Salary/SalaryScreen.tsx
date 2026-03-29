import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { Pagination } from '../../shared/ui/Pagination/Pagination';
import { AddPaymentModal } from '../../shared/ui/AddPaymentModal/AddPaymentModal';
import { apiService } from '../../services/api';
import { canAccessSalary } from '../../services/permissions';
import zpIconGreyRaw from '../../shared/icons/zpIconGrey.svg?raw';
import searchIconRaw from '../../shared/icons/searchIcon.svg?raw';
import upDownTableFilterRaw from '../../shared/icons/upDownTableFilter.svg?raw';
import calendarIconGreyRaw from '../../shared/icons/calendarIconGrey.svg?raw';

const toDataUrl = (raw: string) => `data:image/svg+xml,${encodeURIComponent(raw)}`;
const zpIconGrey = toDataUrl(zpIconGreyRaw);
const searchIcon = toDataUrl(searchIconRaw);
const upDownTableFilter = toDataUrl(upDownTableFilterRaw);
const calendarIconGrey = toDataUrl(calendarIconGreyRaw);
import * as XLSX from 'xlsx';
import './salary.scss';

type Payment = {
  id: number;
  user_id: number;
  project_id?: number;
  user?: {
    id: number;
    first_name: string;
    second_name: string;
    last_name: string;
    position?: string;
    role?: string;
    rate_per_hour?: number;
  };
  first_payment_date?: string | null;
  first_payment_amount?: number | null;
  first_payment_type?: string | null;
  second_payment_date?: string | null;
  second_payment_amount?: number | null;
  second_payment_type?: string | null;
  third_payment_date?: string | null;
  third_payment_amount?: number | null;
  third_payment_type?: string | null;
  notes?: string | null;
  // Вычисляемые поля для отображения
  employeeName?: string;
  employeePosition?: string;
  /** Название проекта для строки выплаты */
  projectName?: string;
  hours?: number;
  rate?: number;
  total?: number;
};

function parsePaymentsListResponse(response: any): {
  rows: Payment[];
  lastPage: number;
  total: number;
} {
  let rows: Payment[] = [];
  let lastPage = 1;
  let total = 0;

  if (!response) {
    return { rows, lastPage, total };
  }

  const r = response;
  if (Array.isArray(r)) {
    return { rows: r as Payment[], lastPage: 1, total: r.length };
  }

  if (Array.isArray(r.data)) {
    rows = r.data;
    lastPage = Number(r.meta?.last_page ?? r.last_page ?? 1) || 1;
    total = Number(r.meta?.total ?? r.total ?? rows.length) || 0;
  } else if (r.data && typeof r.data === 'object') {
    if (Array.isArray(r.data.data)) {
      rows = r.data.data;
      const meta = r.data.meta || r.meta || {};
      lastPage = Number(meta.last_page ?? r.last_page ?? 1) || 1;
      total = Number(meta.total ?? r.total ?? rows.length) || 0;
    } else if (r.data && !Array.isArray(r.data) && Array.isArray((r.data as any).data)) {
      rows = (r.data as any).data;
      const meta = (r.data as any).meta || r.meta || {};
      lastPage = Number(meta.last_page ?? 1) || 1;
      total = Number(meta.total ?? rows.length) || 0;
    }
  }

  return {
    rows,
    lastPage: Math.max(1, lastPage || 1),
    total,
  };
}

async function ensureProjectFull(projectId: number, projectCache: Map<number, any>): Promise<any | null> {
  if (projectCache.has(projectId)) return projectCache.get(projectId)!;
  const res = await apiService.getProjectById(projectId);
  const project = res?.data ?? res;
  if (project?.id) projectCache.set(projectId, project);
  return project ?? null;
}

function parseProjectsListResponse(response: any): { rows: any[]; lastPage: number } {
  let rows: any[] = [];
  let lastPage = 1;
  if (!response) return { rows, lastPage };
  const r = response;
  if (Array.isArray(r)) return { rows: r, lastPage: 1 };
  if (Array.isArray(r.data)) {
    rows = r.data;
    lastPage = Number(r.meta?.last_page ?? 1) || 1;
  } else if (r.data && typeof r.data === 'object' && Array.isArray(r.data.data)) {
    rows = r.data.data;
    const meta = r.data.meta || r.meta || {};
    lastPage = Number(meta.last_page ?? 1) || 1;
  }
  return { rows, lastPage: Math.max(1, lastPage) };
}

/** Все проекты без employees — лёгкий список для фильтра выплат; полные карточки подгружаются по мере необходимости */
async function fetchAllProjectsLight(): Promise<Array<{ id: number; name: string }>> {
  const out: Array<{ id: number; name: string }> = [];
  let page = 1;
  let lastPage = 1;
  const perPage = 100;
  do {
    const res = await apiService.getProjects(page, perPage, {});
    const { rows, lastPage: lp } = parseProjectsListResponse(res);
    lastPage = lp;
    for (const p of rows) {
      if (p?.id) out.push({ id: p.id, name: p.name || `Проект №${p.id}` });
    }
    page++;
    if (rows.length === 0) break;
  } while (page <= lastPage);
  return out;
}

async function buildFormattedPayments(
  paymentsData: Payment[],
  allProjectsLight: Array<{ id: number; name: string }>,
  projectFullCache: Map<number, any>,
  usersById: Map<number, any>,
  dateFrom: string,
  dateTo: string
): Promise<Payment[]> {
  const workReportsCache = new Map<string, any[]>();

  const paymentsByEmployeeProjectMonth = new Map<string, Payment>();

  paymentsData.forEach((payment: Payment) => {
    const paymentDate = payment.first_payment_date
      ? new Date(payment.first_payment_date)
      : payment.second_payment_date
        ? new Date(payment.second_payment_date)
        : payment.third_payment_date
          ? new Date(payment.third_payment_date)
          : null;

    if (!paymentDate || Number.isNaN(paymentDate.getTime())) {
      console.warn(`Payment ${payment.id} has no valid date, skipping`);
      return;
    }

    const userId = payment.user_id;
    const projectKey = payment.project_id != null ? String(payment.project_id) : 'none';
    const monthKey = `${userId}-${projectKey}-${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;

    if (paymentsByEmployeeProjectMonth.has(monthKey)) {
      const existingPayment = paymentsByEmployeeProjectMonth.get(monthKey)!;
      const existingDate = existingPayment.first_payment_date
        ? new Date(existingPayment.first_payment_date)
        : existingPayment.second_payment_date
          ? new Date(existingPayment.second_payment_date)
          : existingPayment.third_payment_date
            ? new Date(existingPayment.third_payment_date)
            : null;

      if (existingDate && paymentDate > existingDate) {
        paymentsByEmployeeProjectMonth.set(monthKey, payment);
      }
    } else {
      paymentsByEmployeeProjectMonth.set(monthKey, payment);
    }
  });

  const sumHoursForProject = async (
    projectId: number,
    uid: number,
    monthStart: Date,
    monthEnd: Date,
    monthStartStr: string,
    monthEndStr: string
  ): Promise<number> => {
    const cacheKey = `${projectId}:${uid}:${monthStartStr}:${monthEndStr}`;
    let reports: any[];
    if (workReportsCache.has(cacheKey)) {
      reports = workReportsCache.get(cacheKey)!;
    } else {
      const response = await apiService.getWorkReports(projectId, uid, {
        per_page: 500,
        filter: {
          date_from: monthStartStr,
          date_to: monthEndStr,
        },
      });
      reports = [];
      if (response?.data?.data && Array.isArray(response.data.data)) {
        reports = response.data.data;
      } else if (response?.data && Array.isArray(response.data)) {
        reports = response.data;
      } else if (Array.isArray(response)) {
        reports = response;
      }
      workReportsCache.set(cacheKey, reports);
    }

    const monthReports = reports.filter((report) => {
      if (!report.report_date) return false;
      const reportDate = new Date(report.report_date);
      return reportDate >= monthStart && reportDate <= monthEnd;
    });

    return monthReports.reduce((sum, report) => {
      const hoursWorked = Number(report.hours_worked) || 0;
      const isAbsent = report.absent === true || report.absent === 1 || report.absent === '1';
      return sum + (isAbsent ? 0 : hoursWorked);
    }, 0);
  };

  return Promise.all(
    Array.from(paymentsByEmployeeProjectMonth.values()).map(async (payment) => {
      const userId = payment.user_id;

      const userData: any = payment.user || usersById.get(userId) || null;

      let hours = 0;
      let total = 0;
      let rate = 0;

      let projectMeta: any = null;
      if (payment.project_id != null) {
        projectMeta = projectFullCache.get(payment.project_id);
        if (!projectMeta) {
          projectMeta = await ensureProjectFull(payment.project_id, projectFullCache);
        }
      }
      const projectName =
        payment.project_id != null
          ? projectMeta?.name ||
            allProjectsLight.find((p) => p.id === payment.project_id)?.name ||
            `Проект №${payment.project_id}`
          : 'Все проекты (нет привязки)';

      if (userId) {
        try {
          const now = new Date();
          let monthStart: Date;
          let monthEnd: Date;

          if (dateFrom && dateTo) {
            monthStart = new Date(dateFrom);
            monthEnd = new Date(dateTo);
          } else if (payment.first_payment_date || payment.second_payment_date || payment.third_payment_date) {
            const dates = [
              payment.first_payment_date,
              payment.second_payment_date,
              payment.third_payment_date,
            ].filter(Boolean) as string[];
            const parsed = dates.map((d) => new Date(d));
            const earliest = new Date(Math.min(...parsed.map((d) => d.getTime())));
            const latest = new Date(Math.max(...parsed.map((d) => d.getTime())));
            monthStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
            monthEnd = new Date(latest.getFullYear(), latest.getMonth() + 1, 0, 23, 59, 59);
          } else {
            monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          }

          const monthStartStr = monthStart.toISOString().split('T')[0];
          const monthEndStr = monthEnd.toISOString().split('T')[0];

          if (payment.project_id != null) {
            const pid = payment.project_id;
            const project = projectMeta ?? projectFullCache.get(pid) ?? (await ensureProjectFull(pid, projectFullCache));
            const empInProject = project?.employees?.find((emp: any) => {
              const empId = emp.id || emp.user_id;
              return empId === userId;
            });
            rate =
              Number(
                empInProject?.pivot?.rate_per_hour ??
                  empInProject?.rate_per_hour ??
                  userData?.rate_per_hour ??
                  0
              ) || 0;

            hours = await sumHoursForProject(pid, userId, monthStart, monthEnd, monthStartStr, monthEndStr);
            total = hours * rate;
          } else {
            const projectsToCheck: any[] = [];
            for (const light of allProjectsLight) {
              const proj = await ensureProjectFull(light.id, projectFullCache);
              if (!proj?.employees || !Array.isArray(proj.employees)) continue;
              if (
                proj.employees.some((emp: any) => {
                  const empId = emp.id || emp.user_id;
                  return empId === userId;
                })
              ) {
                projectsToCheck.push(proj);
              }
            }

            rate = userData?.rate_per_hour || 0;

            const allHours = await Promise.all(
              projectsToCheck.map(async (project: any) =>
                sumHoursForProject(project.id, userId, monthStart, monthEnd, monthStartStr, monthEndStr)
              )
            );

            hours = allHours.reduce((sum, h) => sum + h, 0);
            total = hours * rate;
          }
        } catch (error) {
          console.error(`Error loading hours for employee ${userId}:`, error);
        }
      }

      const employeeName = userData ? apiService.formatUserName(userData) : '';
      const employeePosition = userData?.role || '';

      const firstAmount = Number(payment.first_payment_amount) || 0;
      const secondAmount = Number(payment.second_payment_amount) || 0;
      const thirdAmount = Number(payment.third_payment_amount) || 0;
      let effectiveTotal = total > 0 ? total : Number(payment.total) || 0;
      if (effectiveTotal === 0 && (firstAmount > 0 || secondAmount > 0 || thirdAmount > 0)) {
        effectiveTotal = firstAmount + secondAmount + thirdAmount;
      }

      return {
        ...payment,
        user: userData || payment.user,
        employeeName,
        employeePosition,
        projectName,
        rate,
        hours,
        total: effectiveTotal,
      };
    })
  );
}

function applySalaryFilters(
  payments: Payment[],
  searchValue: string,
  dateFrom: string,
  dateTo: string
): Payment[] {
  let filtered = [...payments];

  if (searchValue.trim()) {
    const query = searchValue.toLowerCase();
    filtered = filtered.filter(
      (payment) =>
        (payment.employeeName || '').toLowerCase().includes(query) ||
        (payment.employeePosition || '').toLowerCase().includes(query) ||
        (payment.projectName || '').toLowerCase().includes(query)
    );
  }

  // Дублирующий фильтр по датам: сервер уже отдаёт выборку по date_from/date_to; оставляем как страховку на граничные случаи
  if (dateFrom || dateTo) {
    filtered = filtered.filter((payment) => {
      const dates = [
        payment.first_payment_date,
        payment.second_payment_date,
        payment.third_payment_date,
      ].filter(Boolean) as string[];

      if (dates.length === 0) return false;

      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? new Date(dateTo) : null;

      const anyInRange = dates.some((dateStr) => {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return false;
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (fromDate && dateOnly < new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())) return false;
        if (toDate && dateOnly > new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate())) return false;
        return true;
      });

      return anyInRange;
    });
  }

  return filtered;
}

function sortSalaryPayments(
  payments: Payment[],
  sortField: string | null,
  sortDirection: 'asc' | 'desc'
): Payment[] {
  const sorted = [...payments];
  if (sortField) {
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'employee':
          aValue = (a.employeeName || '').toLowerCase();
          bValue = (b.employeeName || '').toLowerCase();
          break;
        case 'project':
          aValue = (a.projectName || '').toLowerCase();
          bValue = (b.projectName || '').toLowerCase();
          break;
        case 'hours':
          aValue = Number(a.hours) || 0;
          bValue = Number(b.hours) || 0;
          break;
        case 'rate':
          aValue = Number(a.rate) || 0;
          bValue = Number(b.rate) || 0;
          break;
        case 'total':
          aValue = Number(a.total) || 0;
          bValue = Number(b.total) || 0;
          break;
        case 'firstPayment':
          aValue = Number(a.first_payment_amount) || 0;
          bValue = Number(b.first_payment_amount) || 0;
          break;
        case 'secondPayment':
          aValue = Number(a.second_payment_amount) || 0;
          bValue = Number(b.second_payment_amount) || 0;
          break;
        case 'balance': {
          const aTotal = Number(a.total) || 0;
          const aFirst = Number(a.first_payment_amount) || 0;
          const aSecond = Number(a.second_payment_amount) || 0;
          const aThird = Number(a.third_payment_amount) || 0;
          aValue = aThird > 0 ? aThird : Math.max(0, aTotal - aFirst - aSecond);

          const bTotal = Number(b.total) || 0;
          const bFirst = Number(b.first_payment_amount) || 0;
          const bSecond = Number(b.second_payment_amount) || 0;
          const bThird = Number(b.third_payment_amount) || 0;
          bValue = bThird > 0 ? bThird : Math.max(0, bTotal - bFirst - bSecond);
          break;
        }
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue, 'ru') : bValue.localeCompare(aValue, 'ru');
      }
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }
  return sorted;
}

async function fetchAllPaymentsRows(projectIds: number[], dateFrom: string, dateTo: string): Promise<Payment[]> {
  const all: Payment[] = [];
  let page = 1;
  let lastPage = 1;
  const filter: any = { project_id: projectIds };
  if (dateFrom) filter.date_from = dateFrom;
  if (dateTo) filter.date_to = dateTo;

  do {
    const response = await apiService.getPayments({
      page,
      per_page: 200,
      with: ['user'],
      filter,
    });
    const { rows, lastPage: lp } = parsePaymentsListResponse(response);
    lastPage = lp;
    all.push(...rows);
    page++;
    if (rows.length === 0) break;
  } while (page <= lastPage);

  return all;
}

export const SalaryScreen: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const now = new Date();
  const defaultMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  const [dateFrom, setDateFrom] = useState(defaultMonthStart);
  const [dateTo, setDateTo] = useState(defaultMonthEnd);
  // const [paymentStatus, setPaymentStatus] = useState<string>('all');
  // const paymentStatus = 'all'; // Временно отключен фильтр по статусу
  const dateFromRef = React.useRef<HTMLInputElement>(null);
  const dateToRef = React.useRef<HTMLInputElement>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 11;
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);
  const [salaryProjectsLight, setSalaryProjectsLight] = useState<Array<{ id: number; name: string }>>([]);
  const [usersByIdMap, setUsersByIdMap] = useState<Map<number, any>>(new Map());
  const [refDataReady, setRefDataReady] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Лёгкий список проектов (id, name) + пользователи — без тяжёлого with[]=employees на все проекты сразу
  useEffect(() => {
    let cancelled = false;
    const loadRefData = async () => {
      try {
        const [projectsLight, usersRes] = await Promise.all([fetchAllProjectsLight(), apiService.getUsers()]);
        if (cancelled) return;

        setSalaryProjectsLight(projectsLight);
        setProjects(projectsLight.map((p) => ({ id: p.id, name: p.name })));

        const users =
          usersRes && usersRes.data
            ? Array.isArray(usersRes.data)
              ? usersRes.data
              : [usersRes.data]
            : Array.isArray(usersRes)
              ? usersRes
              : [];
        setUsersByIdMap(new Map(users.map((u: any) => [u.id, u])));

        const employeesList = users
          .filter((user: any) => user.is_employee === true && user.is_dismissed !== true)
          .map((user: any) => ({
            id: user.id,
            name: apiService.formatUserName(user),
            fullName: `${user.last_name || ''} ${user.first_name || ''} ${user.second_name || ''}`.trim(),
            user: user,
          }));
        setEmployees(employeesList);
      } catch (error) {
        console.error('Error loading salary reference data:', error);
        setSalaryProjectsLight([]);
        setUsersByIdMap(new Map());
        setEmployees([]);
      } finally {
        if (!cancelled) setRefDataReady(true);
      }
    };
    loadRefData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Загрузка выплат: серверная пагинация (page / per_page). Даты передаются в filter (date_from / date_to) — сервер фильтрует по диапазону.
  const loadPayments = React.useCallback(async () => {
    if (!refDataReady) return;

    const projectIds = salaryProjectsLight.map((p) => p.id);
    if (projectIds.length === 0) {
      setPayments([]);
      setTotalPages(1);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const filter: any = { project_id: projectIds };
      if (dateFrom) filter.date_from = dateFrom;
      if (dateTo) filter.date_to = dateTo;

      const response = await apiService.getPayments({
        page: currentPage,
        per_page: itemsPerPage,
        with: ['user'],
        filter,
      });

      const { rows: paymentsData, lastPage: parsedLastPage } = parsePaymentsListResponse(response);
      const meta = (response as any)?.data?.meta ?? (response as any)?.meta;
      const lastPage =
        meta != null && meta.last_page != null
          ? Math.max(1, Number(meta.last_page) || 1)
          : paymentsData.length === 0
            ? 1
            : Math.max(1, parsedLastPage);

      const projectFullCache = new Map<number, any>();
      const uniqueProjectIds = [
        ...new Set(paymentsData.map((p) => p.project_id).filter((id): id is number => id != null)),
      ];
      await Promise.all(uniqueProjectIds.map((id) => ensureProjectFull(id, projectFullCache)));

      const formattedPayments = await buildFormattedPayments(
        paymentsData,
        salaryProjectsLight,
        projectFullCache,
        usersByIdMap,
        dateFrom,
        dateTo
      );
      setPayments(formattedPayments);
      setTotalPages(Math.max(1, lastPage));
    } catch (error) {
      console.error('Error loading payments:', error);
      setPayments([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [
    refDataReady,
    currentPage,
    dateFrom,
    dateTo,
    salaryProjectsLight,
    usersByIdMap,
    itemsPerPage,
  ]);

  useEffect(() => {
    if (!refDataReady) return;
    loadPayments();
  }, [loadPayments, refDataReady]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue]);

  // Поиск и уточнение по датам — по данным текущей серверной страницы (см. экспорт для полного набора)
  const filteredPayments = useMemo(
    () => applySalaryFilters(payments, searchValue, dateFrom, dateTo),
    [payments, searchValue, dateFrom, dateTo]
  );

  // Обработчик сортировки
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedPayments = useMemo(
    () => sortSalaryPayments(filteredPayments, sortField, sortDirection),
    [filteredPayments, sortField, sortDirection]
  );

  const handleSelectPayment = (paymentId: number) => {
    const newSelected = new Set(selectedPaymentIds);
    if (newSelected.has(paymentId)) {
      newSelected.delete(paymentId);
    } else {
      newSelected.add(paymentId);
    }
    setSelectedPaymentIds(newSelected);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(sortedPayments.map((p) => p.id));
      setSelectedPaymentIds(allIds);
    } else {
      setSelectedPaymentIds(new Set());
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace('₽', '₽');
  };

  const formatDateDDMMYYYY = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Форматирование даты для таблицы выплат: "11 сен 2025"
  const formatDateForPayment = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Экспорт в Excel: подгружаем все страницы с сервера, затем те же фильтры и сортировка
  const handleExportToExcel = async () => {
    const projectIds = salaryProjectsLight.map((p) => p.id);
    if (projectIds.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    let dataToExport: Payment[];
    try {
      const allRows = await fetchAllPaymentsRows(projectIds, dateFrom, dateTo);
      const projectFullCache = new Map<number, any>();
      const formatted = await buildFormattedPayments(
        allRows,
        salaryProjectsLight,
        projectFullCache,
        usersByIdMap,
        dateFrom,
        dateTo
      );
      const filtered = applySalaryFilters(formatted, searchValue, dateFrom, dateTo);
      const sorted = sortSalaryPayments(filtered, sortField, sortDirection);
      dataToExport =
        selectedPaymentIds.size > 0 ? sorted.filter((p) => selectedPaymentIds.has(p.id)) : sorted;
    } catch (e) {
      console.error('Export: failed to load payments', e);
      alert('Не удалось загрузить данные для экспорта');
      return;
    }

    if (dataToExport.length === 0) {
      alert('Нет данных для экспорта');
      return;
    }

    // Определяем месяц и год для названия файла
    // Используем текущий месяц, если нет фильтров по датам
    const now = new Date();
    let month: number;
    let year: number;

    if (dateFrom) {
      const date = new Date(dateFrom);
      month = date.getMonth() + 1;
      year = date.getFullYear();
    } else if (dataToExport.length > 0 && dataToExport[0].first_payment_date) {
      const date = new Date(dataToExport[0].first_payment_date);
      month = date.getMonth() + 1;
      year = date.getFullYear();
    } else {
      month = now.getMonth() + 1;
      year = now.getFullYear();
    }

    // Подготавливаем данные для экспорта
    const exportData = dataToExport.map((payment) => {
      // Вычисляем "Остаток" (третья выплата или разница между "Всего" и суммой первых двух выплат)
      const firstAmount = Number(payment.first_payment_amount) || 0;
      const secondAmount = Number(payment.second_payment_amount) || 0;
      const thirdAmount = Number(payment.third_payment_amount) || 0;
      const total = Number(payment.total) || 0;
      
      // Если есть третья выплата, используем её, иначе вычисляем остаток
      const balance = thirdAmount > 0 
        ? thirdAmount 
        : Math.max(0, total - firstAmount - secondAmount);

      return {
        'Сотрудник': payment.employeeName || '',
        'Проект': payment.projectName || '',
        'Должность': payment.employeePosition || '',
        'Кол-во часов': payment.hours || 0,
        'Ставка, ₽/час': `${formatCurrency(payment.rate || 0)}`,
        'Всего': `${formatCurrency(total)}`,
        '1-я выплата': payment.first_payment_amount ? `${formatCurrency(firstAmount)}` : 'Ожидание...',
        'Дата 1-й выплаты': payment.first_payment_date ? formatDateDDMMYYYY(payment.first_payment_date) : '',
        'Способ 1-й выплаты': payment.first_payment_type || 'Ожидание',
        '2-я выплата': payment.second_payment_amount ? `${formatCurrency(secondAmount)}` : 'Ожидание...',
        'Дата 2-й выплаты': payment.second_payment_date ? formatDateDDMMYYYY(payment.second_payment_date) : '',
        'Способ 2-й выплаты': payment.second_payment_type || 'Ожидание',
        'Остаток': `${formatCurrency(balance)}`,
        'Дата остатка': payment.third_payment_date ? formatDateDDMMYYYY(payment.third_payment_date) : '',
        'Способ остатка': payment.third_payment_type || 'Ожидание',
      };
    });

    // Создаем рабочую книгу
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Выплаты ЗП');

    // Настраиваем ширину колонок
    const columnWidths = [
      { wch: 25 }, // Сотрудник
      { wch: 20 }, // Должность
      { wch: 12 }, // Кол-во часов
      { wch: 15 }, // Ставка
      { wch: 15 }, // Всего
      { wch: 15 }, // 1-я выплата
      { wch: 15 }, // Дата 1-й выплаты
      { wch: 15 }, // Способ 1-й выплаты
      { wch: 15 }, // 2-я выплата
      { wch: 15 }, // Дата 2-й выплаты
      { wch: 15 }, // Способ 2-й выплаты
      { wch: 15 }, // Остаток
      { wch: 15 }, // Дата остатка
      { wch: 15 }, // Способ остатка
    ];
    worksheet['!cols'] = columnWidths;

    // Формируем название файла
    const fileName = `Выплаты_ЗП_${String(month).padStart(2, '0')}_${year}.xlsx`;

    // Сохраняем файл
    XLSX.writeFile(workbook, fileName);
  };


  return (
    <div className="salary">
      <PageHeader
        categoryIcon={zpIconGrey}
        categoryLabel="Выдача ЗП"
        showPagination={true}
        userName="Гильманов Т.Р."
      />

      <div className="salary__content">
        <div className="salary__toolbar">
          <div className="salary__filters">
            <div className="salary__search">
              <img src={searchIcon} alt="Поиск" className="salary__search-icon" />
              <input
                type="text"
                className="salary__search-input"
                placeholder="Поиск"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>

            <div className="salary__date-range">
              <div className="salary__date-range-left">
                <img src={calendarIconGrey} alt="Календарь" />
                <div 
                  className="salary__date-input-wrapper"
                  onClick={() => {
                    if (dateFromRef.current) {
                      dateFromRef.current.showPicker?.();
                      dateFromRef.current.focus();
                    }
                  }}
                >
                  <input
                    ref={dateFromRef}
                    type="date"
                    className="salary__date-input"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setCurrentPage(1); // Сбрасываем страницу при изменении фильтра
                    }}
                  />
                  {dateFrom ? (
                    <span className="salary__date-display">
                      {formatDateDDMMYYYY(dateFrom)}
                    </span>
                  ) : (
                    <span className="salary__date-placeholder">С ...</span>
                  )}
                </div>
              </div>
              <div className="salary__date-range-divider"></div>
              <div className="salary__date-range-right">
                <div 
                  className="salary__date-input-wrapper"
                  onClick={() => {
                    if (dateToRef.current) {
                      dateToRef.current.showPicker?.();
                      dateToRef.current.focus();
                    }
                  }}
                >
                  <input
                    ref={dateToRef}
                    type="date"
                    className="salary__date-input"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setCurrentPage(1); // Сбрасываем страницу при изменении фильтра
                    }}
                  />
                  {dateTo ? (
                    <span className="salary__date-display">
                      {formatDateDDMMYYYY(dateTo)}
                    </span>
                  ) : (
                    <span className="salary__date-placeholder">По ...</span>
                  )}
                </div>
              </div>
            </div>

            {/* <div className="salary__status-filter">
              <select
                className="salary__status-select"
                value="all"
                onChange={(e) => {}}
              >
                <option value="all">Статус выплаты</option>
                <option value="paid">Оплачено</option>
                <option value="pending">Ожидание</option>
              </select>
            </div> */}
          </div>

          <div className="salary__actions">
            <button 
              className="salary__add-btn" 
              onClick={() => {
                if (!canAccessSalary(apiService.getCurrentUser())) {
                  alert('Недостаточно прав');
                  return;
                }
                setEditingPayment(null);
                setIsAddPaymentModalOpen(true);
              }}
            >
              Добавить выплату
            </button>
            <button 
              className="salary__export-btn" 
              onClick={() => {
                if (!canAccessSalary(apiService.getCurrentUser())) {
                  alert('Недостаточно прав');
                  return;
                }
                handleExportToExcel();
              }}
            >
              Экспорт XLSX
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="salary__loading">Загрузка...</div>
        ) : (
          <>
            <div className="salary__table">
              <div className="salary__table-header">
                <div 
                  className="salary__table-header-col salary__table-header-col--employee"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input') || (e.target as HTMLElement).tagName === 'INPUT') {
                      return;
                    }
                    handleSort('employee');
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    className="salary__checkbox"
                    checked={sortedPayments.length > 0 && sortedPayments.every((p) => selectedPaymentIds.has(p.id))}
                    onChange={handleSelectAll}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>Сотрудник</span>
                  <img 
                    src={upDownTableFilter} 
                    alt="↑↓" 
                    className={`salary__sort-icon ${sortField === 'employee' ? 'salary__sort-icon--active' : ''}`}
                  />
                </div>
                <div 
                  className="salary__table-header-col salary__table-header-col--project"
                  onClick={() => handleSort('project')}
                  style={{ cursor: 'pointer' }}
                >
                  <span>Проект</span>
                  <img 
                    src={upDownTableFilter} 
                    alt="↑↓" 
                    className={`salary__sort-icon ${sortField === 'project' ? 'salary__sort-icon--active' : ''}`}
                  />
                </div>
                <div 
                  className="salary__table-header-col salary__table-header-col--hours"
                  onClick={() => handleSort('hours')}
                  style={{ cursor: 'pointer' }}
                >
                  <span>Кол-во часов</span>
                  <img 
                    src={upDownTableFilter} 
                    alt="↑↓" 
                    className={`salary__sort-icon ${sortField === 'hours' ? 'salary__sort-icon--active' : ''}`}
                  />
                </div>
                <div 
                  className="salary__table-header-col salary__table-header-col--rate"
                  onClick={() => handleSort('rate')}
                  style={{ cursor: 'pointer' }}
                >
                  <span>Ставка, ₽/час</span>
                  <img 
                    src={upDownTableFilter} 
                    alt="↑↓" 
                    className={`salary__sort-icon ${sortField === 'rate' ? 'salary__sort-icon--active' : ''}`}
                  />
                </div>
                <div 
                  className="salary__table-header-col salary__table-header-col--total"
                  onClick={() => handleSort('total')}
                  style={{ cursor: 'pointer' }}
                >
                  <span>Всего</span>
                  <img 
                    src={upDownTableFilter} 
                    alt="↑↓" 
                    className={`salary__sort-icon ${sortField === 'total' ? 'salary__sort-icon--active' : ''}`}
                  />
                </div>
                <div 
                  className="salary__table-header-col salary__table-header-col--payment"
                  onClick={() => handleSort('firstPayment')}
                  style={{ cursor: 'pointer' }}
                >
                  <span>1-я выплата</span>
                  <img 
                    src={upDownTableFilter} 
                    alt="↑↓" 
                    className={`salary__sort-icon ${sortField === 'firstPayment' ? 'salary__sort-icon--active' : ''}`}
                  />
                </div>
                <div className="salary__table-header-col salary__table-header-col--method">
                  <span>Способ</span>
                  <img src={upDownTableFilter} alt="↑↓" className="salary__sort-icon" />
                </div>
                <div 
                  className="salary__table-header-col salary__table-header-col--payment"
                  onClick={() => handleSort('secondPayment')}
                  style={{ cursor: 'pointer' }}
                >
                  <span>2-я выплата</span>
                  <img 
                    src={upDownTableFilter} 
                    alt="↑↓" 
                    className={`salary__sort-icon ${sortField === 'secondPayment' ? 'salary__sort-icon--active' : ''}`}
                  />
                </div>
                <div className="salary__table-header-col salary__table-header-col--method">
                  <span>Способ</span>
                  <img src={upDownTableFilter} alt="↑↓" className="salary__sort-icon" />
                </div>
                <div 
                  className="salary__table-header-col salary__table-header-col--payment"
                  onClick={() => handleSort('balance')}
                  style={{ cursor: 'pointer' }}
                >
                  <span>Остаток</span>
                  <img 
                    src={upDownTableFilter} 
                    alt="↑↓" 
                    className={`salary__sort-icon ${sortField === 'balance' ? 'salary__sort-icon--active' : ''}`}
                  />
                </div>
                <div className="salary__table-header-col salary__table-header-col--method">
                  <span>Способ</span>
                  <img src={upDownTableFilter} alt="↑↓" className="salary__sort-icon" />
                </div>
              </div>

              {sortedPayments.length === 0 ? (
                <div className="salary__empty">Нет данных для отображения</div>
              ) : (
                sortedPayments.map((payment) => (
                  <div 
                    key={payment.id} 
                    className="salary__table-row"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('.salary__checkbox') || 
                          (e.target as HTMLElement).tagName === 'INPUT') {
                        return;
                      }
                      if (!canAccessSalary(apiService.getCurrentUser())) {
                        alert('Недостаточно прав');
                        return;
                      }
                      setEditingPayment(payment);
                      setIsAddPaymentModalOpen(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="salary__table-row-col salary__table-row-col--employee">
                      <input
                        type="checkbox"
                        className="salary__checkbox"
                        checked={selectedPaymentIds.has(payment.id)}
                        onChange={() => handleSelectPayment(payment.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {/* <img src={sotrudnikiVProekte} alt="Сотрудник" className="salary__employee-icon" /> */}
                      <div className="salary__employee-info">
                        <div className="salary__employee-position">{payment.employeePosition}</div>
                        <div className="salary__employee-name">{payment.employeeName}</div>
                      </div>
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--project" title={payment.projectName || ''}>
                      <span className="salary__project-name">{payment.projectName || '—'}</span>
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--hours">
                      {payment.hours}
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--rate">
                      {formatCurrency(payment.rate || 0)}
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--total">
                      {formatCurrency(payment.total || 0)}
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--payment">
                      {payment.first_payment_amount ? (
                        <>
                          <div className="salary__payment-amount">{formatCurrency(payment.first_payment_amount)}</div>
                          <div className="salary__payment-date">
                            {payment.first_payment_date ? formatDateForPayment(payment.first_payment_date) : ''}
                          </div>
                        </>
                      ) : (
                        <div className="salary__payment-pending">Ожидание...</div>
                      )}
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--method">
                      {payment.first_payment_type || 'Ожидание'}
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--payment">
                      {payment.second_payment_amount ? (
                        <>
                          <div className="salary__payment-amount">{formatCurrency(payment.second_payment_amount)}</div>
                          <div className="salary__payment-date">
                            {payment.second_payment_date ? formatDateForPayment(payment.second_payment_date) : ''}
                          </div>
                        </>
                      ) : (
                        <div className="salary__payment-pending">Ожидание...</div>
                      )}
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--method">
                      {payment.second_payment_type || 'Ожидание'}
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--payment">
                      {(() => {
                        // Рассчитываем остаток автоматически
                        const total = payment.total || 0;
                        const firstAmount = payment.first_payment_amount || 0;
                        const secondAmount = payment.second_payment_amount || 0;
                        const balance = Math.max(0, total - firstAmount - secondAmount);
                        
                        // Если есть третья выплата, показываем её, иначе показываем рассчитанный остаток
                        const displayAmount = payment.third_payment_amount || balance;
                        const displayDate = payment.third_payment_date;
                        
                        if (displayAmount > 0) {
                          return (
                            <>
                              <div className="salary__payment-amount">{formatCurrency(displayAmount)}</div>
                              {displayDate && (
                                <div className="salary__payment-date">
                                  {formatDateForPayment(displayDate)}
                                </div>
                              )}
                            </>
                          );
                        } else {
                          return <div className="salary__payment-pending">Ожидание...</div>;
                        }
                      })()}
                    </div>
                    <div className="salary__table-row-col salary__table-row-col--method">
                      {payment.third_payment_type || 'Ожидание...'}
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="salary__pagination">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      <AddPaymentModal
        isOpen={isAddPaymentModalOpen}
        onClose={() => {
          setIsAddPaymentModalOpen(false);
          setEditingPayment(null);
        }}
        periodDateFrom={dateFrom}
        periodDateTo={dateTo}
        onSave={async (data) => {
          try {
            const parsePay = (s?: string | number) => {
              if (s == null || s === '') return 0;
              return parseFloat(String(s).replace(/\s/g, '').replace(/₽/g, '')) || 0;
            };
            const sumSaved =
              parsePay(data.firstPayment?.amount) +
              parsePay(data.secondPayment?.amount) +
              parsePay(data.thirdPayment?.amount);
            const maxAllowed =
              editingPayment != null
                ? Number(editingPayment.total) ||
                  (editingPayment.hours != null && editingPayment.rate != null
                    ? editingPayment.hours * editingPayment.rate
                    : 0)
                : null;
            if (maxAllowed != null && maxAllowed > 0.01 && sumSaved - maxAllowed > 0.01) {
              alert('Сумма выплат не может превышать начислено.');
              return;
            }

            if (editingPayment) {
              await apiService.updatePayment(editingPayment.id, {
                user_id: data.employeeId,
                project_id: data.projectId,
                first_payment_date: data.firstPayment?.date || null,
                first_payment_amount: data.firstPayment?.amount ? parseFloat(data.firstPayment.amount.replace(/\s/g, '').replace(/₽/g, '')) : null,
                first_payment_type: data.firstPayment?.method || null,
                second_payment_date: data.secondPayment?.date || null,
                second_payment_amount: data.secondPayment?.amount ? parseFloat(data.secondPayment.amount.replace(/\s/g, '').replace(/₽/g, '')) : null,
                second_payment_type: data.secondPayment?.method || null,
                third_payment_date: data.thirdPayment?.date || null,
                third_payment_amount: data.thirdPayment?.amount ? parseFloat(data.thirdPayment.amount.replace(/\s/g, '').replace(/₽/g, '')) : null,
                third_payment_type: data.thirdPayment?.method || null,
                notes: data.comment || null,
              });
            } else {
              await apiService.createPayment({
                user_id: data.employeeId,
                project_id: data.projectId,
                first_payment_date: data.firstPayment?.date || null,
                first_payment_amount: data.firstPayment?.amount ? parseFloat(data.firstPayment.amount.replace(/\s/g, '').replace(/₽/g, '')) : null,
                first_payment_type: data.firstPayment?.method || null,
                second_payment_date: data.secondPayment?.date || null,
                second_payment_amount: data.secondPayment?.amount ? parseFloat(data.secondPayment.amount.replace(/\s/g, '').replace(/₽/g, '')) : null,
                second_payment_type: data.secondPayment?.method || null,
                third_payment_date: data.thirdPayment?.date || null,
                third_payment_amount: data.thirdPayment?.amount ? parseFloat(data.thirdPayment.amount.replace(/\s/g, '').replace(/₽/g, '')) : null,
                third_payment_type: data.thirdPayment?.method || null,
                notes: data.comment || null,
              });
            }
            
            // Закрываем модальное окно
            setIsAddPaymentModalOpen(false);
            setEditingPayment(null);
            
            // Перезагружаем данные таблицы
            await loadPayments();
          } catch (error) {
            console.error('Error saving payment:', error);
            alert('Ошибка при сохранении выплаты');
          }
        }}
        projects={projects}
        employees={employees}
        editData={editingPayment ? {
          id: editingPayment.id,
          employeeId: editingPayment.user_id,
          projectId: editingPayment.project_id,
          employeeName: editingPayment.employeeName || '',
          employeePosition: editingPayment.employeePosition || '',
          total: editingPayment.total ?? 0,
          hours: editingPayment.hours,
          rate: editingPayment.rate,
          firstPayment: editingPayment.first_payment_amount ? {
            amount: editingPayment.first_payment_amount,
            date: editingPayment.first_payment_date || '',
            method: editingPayment.first_payment_type || '',
          } : undefined,
          secondPayment: editingPayment.second_payment_amount ? {
            amount: editingPayment.second_payment_amount,
            date: editingPayment.second_payment_date || '',
            method: editingPayment.second_payment_type || '',
          } : undefined,
          thirdPayment: editingPayment.third_payment_amount ? {
            amount: editingPayment.third_payment_amount,
            date: editingPayment.third_payment_date || '',
            method: editingPayment.third_payment_type || '',
          } : undefined,
          comment: editingPayment.notes || '',
        } : null}
      />
    </div>
  );
};
