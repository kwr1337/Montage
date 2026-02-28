import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { Pagination } from '../../shared/ui/Pagination/Pagination';
import { AddPaymentModal } from '../../shared/ui/AddPaymentModal/AddPaymentModal';
import { apiService } from '../../services/api';
import { canAccessSalary } from '../../services/permissions';
import zpIconGrey from '../../shared/icons/zpIconGrey.svg';
import searchIcon from '../../shared/icons/searchIcon.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import calendarIconGrey from '../../shared/icons/calendarIconGrey.svg';
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
  hours?: number;
  rate?: number;
  total?: number;
};

export const SalaryScreen: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
      // API требует project_id — загружаем проекты и получаем выплаты по каждому
      let projectIds: number[] = [];
      try {
        const projectsRes = await apiService.getProjects(1, 1000);
        const projectsList = projectsRes?.data?.data || projectsRes?.data || projectsRes;
        const arr = Array.isArray(projectsList) ? projectsList : [projectsList];
        projectIds = arr.filter((p: any) => p?.id).map((p: any) => p.id);
      } catch (e) {
        console.error('Error loading projects for payments:', e);
      }

      const filter: any = { project_id: projectIds };
      if (dateFrom) filter.date_from = dateFrom;
      if (dateTo) filter.date_to = dateTo;

      const response = projectIds.length > 0
        ? await apiService.getPayments({
            page: currentPage,
            per_page: 500,
            with: ['user'],
            filter,
          })
        : { data: { data: [] } };

      console.log('Payments API response:', response);

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

      console.log('Parsed payments data:', paymentsData);

        // Группируем выплаты по сотрудникам И месяцам
        // Каждая выплата за отдельный месяц должна быть отдельной строкой
        const paymentsByEmployeeAndMonth = new Map<string, Payment>();
        
        paymentsData.forEach((payment: Payment) => {
          // Определяем месяц выплаты по дате первой выплаты
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
          const monthKey = `${userId}-${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
          
          // Если для этого сотрудника и месяца уже есть выплата, берем более свежую
          if (paymentsByEmployeeAndMonth.has(monthKey)) {
            const existingPayment = paymentsByEmployeeAndMonth.get(monthKey)!;
            const existingDate = existingPayment.first_payment_date 
              ? new Date(existingPayment.first_payment_date)
              : existingPayment.second_payment_date 
              ? new Date(existingPayment.second_payment_date)
              : existingPayment.third_payment_date 
              ? new Date(existingPayment.third_payment_date)
              : null;
            
            if (existingDate && paymentDate > existingDate) {
              paymentsByEmployeeAndMonth.set(monthKey, payment);
            }
          } else {
            paymentsByEmployeeAndMonth.set(monthKey, payment);
          }
        });

        console.log(`Grouped ${paymentsData.length} payments into ${paymentsByEmployeeAndMonth.size} employee-month combinations`);

        // Форматируем данные для отображения - одна строка на сотрудника-месяц
        const formattedPayments = await Promise.all(
          Array.from(paymentsByEmployeeAndMonth.values()).map(async (payment) => {
            const userId = payment.user_id;
            
            // Проверяем разные варианты структуры данных пользователя
            const user = payment.user;
            
            // Если user не загружен, но есть user_id, загружаем пользователя отдельно
            let userData: any = user;
            if (!userData && userId) {
              try {
                const usersResponse = await apiService.getUsers();
                const users = usersResponse && usersResponse.data 
                  ? (Array.isArray(usersResponse.data) ? usersResponse.data : [usersResponse.data])
                  : (Array.isArray(usersResponse) ? usersResponse : []);
                userData = users.find((u: any) => u.id === userId);
              } catch (error) {
                console.error('Error loading user:', error);
              }
            }
            
            console.log('Payment data:', payment);
            console.log('User data:', userData);
            console.log('User ID:', userId);
            
            let hours = 0;
            let total = 0;
            const rate = userData?.rate_per_hour || 0;

            // Загружаем часы для сотрудника из всех проектов
            if (userId) {
              try {
                // Получаем все проекты
                const projectsResponse = await apiService.getProjects(1, 1000);
                let projects: any[] = [];
                if (projectsResponse && projectsResponse.data) {
                  const data = projectsResponse.data.data || projectsResponse.data;
                  projects = Array.isArray(data) ? data : [data];
                }

                // Находим проекты, где сотрудник участвует
                const employeeProjects = projects.filter((project: any) => {
                  if (!project.employees || !Array.isArray(project.employees)) return false;
                  return project.employees.some((emp: any) => {
                    const empId = emp.id || emp.user_id;
                    const isCurrentUser = empId === userId;
                    const isActive = !emp.pivot?.end_working_date;
                    return isCurrentUser && isActive;
                  });
                });

                console.log(`Found ${employeeProjects.length} projects for employee ${userId}`);

                // Определяем месяц для подсчета часов
                // Используем месяц из первой выплаты, если она есть, иначе текущий месяц
                const now = new Date();
                let monthStart: Date;
                let monthEnd: Date;
                
                // Пытаемся определить месяц из даты первой выплаты
                if (payment.first_payment_date) {
                  const paymentDate = new Date(payment.first_payment_date);
                  monthStart = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
                  monthEnd = new Date(paymentDate.getFullYear(), paymentDate.getMonth() + 1, 0, 23, 59, 59);
                } else if (dateFrom && dateTo) {
                  // Если есть фильтры по датам, используем их
                  monthStart = new Date(dateFrom);
                  monthEnd = new Date(dateTo);
                } else {
                  // Иначе используем текущий месяц
                  monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                  monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                }
                
                const monthStartStr = monthStart.toISOString().split('T')[0];
                const monthEndStr = monthEnd.toISOString().split('T')[0];
                
                console.log(`Employee ${userId}: Calculating hours for period: ${monthStartStr} to ${monthEndStr} (based on first payment date: ${payment.first_payment_date || 'none'})`);

                // Суммируем часы из всех проектов сотрудника за выбранный месяц
                const allHours = await Promise.all(
                  employeeProjects.map(async (project: any) => {
                    try {
                      const response = await apiService.getWorkReports(project.id, userId, {
                        per_page: 1000,
                        filter: {
                          date_from: monthStartStr,
                          date_to: monthEndStr,
                        },
                      });
                      
                      let reports: any[] = [];
                      if (response?.data?.data && Array.isArray(response.data.data)) {
                        reports = response.data.data;
                      } else if (response?.data && Array.isArray(response.data)) {
                        reports = response.data;
                      } else if (Array.isArray(response)) {
                        reports = response;
                      }
                      
                      // Фильтруем отчеты по месяцу (на случай, если API не отфильтровал)
                      const monthReports = reports.filter((report) => {
                        if (!report.report_date) return false;
                        const reportDate = new Date(report.report_date);
                        return reportDate >= monthStart && reportDate <= monthEnd;
                      });
                      
                      // Суммируем часы только за выбранный месяц
                      const projectHours = monthReports.reduce((sum, report) => {
                        const hoursWorked = Number(report.hours_worked) || 0;
                        const isAbsent = report.absent === true || report.absent === 1 || report.absent === '1';
                        return sum + (isAbsent ? 0 : hoursWorked);
                      }, 0);
                      
                      console.log(`Project ${project.id}: ${projectHours} hours for period ${monthStartStr} - ${monthEndStr}`);
                      return projectHours;
                    } catch (error) {
                      console.error(`Error loading work reports for employee ${userId} in project ${project.id}:`, error);
                      return 0;
                    }
                  })
                );

                hours = allHours.reduce((sum, h) => sum + h, 0);
                total = hours * rate;
                console.log(`Total hours for employee ${userId}: ${hours}, total: ${total}`);
              } catch (error) {
                console.error(`Error loading hours for employee ${userId}:`, error);
              }
            }

            const employeeName = userData ? apiService.formatUserName(userData) : '';
            const employeePosition = userData?.role || '';
            
            console.log(`Formatted payment: name=${employeeName}, role=${employeePosition}, rate=${rate}, hours=${hours}, total=${total}`);

            // Используем данные из выплаты
            return {
              ...payment,
              user: userData || payment.user, // Сохраняем загруженные данные пользователя
              employeeName: employeeName,
              employeePosition: employeePosition,
              rate: rate,
              hours: hours,
              total: total,
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
          (payment.employeePosition || '').toLowerCase().includes(query)
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

    // Фильтр по дате
    if (dateFrom || dateTo) {
      filtered = filtered.filter((payment) => {
        // Получаем дату выплаты (используем первую доступную дату)
        const paymentDateStr = payment.first_payment_date 
          || payment.second_payment_date 
          || payment.third_payment_date;
        
        if (!paymentDateStr) {
          // Если нет даты выплаты, исключаем из результатов при активном фильтре
          return false;
        }
        
        const paymentDate = new Date(paymentDateStr);
        if (Number.isNaN(paymentDate.getTime())) {
          return false;
        }
        
        // Сбрасываем время для корректного сравнения дат
        const paymentDateOnly = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate());
        
        // Фильтр "от даты"
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
          if (paymentDateOnly < fromDateOnly) {
            return false;
          }
        }
        
        // Фильтр "до даты"
        if (dateTo) {
          const toDate = new Date(dateTo);
          const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
          if (paymentDateOnly > toDateOnly) {
            return false;
          }
        }
        
        return true;
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
              Экспорт XLS
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
        onSave={async (data) => {
          try {
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
          total: editingPayment.total || 0,
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
