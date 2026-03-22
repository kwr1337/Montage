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
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Загрузка сотрудников
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const response = await apiService.getUsers();
        const users = response && response.data 
          ? (Array.isArray(response.data) ? response.data : [response.data])
          : (Array.isArray(response) ? response : []);
        
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
        console.error('Error loading employees:', error);
        setEmployees([]);
      }
    };

    loadEmployees();
  }, []);

  // Загрузка проектов для выбора при добавлении выплаты
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await apiService.getProjects(1, 1000);
        const list = res?.data?.data || res?.data || res;
        const arr = Array.isArray(list) ? list : [list];
        setProjects(arr.filter((p: any) => p?.id).map((p: any) => ({ id: p.id, name: p.name || `Проект №${p.id}` })));
      } catch (e) {
        console.error('Error loading projects:', e);
      }
    };
    loadProjects();
  }, []);

  // Функция загрузки данных о выплатах
  const loadPayments = React.useCallback(async () => {
    setIsLoading(true);
    try {
      let allProjectsList: any[] = [];
      let projectIds: number[] = [];
      try {
        const projectsRes = await apiService.getProjects(1, 1000, { with: ['employees'] });
        const projectsList = projectsRes?.data?.data || projectsRes?.data || projectsRes;
        allProjectsList = Array.isArray(projectsList) ? projectsList : [projectsList];
        allProjectsList = allProjectsList.filter((p: any) => p?.id);
        projectIds = allProjectsList.map((p: any) => p.id);
      } catch (e) {
        console.error('Error loading projects for payments:', e);
      }

      let allUsersList: any[] = [];
      try {
        const usersResponse = await apiService.getUsers();
        const users = usersResponse && usersResponse.data
          ? (Array.isArray(usersResponse.data) ? usersResponse.data : [usersResponse.data])
          : (Array.isArray(usersResponse) ? usersResponse : []);
        allUsersList = users;
      } catch (e) {
        console.error('Error loading users for payments:', e);
      }
      const usersById = new Map(allUsersList.map((u: any) => [u.id, u]));

      const workReportsCache = new Map<string, any[]>();

      // Не передаём date_from/date_to в API — бэкенд может исключать платежи с выплатами в разных месяцах.
      // Фильтрация по датам выполняется локально в filteredPayments.
      const filter: any = { project_id: projectIds };

      const response = projectIds.length > 0
        ? await apiService.getPayments({
            page: currentPage,
            per_page: 500,
            with: ['user'],
            filter,
          })
        : { data: { data: [] } };


      let paymentsData: Payment[] = [];
      if (response) {
        // Проверяем разные варианты структуры ответа
        if (response.data) {
          if (response.data.data && Array.isArray(response.data.data)) {
            paymentsData = response.data.data;
          } else if (Array.isArray(response.data)) {
            paymentsData = response.data;
          } else if (response.data && typeof response.data === 'object') {
            paymentsData = [response.data];
          }
        } else if (Array.isArray(response)) {
          paymentsData = response;
        }
      }


        // Группируем выплаты по сотруднику + проекту + месяцу (одна строка = один проект)
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
              per_page: 1000,
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

        const formattedPayments = await Promise.all(
          Array.from(paymentsByEmployeeProjectMonth.values()).map(async (payment) => {
            const userId = payment.user_id;

            const userData: any = payment.user || usersById.get(userId) || null;

            let hours = 0;
            let total = 0;
            let rate = 0;

            const projectMeta = payment.project_id != null
              ? allProjectsList.find((p: any) => p.id === payment.project_id)
              : null;
            const projectName =
              payment.project_id != null
                ? (projectMeta?.name || `Проект №${payment.project_id}`)
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
                  const project = projectMeta ?? allProjectsList.find((p: any) => p.id === pid);
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
                  let projectsToCheck = allProjectsList.filter((project: any) => {
                    if (!project.employees || !Array.isArray(project.employees)) return false;
                    return project.employees.some((emp: any) => {
                      const empId = emp.id || emp.user_id;
                      return empId === userId;
                    });
                  });

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

      setPayments(formattedPayments);
      
      // Обновляем totalPages из ответа API
      if (response && response.data && response.data.last_page) {
        setTotalPages(response.data.last_page);
      } else {
        setTotalPages(Math.ceil(formattedPayments.length / itemsPerPage));
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, dateFrom, dateTo]);

  // Загрузка данных о выплатах при изменении фильтров
  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Фильтрация и поиск
  const filteredPayments = useMemo(() => {
    let filtered = [...payments];

    // Поиск
    if (searchValue.trim()) {
      const query = searchValue.toLowerCase();
      filtered = filtered.filter(
        (payment) =>
          (payment.employeeName || '').toLowerCase().includes(query) ||
          (payment.employeePosition || '').toLowerCase().includes(query) ||
          (payment.projectName || '').toLowerCase().includes(query)
      );
    }

    // Фильтр по статусу выплаты
    // if (paymentStatus !== 'all') {
    //   filtered = filtered.filter((payment) => {
    //     const total = payment.total || 0;
    //     const firstAmount = payment.first_payment_amount || 0;
    //     const secondAmount = payment.second_payment_amount || 0;
    //     const balance = Math.max(0, total - firstAmount - secondAmount);
    //     
    //     // Проверяем, есть ли "ожидание по выплате" (не заполненные поля)
    //     const hasFirstPending = !payment.first_payment_amount;
    //     const hasSecondPending = !payment.second_payment_amount;
    //     const hasThirdPending = !payment.third_payment_amount && balance > 0;
    //     const hasAnyPending = hasFirstPending || hasSecondPending || hasThirdPending;
    //     
    //     if (paymentStatus === 'paid') {
    //       // "Оплачено" - нигде нет ожидания по выплате
    //       return !hasAnyPending;
    //     }
    //     if (paymentStatus === 'pending') {
    //       // "Ожидание" - хотя бы в одном месте есть ожидание по выплате
    //       return hasAnyPending;
    //     }
    //     return true;
    //   });
    // }

    // Фильтр по дате: включаем платёж, если хотя бы одна дата выплаты попадает в диапазон
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
  }, [payments, searchValue, dateFrom, dateTo]);

  // Обработчик сортировки
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Сортировка выплат
  const sortedPayments = useMemo(() => {
    const sorted = [...filteredPayments];
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
          case 'balance':
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
          default:
            return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue, 'ru')
            : bValue.localeCompare(aValue, 'ru');
        } else {
          return sortDirection === 'asc' 
            ? aValue - bValue
            : bValue - aValue;
        }
      });
    }
    return sorted;
  }, [filteredPayments, sortField, sortDirection]);

  // Пагинация
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedPayments, currentPage, itemsPerPage]);

  // Обновление totalPages при изменении sortedPayments
  useEffect(() => {
    setTotalPages(Math.ceil(sortedPayments.length / itemsPerPage));
    if (currentPage > Math.ceil(sortedPayments.length / itemsPerPage) && sortedPayments.length > 0) {
      setCurrentPage(1);
    }
  }, [sortedPayments.length, itemsPerPage]);

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
      const allIds = new Set(paginatedPayments.map((p) => p.id));
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

  // Экспорт в Excel
  const handleExportToExcel = () => {
    // Определяем, какие данные экспортировать: выбранные или все
    const dataToExport = selectedPaymentIds.size > 0
      ? sortedPayments.filter((p) => selectedPaymentIds.has(p.id))
      : sortedPayments;

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
                    checked={paginatedPayments.length > 0 && paginatedPayments.every((p) => selectedPaymentIds.has(p.id))}
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

              {paginatedPayments.length === 0 ? (
                <div className="salary__empty">Нет данных для отображения</div>
              ) : (
                paginatedPayments.map((payment) => (
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
