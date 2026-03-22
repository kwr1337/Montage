import React, { useState, useRef, useEffect } from 'react';
import { apiService } from '../../../services/api';
import closeIconRaw from '../../icons/closeIcon.svg?raw';
import calendarIconGreyRaw from '../../icons/calendarIconGrey.svg?raw';
import './add-payment-modal.scss';

const toDataUrl = (raw: string) => `data:image/svg+xml,${encodeURIComponent(raw)}`;
const closeIcon = toDataUrl(closeIconRaw);
const calendarIconGrey = toDataUrl(calendarIconGreyRaw);

type PaymentData = {
  amount: string;
  date: string;
  method: string;
};

/** Парсит сумму из строки/числа, убирая пробелы (напр. "8 000" → 8000) */
const parseAmount = (val: string | number | undefined): number => {
  if (val == null) return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const cleaned = String(val).replace(/\s/g, '');
  return parseFloat(cleaned) || 0;
};

type PaymentEditData = {
  id: number;
  employeeId: number;
  projectId?: number;
  employeeName: string;
  employeePosition: string;
  total?: number;
  hours?: number;
  rate?: number;
  firstPayment?: {
    amount: number;
    date: string;
    method: string;
  };
  secondPayment?: {
    amount: number;
    date: string;
    method: string;
  };
  thirdPayment?: {
    amount: number;
    date: string;
    method: string;
  };
  comment?: string;
};

type AddPaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    employeeId: number;
    projectId: number;
    paymentId?: number;
    firstPayment?: PaymentData;
    secondPayment?: PaymentData;
    thirdPayment?: PaymentData;
    comment?: string;
  }) => void;
  /** Период (как на экране ЗП) для расчёта «начислено» при добавлении новой выплаты */
  periodDateFrom?: string;
  periodDateTo?: string;
  projects?: Array<{ id: number; name: string }>;
  employees?: Array<{
    id: number;
    name: string;
    fullName?: string;
    user?: {
      is_dismissed?: boolean;
    };
    is_dismissed?: boolean;
  }>;
  editData?: PaymentEditData | null;
};

/** Часы × ставка по проекту за период (как на экране «Выдача ЗП») */
async function computeOwedTotalForProject(
  projectId: number,
  employeeId: number,
  dateFrom: string,
  dateTo: string,
  fallbackRatePerHour?: number
): Promise<number> {
  const projRes = await apiService.getProjectById(projectId);
  const project = projRes?.data ?? projRes;
  const emp = project?.employees?.find((e: any) => Number(e.id ?? e.user_id) === Number(employeeId));
  const rate =
    Number(emp?.pivot?.rate_per_hour ?? emp?.rate_per_hour ?? fallbackRatePerHour ?? 0) || 0;
  const monthStart = new Date(dateFrom);
  const monthEnd = new Date(dateTo);
  const response = await apiService.getWorkReports(projectId, employeeId, {
    per_page: 1000,
    filter: { date_from: dateFrom, date_to: dateTo },
  });
  let reports: any[] = [];
  if (response?.data?.data && Array.isArray(response.data.data)) {
    reports = response.data.data;
  } else if (response?.data && Array.isArray(response.data)) {
    reports = response.data;
  } else if (Array.isArray(response)) {
    reports = response;
  }
  const monthReports = reports.filter((report) => {
    if (!report.report_date) return false;
    const reportDate = new Date(report.report_date);
    return reportDate >= monthStart && reportDate <= monthEnd;
  });
  const hours = monthReports.reduce((sum, report) => {
    const hoursWorked = Number(report.hours_worked) || 0;
    const isAbsent = report.absent === true || report.absent === 1 || report.absent === '1';
    return sum + (isAbsent ? 0 : hoursWorked);
  }, 0);
  return hours * rate;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  periodDateFrom,
  periodDateTo,
  projects = [],
  employees = [],
  editData = null,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [displayedEmployees, setDisplayedEmployees] = useState<typeof employees>([]);
  const [isEmployeesLoading, setIsEmployeesLoading] = useState(false);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const [isMethodDropdownOpen1, setIsMethodDropdownOpen1] = useState(false);
  const [isMethodDropdownOpen2, setIsMethodDropdownOpen2] = useState(false);
  const [isMethodDropdownOpen3, setIsMethodDropdownOpen3] = useState(false);
  
  const [firstPayment, setFirstPayment] = useState<PaymentData>({
    amount: '',
    date: '',
    method: 'Карта',
  });
  const [secondPayment, setSecondPayment] = useState<PaymentData>({
    amount: '',
    date: '',
    method: 'Наличные',
  });
  const [thirdPayment, setThirdPayment] = useState<PaymentData>({
    amount: '',
    date: '',
    method: 'Наличные',
  });
  const [comment, setComment] = useState('');
  /** Начислено (часы×ставка) за период при создании выплаты — для лимита и автостроки «остаток» */
  const [estimatedOwedTotal, setEstimatedOwedTotal] = useState<number | null>(null);
  const [isEstimatingOwed, setIsEstimatingOwed] = useState(false);

  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const methodDropdownRef1 = useRef<HTMLDivElement>(null);
  const methodDropdownRef2 = useRef<HTMLDivElement>(null);
  const methodDropdownRef3 = useRef<HTMLDivElement>(null);
  const dateFromRef1 = useRef<HTMLInputElement>(null);
  const dateFromRef2 = useRef<HTMLInputElement>(null);
  const dateFromRef3 = useRef<HTMLInputElement>(null);

  const paymentMethods = ['Карта', 'Наличные'];

  // Сотрудники для выбора: в проекте + те, кому бригадир уже внёс часы (work_reports)
  // API /projects/{id}/work-reports может не существовать, поэтому проверяем work_reports по каждому сотруднику
  useEffect(() => {
    if (!selectedProjectId || !isOpen) {
      setDisplayedEmployees([]);
      return;
    }
    const load = async () => {
      setIsEmployeesLoading(true);
      try {
        const projectRes = await apiService.getProjectById(selectedProjectId);
        const project = projectRes?.data ?? projectRes;
        const projectEmployees = project?.employees ?? [];
        const inProjectIds = new Set((projectEmployees as any[]).map((e: any) => Number(e.id ?? e.user_id)));

        // Сотрудники с work_reports: для каждого сотрудника проверяем наличие отчётов через API /projects/{id}/user/{userId}/work-reports
        const workReportUserIds = new Set<number>();
        const employeesToCheck = employees.filter(
          (e: any) => !(e.user?.is_dismissed === true || e.is_dismissed === true) && !inProjectIds.has(e.id)
        );
        const checks = await Promise.all(
          employeesToCheck.slice(0, 100).map(async (emp: any) => {
            try {
              const res = await apiService.getWorkReports(selectedProjectId, emp.id, { per_page: 1 });
              const data = res?.data?.data ?? res?.data ?? res;
              const arr = Array.isArray(data) ? data : (data ? [data] : []);
              return arr.length > 0 ? emp.id : null;
            } catch {
              return null;
            }
          })
        );
        checks.forEach((id) => { if (id != null) workReportUserIds.add(id); });

        const allIds = new Set([...inProjectIds, ...workReportUserIds]);
        const empMap = new Map(employees.map((e) => [e.id, e]));
        const result: typeof employees = [];
        allIds.forEach((id) => {
          let emp = empMap.get(id);
          if (!emp) {
            const pe = (projectEmployees as any[]).find((e: any) => (e.id ?? e.user_id) === id);
            if (pe) {
              emp = {
                id,
                name: apiService.formatUserName(pe),
                fullName: `${pe.last_name || ''} ${pe.first_name || ''} ${pe.second_name || ''}`.trim(),
                user: pe.user ?? pe,
                is_dismissed: pe.is_dismissed ?? pe.user?.is_dismissed,
              };
            }
          }
          if (emp && !(emp.user?.is_dismissed === true || emp.is_dismissed === true)) {
            result.push(emp);
          }
        });
        // При редактировании гарантируем, что текущий сотрудник в списке
        if (editData?.employeeId && !result.some((e) => e.id === editData.employeeId)) {
          const fromAll = empMap.get(editData.employeeId);
          if (fromAll) result.push(fromAll);
        }
        setDisplayedEmployees(result);
      } catch (e) {
        console.error('Error loading employees for project:', e);
        setDisplayedEmployees([]);
      } finally {
        setIsEmployeesLoading(false);
      }
    };
    load();
  }, [selectedProjectId, isOpen, employees, editData?.employeeId]);

  useEffect(() => {
    if (!isOpen || editData || !selectedProjectId || !selectedEmployeeId || !periodDateFrom || !periodDateTo) {
      setEstimatedOwedTotal(null);
      return;
    }
    let cancelled = false;
    setIsEstimatingOwed(true);
    const emp = employees.find((e) => e.id === selectedEmployeeId);
    const fallback = Number((emp as any)?.user?.rate_per_hour ?? 0) || 0;
    computeOwedTotalForProject(selectedProjectId, selectedEmployeeId, periodDateFrom, periodDateTo, fallback)
      .then((total) => {
        if (!cancelled) setEstimatedOwedTotal(total);
      })
      .catch(() => {
        if (!cancelled) setEstimatedOwedTotal(null);
      })
      .finally(() => {
        if (!cancelled) setIsEstimatingOwed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, editData, selectedProjectId, selectedEmployeeId, periodDateFrom, periodDateTo, employees]);

  const capTotalForForm = React.useMemo(() => {
    if (editData) {
      return (
        Number(editData.total) ||
        (editData.hours != null && editData.rate != null ? editData.hours * editData.rate : 0)
      );
    }
    return estimatedOwedTotal ?? 0;
  }, [editData, estimatedOwedTotal]);

  const formatDateDDMMYYYY = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Преобразует дату из формата "11 сен 2025" в YYYY-MM-DD
  const parseDateString = (dateStr: string): string => {
    if (!dateStr) return '';
    // Если дата уже в формате YYYY-MM-DD, возвращаем как есть
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // Пытаемся распарсить дату
    const date = new Date(dateStr);
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Пытаемся распарсить русский формат "11 сен 2025"
    const months: { [key: string]: string } = {
      'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04',
      'май': '05', 'июн': '06', 'июл': '07', 'авг': '08',
      'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12'
    };
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = months[parts[1].toLowerCase()] || '01';
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  /** Форматирование числа для инпута: только цифры с пробелами (₽ выносится в суффикс) */
  const formatCurrencyInput = (value: string) => {
    const num = value.replace(/\s/g, '').replace(/₽/g, '');
    if (!num) return '';
    return parseInt(num, 10).toLocaleString('ru-RU');
  };

  const handleAmountChange = (value: string, setter: (data: PaymentData) => void, current: PaymentData) => {
    const num = value.replace(/\D/g, '');
    setter({ ...current, amount: num });
  };

  const handleSave = () => {
    if (!selectedEmployeeId) {
      alert('Выберите сотрудника');
      return;
    }
    const projectId = editData?.projectId ?? selectedProjectId;
    if (projects.length > 0 && !projectId) {
      alert('Выберите проект');
      return;
    }
    if (projectId == null) {
      alert('Не указан проект');
      return;
    }

    const firstAmt = firstPayment.amount && firstPayment.date ? parseAmount(firstPayment.amount) : 0;
    const secondAmt = secondPayment.amount && secondPayment.date ? parseAmount(secondPayment.amount) : 0;
    let thirdAmt = 0;
    if (capTotalForForm > 0) {
      const calculatedBalance = Math.max(0, capTotalForForm - firstAmt - secondAmt);
      if (calculatedBalance > 0 && thirdPayment.date) {
        thirdAmt = calculatedBalance;
      }
    } else if (thirdPayment.amount && thirdPayment.date) {
      thirdAmt = parseAmount(thirdPayment.amount);
    }
    const sumPayments = firstAmt + secondAmt + thirdAmt;
    const fmt = (n: number) =>
      new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n));

    if (sumPayments > 0.01) {
      if (!editData && isEstimatingOwed) {
        alert('Подождите: рассчитывается начисленная сумма по проекту за период.');
        return;
      }
      if (!editData && periodDateFrom && periodDateTo && estimatedOwedTotal === null && !isEstimatingOwed) {
        alert('Не удалось рассчитать начислено за период. Проверьте часы по проекту или попробуйте позже.');
        return;
      }
    }

    if (capTotalForForm > 0.01 && sumPayments - capTotalForForm > 0.01) {
      alert(
        `Сумма выплат (${fmt(sumPayments)} ₽) не может превышать начислено (${fmt(capTotalForForm)} ₽). Уменьшите суммы выплат.`
      );
      return;
    }

    if (capTotalForForm <= 0.01 && sumPayments > 0.01) {
      alert(
        editData
          ? 'По записи начислено 0 ₽ — укажите выплаты только если скорректировано начисление (часы/ставка).'
          : 'За выбранный период по проекту начислено 0 ₽ — нельзя внести выплату больше 0.'
      );
      return;
    }

    const data = {
      employeeId: selectedEmployeeId,
      projectId,
      paymentId: editData?.id,
      firstPayment: firstPayment.amount && firstPayment.date ? {
        amount: firstPayment.amount,
        date: firstPayment.date,
        method: firstPayment.method,
      } : undefined,
      secondPayment: secondPayment.amount && secondPayment.date ? {
        amount: secondPayment.amount,
        date: secondPayment.date,
        method: secondPayment.method,
      } : undefined,
      // Остаток рассчитываем автоматически
      thirdPayment: (() => {
        if (capTotalForForm > 0) {
          const calculatedBalance = Math.max(0, capTotalForForm - firstAmt - secondAmt);
          if (calculatedBalance > 0 && thirdPayment.date) {
            return {
              amount: calculatedBalance.toString(),
              date: thirdPayment.date,
              method: thirdPayment.method,
            };
          }
        } else if (thirdPayment.amount && thirdPayment.date) {
          return {
            amount: thirdPayment.amount,
            date: thirdPayment.date,
            method: thirdPayment.method,
          };
        }
        return undefined;
      })(),
      comment: comment || undefined,
    };

    onSave(data);
    handleClose();
  };

  const handleClose = () => {
    setSelectedEmployeeId(null);
    setSelectedProjectId(null);
    setFirstPayment({ amount: '', date: '', method: 'Карта' });
    setSecondPayment({ amount: '', date: '', method: 'Наличные' });
    setThirdPayment({ amount: '', date: '', method: 'Наличные' });
    setComment('');
    setIsEmployeeDropdownOpen(false);
    setIsMethodDropdownOpen1(false);
    setIsMethodDropdownOpen2(false);
    setIsMethodDropdownOpen3(false);
    onClose();
  };

  // Заполнение формы данными для редактирования
  React.useEffect(() => {
    if (editData && isOpen) {
      setSelectedEmployeeId(editData.employeeId);
      setSelectedProjectId(editData.projectId ?? null);
      setFirstPayment({
        amount: editData.firstPayment?.amount?.toString() || '',
        date: parseDateString(editData.firstPayment?.date || ''),
        method: editData.firstPayment?.method || 'Карта',
      });
      setSecondPayment({
        amount: editData.secondPayment?.amount?.toString() || '',
        date: parseDateString(editData.secondPayment?.date || ''),
        method: editData.secondPayment?.method || 'Наличные',
      });
      // Рассчитываем остаток автоматически (fallback: hours * rate если total не задан)
      const total = editData.total ?? (editData.hours != null && editData.rate != null ? editData.hours * editData.rate : 0);
      const firstAmount = editData.firstPayment?.amount || 0;
      const secondAmount = editData.secondPayment?.amount || 0;
      const calculatedBalance = Math.max(0, total - firstAmount - secondAmount);
      
      // Если есть третья выплата, используем её, иначе используем рассчитанный остаток
      const thirdAmount = editData.thirdPayment?.amount || calculatedBalance;
      
      setThirdPayment({
        amount: thirdAmount > 0 ? thirdAmount.toString() : '',
        date: parseDateString(editData.thirdPayment?.date || ''),
        method: editData.thirdPayment?.method || 'Наличные',
      });
      setComment(editData.comment || '');
    } else if (!editData && isOpen) {
      // Сброс формы при открытии для создания новой выплаты
      setSelectedEmployeeId(null);
      setSelectedProjectId(null);
      setFirstPayment({ amount: '', date: '', method: 'Карта' });
      setSecondPayment({ amount: '', date: '', method: 'Наличные' });
      setThirdPayment({ amount: '', date: '', method: 'Наличные' });
      setComment('');
    }
  }, [editData, isOpen]);

  // Автоматический расчет остатка при изменении первой или второй выплаты
  React.useEffect(() => {
    if (capTotalForForm > 0) {
      const firstAmount = parseAmount(firstPayment.amount);
      const secondAmount = parseAmount(secondPayment.amount);
      const calculatedBalance = Math.max(0, capTotalForForm - firstAmount - secondAmount);

      setThirdPayment((prev) => ({
        ...prev,
        amount: calculatedBalance > 0 ? calculatedBalance.toString() : '',
      }));
    }
  }, [firstPayment.amount, secondPayment.amount, capTotalForForm]);

  // Закрытие dropdown при клике вне
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
      if (methodDropdownRef1.current && !methodDropdownRef1.current.contains(event.target as Node)) {
        setIsMethodDropdownOpen1(false);
      }
      if (methodDropdownRef2.current && !methodDropdownRef2.current.contains(event.target as Node)) {
        setIsMethodDropdownOpen2(false);
      }
      if (methodDropdownRef3.current && !methodDropdownRef3.current.contains(event.target as Node)) {
        setIsMethodDropdownOpen3(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const employeeList = selectedProjectId ? displayedEmployees : employees;
  const selectedEmployee = employeeList.find((emp) => emp.id === selectedEmployeeId)
    ?? employees.find((emp) => emp.id === selectedEmployeeId);

  if (!isOpen) return null;

  return (
    <div className="add-payment-modal-overlay" onClick={handleClose}>
      <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-payment-modal__header">
          <h2 className="add-payment-modal__title">
            {editData ? 'Редактировать выплату' : 'Добавить выплату'}
          </h2>
          <button className="add-payment-modal__close" onClick={handleClose}>
            <img src={closeIcon} alt="Закрыть" />
          </button>
        </div>

        <div className="add-payment-modal__content">
          {/* Выбор проекта */}
          {projects.length > 0 && (
            <div className="add-payment-modal__section">
              <h3 className="add-payment-modal__section-title">Выберите проект</h3>
              <div className="add-payment-modal__field" ref={projectDropdownRef}>
                <label className="add-payment-modal__label add-payment-modal__label--required">Проект</label>
                <div
                  className={`add-payment-modal__dropdown-trigger ${editData ? 'add-payment-modal__dropdown-trigger--disabled' : ''}`}
                  onClick={() => {
                    if (!editData) setIsProjectDropdownOpen(!isProjectDropdownOpen);
                  }}
                >
                  <span className={selectedProjectId ? 'add-payment-modal__dropdown-value' : 'add-payment-modal__dropdown-placeholder'}>
                    {selectedProjectId ? (projects.find((p) => p.id === selectedProjectId)?.name || '') : 'Выберите проект'}
                  </span>
                  {!editData && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {isProjectDropdownOpen && !editData && (
                  <div className="add-payment-modal__dropdown">
                    {projects.map((proj) => (
                      <div
                        key={proj.id}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setIsProjectDropdownOpen(false);
                        }}
                      >
                        {proj.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Выбор сотрудника */}
          <div className="add-payment-modal__section">
            <h3 className="add-payment-modal__section-title">Выберите сотрудника</h3>
            <div className="add-payment-modal__field" ref={employeeDropdownRef}>
              <label className="add-payment-modal__label add-payment-modal__label--required">Сотрудник</label>
              <div
                className={`add-payment-modal__dropdown-trigger ${editData || (projects.length > 0 && !selectedProjectId) || (selectedProjectId && isEmployeesLoading) ? 'add-payment-modal__dropdown-trigger--disabled' : ''}`}
                onClick={() => {
                  if (!editData && !(projects.length > 0 && !selectedProjectId) && !(selectedProjectId && isEmployeesLoading)) {
                    setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
                  }
                }}
              >
                <span className={selectedEmployee ? 'add-payment-modal__dropdown-value' : 'add-payment-modal__dropdown-placeholder'}>
                  {selectedEmployee ? (selectedEmployee.fullName || selectedEmployee.name)
                    : projects.length > 0 && !selectedProjectId
                      ? 'Сначала выберите проект'
                      : selectedProjectId && isEmployeesLoading
                        ? 'Загрузка...'
                        : 'Выберите сотрудника'}
                </span>
                {!editData && !(projects.length > 0 && !selectedProjectId) && !(selectedProjectId && isEmployeesLoading) && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {isEmployeeDropdownOpen && !editData && (
                <div className="add-payment-modal__dropdown">
                  {employeeList
                    .filter((emp) => {
                      const isDismissed = emp.user?.is_dismissed === true || emp.is_dismissed === true;
                      return !isDismissed;
                    })
                    .map((emp) => (
                      <div
                        key={emp.id}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setIsEmployeeDropdownOpen(false);
                        }}
                      >
                        {emp.fullName || emp.name}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Выплаты */}
          <div className="add-payment-modal__section">
            <h3 className="add-payment-modal__section-title">Выплаты</h3>

            {/* 1-я выплата */}
            <div className="add-payment-modal__payment">
              <div className="add-payment-modal__payment-label">1-я выплата</div>
              <div className="add-payment-modal__payment-row">
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Сумма</label>
                  <div className="add-payment-modal__currency-input">
                    <input
                      type="text"
                      className="add-payment-modal__input"
                      value={firstPayment.amount ? formatCurrencyInput(firstPayment.amount) : ''}
                      onChange={(e) => handleAmountChange(e.target.value, setFirstPayment, firstPayment)}
                      placeholder="0"
                    />
                    <span className="add-payment-modal__currency-suffix">₽</span>
                  </div>
                </div>
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Дата выдачи</label>
                  <div
                    className="add-payment-modal__date-input"
                    onClick={() => {
                      if (dateFromRef1.current) {
                        dateFromRef1.current.showPicker?.();
                        dateFromRef1.current.focus();
                      }
                    }}
                  >
                    <img src={calendarIconGrey} alt="Календарь" />
                    {firstPayment.date ? (
                      <span className="add-payment-modal__date-display">
                        {formatDateDDMMYYYY(firstPayment.date)}
                      </span>
                    ) : (
                      <span className="add-payment-modal__date-placeholder">дд / мм / гггг</span>
                    )}
                    <input
                      ref={dateFromRef1}
                      type="date"
                      className="add-payment-modal__date-input-hidden"
                      value={firstPayment.date}
                      onChange={(e) => setFirstPayment({ ...firstPayment, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="add-payment-modal__field" ref={methodDropdownRef1}>
                <label className="add-payment-modal__label">Способ</label>
                <div
                  className="add-payment-modal__dropdown-trigger"
                  onClick={() => setIsMethodDropdownOpen1(!isMethodDropdownOpen1)}
                >
                  <span className="add-payment-modal__dropdown-value">{firstPayment.method}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {isMethodDropdownOpen1 && (
                  <div className="add-payment-modal__dropdown">
                    {paymentMethods.map((method) => (
                      <div
                        key={method}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setFirstPayment({ ...firstPayment, method });
                          setIsMethodDropdownOpen1(false);
                        }}
                      >
                        {method}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2-я выплата */}
            <div className="add-payment-modal__payment">
              <div className="add-payment-modal__payment-label">2-я выплата</div>
              <div className="add-payment-modal__payment-row">
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Сумма</label>
                  <div className="add-payment-modal__currency-input">
                    <input
                      type="text"
                      className="add-payment-modal__input"
                      value={secondPayment.amount ? formatCurrencyInput(secondPayment.amount) : ''}
                      onChange={(e) => handleAmountChange(e.target.value, setSecondPayment, secondPayment)}
                      placeholder="0"
                    />
                    <span className="add-payment-modal__currency-suffix">₽</span>
                  </div>
                </div>
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Дата выдачи</label>
                  <div
                    className="add-payment-modal__date-input"
                    onClick={() => {
                      if (dateFromRef2.current) {
                        dateFromRef2.current.showPicker?.();
                        dateFromRef2.current.focus();
                      }
                    }}
                  >
                    <img src={calendarIconGrey} alt="Календарь" />
                    {secondPayment.date ? (
                      <span className="add-payment-modal__date-display">
                        {formatDateDDMMYYYY(secondPayment.date)}
                      </span>
                    ) : (
                      <span className="add-payment-modal__date-placeholder">дд / мм / гггг</span>
                    )}
                    <input
                      ref={dateFromRef2}
                      type="date"
                      className="add-payment-modal__date-input-hidden"
                      value={secondPayment.date}
                      onChange={(e) => setSecondPayment({ ...secondPayment, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="add-payment-modal__field" ref={methodDropdownRef2}>
                <label className="add-payment-modal__label">Способ</label>
                <div
                  className="add-payment-modal__dropdown-trigger"
                  onClick={() => setIsMethodDropdownOpen2(!isMethodDropdownOpen2)}
                >
                  <span className="add-payment-modal__dropdown-value">{secondPayment.method}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {isMethodDropdownOpen2 && (
                  <div className="add-payment-modal__dropdown">
                    {paymentMethods.map((method) => (
                      <div
                        key={method}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setSecondPayment({ ...secondPayment, method });
                          setIsMethodDropdownOpen2(false);
                        }}
                      >
                        {method}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Остаток */}
            <div className="add-payment-modal__payment">
              <div className="add-payment-modal__payment-label">Остаток</div>
              <div className="add-payment-modal__payment-row">
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Сумма</label>
                  <div className="add-payment-modal__currency-input">
                    <input
                      type="text"
                      className="add-payment-modal__input"
                      readOnly
                      value={(() => {
                        if (capTotalForForm > 0) {
                          const firstAmount = parseAmount(firstPayment.amount);
                          const secondAmount = parseAmount(secondPayment.amount);
                          const calculatedBalance = Math.max(0, capTotalForForm - firstAmount - secondAmount);
                          return calculatedBalance > 0 ? formatCurrencyInput(calculatedBalance.toString()) : '';
                        }
                        return '';
                      })()}
                      placeholder="0"
                      style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                    <span className="add-payment-modal__currency-suffix">₽</span>
                  </div>
                </div>
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Дата выдачи</label>
                  <div
                    className="add-payment-modal__date-input"
                    onClick={() => {
                      if (dateFromRef3.current) {
                        dateFromRef3.current.showPicker?.();
                        dateFromRef3.current.focus();
                      }
                    }}
                  >
                    <img src={calendarIconGrey} alt="Календарь" />
                    {thirdPayment.date ? (
                      <span className="add-payment-modal__date-display">
                        {formatDateDDMMYYYY(thirdPayment.date)}
                      </span>
                    ) : (
                      <span className="add-payment-modal__date-placeholder">дд.мм.гггг</span>
                    )}
                    <input
                      ref={dateFromRef3}
                      type="date"
                      className="add-payment-modal__date-input-hidden"
                      value={thirdPayment.date}
                      onChange={(e) => setThirdPayment({ ...thirdPayment, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="add-payment-modal__field" ref={methodDropdownRef3}>
                <label className="add-payment-modal__label">Способ</label>
                <div
                  className="add-payment-modal__dropdown-trigger"
                  onClick={() => setIsMethodDropdownOpen3(!isMethodDropdownOpen3)}
                >
                  <span className="add-payment-modal__dropdown-value">{thirdPayment.method}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {isMethodDropdownOpen3 && (
                  <div className="add-payment-modal__dropdown">
                    {paymentMethods.map((method) => (
                      <div
                        key={method}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setThirdPayment({ ...thirdPayment, method });
                          setIsMethodDropdownOpen3(false);
                        }}
                      >
                        {method}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Доп. информация */}
          <div className="add-payment-modal__section">
            <h3 className="add-payment-modal__section-title">Доп. информация</h3>
            <div className="add-payment-modal__field">
              <label className="add-payment-modal__label">Комментарий</label>
              <textarea
                className="add-payment-modal__textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Введите текст комментария..."
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="add-payment-modal__actions">
          <button className="add-payment-modal__btn add-payment-modal__btn--cancel" onClick={handleClose}>
            Отмена
          </button>
          <button
            className="add-payment-modal__btn add-payment-modal__btn--save"
            onClick={handleSave}
            disabled={
              !selectedEmployeeId ||
              (projects.length > 0 && !selectedProjectId && !editData?.projectId) ||
              (!editData && isEstimatingOwed)
            }
          >
            {editData ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
};

