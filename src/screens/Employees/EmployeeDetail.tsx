import React, { useState, useEffect, useRef } from 'react';
import { TextInput } from '../../shared/ui/TextInput';
import { Button } from '../../shared/ui/Button';
import { Pagination } from '../../shared/ui/Pagination/Pagination';
import dotsIcon from '../../shared/icons/dotsIcon.svg';
import userDropdownIcon from '../../shared/icons/user-dropdown-icon.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import calendarIconGrey from '../../shared/icons/calendarIconGrey.svg';
import { apiService } from '../../services/api';
import './employee-detail.scss';

type EmployeeDetailProps = {
  employee: any;
  onBack: () => void;
  onSave?: (updatedEmployee: any) => void;
  onCreate?: (createdEmployee: any) => void;
  isNew?: boolean;
};
// Функция для установки end_working_date во всех проектах при увольнении сотрудника
const updateEmployeeEndDateInAllProjects = async (employeeId: number, dismissalDate: string) => {
  try {
    // Получаем все проекты (используем большой per_page для получения всех проектов)
    const response = await apiService.getProjects(1, 1000);
    const projects = response?.data?.data || response?.data || [];
    
    // Для каждого проекта проверяем, есть ли там увольняемый сотрудник
    const updatePromises = projects.map(async (project: any) => {
      if (!project.id || !project.employees || !Array.isArray(project.employees)) {
        return;
      }
      
      // Ищем сотрудника в проекте
      const employeeInProject = project.employees.find((emp: any) => emp.id === employeeId);
      
      // Если сотрудник найден и у него нет end_working_date, обновляем проект
      if (employeeInProject && !employeeInProject.pivot?.end_working_date) {
        // Формируем массив всех сотрудников проекта с обновленным end_working_date для увольняемого
        const employeeArray = project.employees.map((emp: any) => {
          if (emp.id === employeeId) {
            return {
              id: emp.id,
              start_working_date: emp.pivot?.start_working_date || project.start_date,
              end_working_date: dismissalDate,
              rate_per_hour: emp.pivot?.rate_per_hour || emp.rate_per_hour || 0
            };
          } else {
            return {
              id: emp.id,
              start_working_date: emp.pivot?.start_working_date || project.start_date,
              end_working_date: emp.pivot?.end_working_date || null,
              rate_per_hour: emp.pivot?.rate_per_hour || emp.rate_per_hour || 0
            };
          }
        });
        
        // Обновляем проект
        await apiService.updateProject(project.id, {
          employee: employeeArray
        });
      }
    });
    
    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error updating employee end date in projects:', error);
    // Не прерываем процесс увольнения, если обновление проектов не удалось
  }
};

export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employee, onBack, onSave, onCreate, isNew = false }) => {
  // Проверка прав на редактирование сотрудников
  const canEditEmployee = () => {
    const currentUser = apiService.getCurrentUser();
    if (!currentUser) {
      console.log('canEditEmployee: No current user');
      return false;
    }
    
    console.log('canEditEmployee: currentUser:', currentUser);
    console.log('canEditEmployee: is_system_admin:', currentUser.is_system_admin);
    console.log('canEditEmployee: role:', currentUser.role);
    console.log('canEditEmployee: position:', currentUser.position);
    
    // Админы системы
    if (currentUser.is_system_admin === true) {
      console.log('canEditEmployee: User is system admin');
      return true;
    }
    
    // ГИП или Бухгалтер - проверяем разные варианты названия
    const role = (currentUser.role || currentUser.position || '').toLowerCase();
    const isGIP = role.includes('гип') || role === 'главный инженер проекта';
    const isBuhgalter = role.includes('бухгалтер') || role === 'бухгалтер';
    
    console.log('canEditEmployee: role (lowercase):', role);
    console.log('canEditEmployee: isGIP:', isGIP);
    console.log('canEditEmployee: isBuhgalter:', isBuhgalter);
    
    if (isGIP || isBuhgalter) {
      console.log('canEditEmployee: User has edit permissions');
      return true;
    }
    
    console.log('canEditEmployee: User does NOT have edit permissions');
    return false;
  };

  const mapWorkSchedule = (value?: string) => {
    if (!value) {
      return '5/2';
    }
    return value === '5/2' ? '5/2 ' : value;
  };

  const [formData, setFormData] = useState(() => {
    // Если role === "user", отображаем "Не выбрано" (пустую строку)
    const positionValue = (employee.role === 'user' || !employee.role) ? '' : (employee.role || '');
    
    return {
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      second_name: employee.second_name || '',
      phone: employee.phone || '',
      email: employee.email || '',
      position: positionValue,
      work_schedule: mapWorkSchedule(employee.work_schedule),
      status: employee.is_dismissed ? 'Уволен' : 'Работает',
      rate_per_hour: employee.rate_per_hour ? String(employee.rate_per_hour) : '',
      password: isNew ? '' : (employee.password || ''),
      birth_date: employee.birth_date || '',
      gender: employee.gender || 'male',
      employment_date: employee.employment_date || '',
      dateFrom: '',
      dateTo: '',
    };
  });

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isDotsMenuOpen, setIsDotsMenuOpen] = useState(false);
  const [isPositionDropdownOpen, setIsPositionDropdownOpen] = useState(false);
  const [isScheduleDropdownOpen, setIsScheduleDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dotsMenuRef = React.useRef<HTMLDivElement>(null);
  const positionDropdownRef = React.useRef<HTMLDivElement>(null);
  const scheduleDropdownRef = React.useRef<HTMLDivElement>(null);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const genderDropdownRef = React.useRef<HTMLDivElement>(null);
  const dateFromRef = React.useRef<HTMLInputElement>(null);
  const dateToRef = React.useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Опции для выпадающих списков
  const positionOptions = [
    'Не выбрано',
    'Главный инженер проекта',
    'Бухгалтер',
    'Бригадир',
    'Сметчик'
  ];
  const scheduleOptions = ['5/2', '2/2'];
  const statusOptions = ['Работает', 'Уволен'];
  const genderOptions = [
    { value: 'male', label: 'Мужской' },
    { value: 'female', label: 'Женский' },
  ];

  // Закрытие дропдаунов при клике вне их
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dotsMenuRef.current && !dotsMenuRef.current.contains(event.target as Node)) {
        setIsDotsMenuOpen(false);
      }
      if (positionDropdownRef.current && !positionDropdownRef.current.contains(event.target as Node)) {
        setIsPositionDropdownOpen(false);
      }
      if (scheduleDropdownRef.current && !scheduleDropdownRef.current.contains(event.target as Node)) {
        setIsScheduleDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target as Node)) {
        setIsGenderDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isNew) {
      return;
    }

    // Загружаем полные данные сотрудника, включая пароль
    const loadEmployeeData = async () => {
      if (!employee?.id) return;
      
      try {
        const response = await apiService.getUserById(employee.id);
        const fullEmployeeData = response?.data ?? response ?? employee;
        
        // Если role === "user", отображаем "Не выбрано" (пустую строку)
        const positionValue = (fullEmployeeData.role === 'user' || !fullEmployeeData.role) 
          ? '' 
          : (fullEmployeeData.role || employee.role || '');
        
        setFormData({
          first_name: fullEmployeeData.first_name || employee.first_name || '',
          last_name: fullEmployeeData.last_name || employee.last_name || '',
          second_name: fullEmployeeData.second_name || employee.second_name || '',
          phone: fullEmployeeData.phone || employee.phone || '',
          email: fullEmployeeData.email || employee.email || '',
          position: positionValue,
          work_schedule: mapWorkSchedule(fullEmployeeData.work_schedule || employee.work_schedule),
          status: fullEmployeeData.is_dismissed ? 'Уволен' : 'Работает',
          rate_per_hour: fullEmployeeData.rate_per_hour ? String(fullEmployeeData.rate_per_hour) : (employee.rate_per_hour ? String(employee.rate_per_hour) : ''),
          password: fullEmployeeData.password || employee.password || '',
          birth_date: fullEmployeeData.birth_date || employee.birth_date || '',
          gender: fullEmployeeData.gender || employee.gender || 'male',
          employment_date: fullEmployeeData.employment_date || employee.employment_date || '',
          dateFrom: '',
          dateTo: '',
        });
      } catch (error) {
        console.error('Error loading employee data:', error);
        // Если не удалось загрузить, используем данные из employee
        // Если role === "user", отображаем "Не выбрано" (пустую строку)
        const positionValue = (employee.role === 'user' || !employee.role) ? '' : (employee.role || '');
        
        setFormData({
          first_name: employee.first_name || '',
          last_name: employee.last_name || '',
          second_name: employee.second_name || '',
          phone: employee.phone || '',
          email: employee.email || '',
          position: positionValue,
          work_schedule: mapWorkSchedule(employee.work_schedule),
          status: employee.is_dismissed ? 'Уволен' : 'Работает',
          rate_per_hour: employee.rate_per_hour ? String(employee.rate_per_hour) : '',
          password: employee.password || '',
          birth_date: employee.birth_date || '',
          gender: employee.gender || 'male',
          employment_date: employee.employment_date || '',
          dateFrom: '',
          dateTo: '',
        });
      }
    };

    loadEmployeeData();
  }, [employee?.id, isNew]);

  // Форматирование даты в формате дд/мм/гггг
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return null;
    }
  };

  // Состояние для истории выплат ЗП
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [isLoadingSalary, setIsLoadingSalary] = useState(false);

  // Форматирование даты для выплат: "11 сен 2025"
  const formatDateForPayment = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Форматирование валюты
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

  // Получение названия месяца на русском
  const getMonthName = (date: Date) => {
    const months = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];
    return months[date.getMonth()];
  };

  // Загрузка выплат для сотрудника
  useEffect(() => {
    if (isNew || !employee?.id) return;

    const loadSalaryHistory = async () => {
      setIsLoadingSalary(true);
      try {
        const employeeId = employee.id;
        console.log('Loading salary history for employee ID:', employeeId);
        console.log('Employee object:', employee);
        
        // Загружаем все выплаты для сотрудника с фильтрацией по датам
        const filter: any = {
          users: [employeeId],
        };
        if (formData.dateFrom) filter.date_from = formData.dateFrom;
        if (formData.dateTo) filter.date_to = formData.dateTo;
        
        const response = await apiService.getPayments({
          per_page: 1000,
          filter: filter,
        });

        console.log('Payments API response:', response);

        let paymentsData: any[] = [];
        if (response) {
          if (response.data) {
            if (response.data.data && Array.isArray(response.data.data)) {
              paymentsData = response.data.data;
            } else if (Array.isArray(response.data)) {
              paymentsData = response.data;
            }
          } else if (Array.isArray(response)) {
            paymentsData = response;
          }
        }

        // Дополнительная фильтрация по user_id на случай, если API не отфильтровал правильно
        paymentsData = paymentsData.filter((payment: any) => {
          const paymentUserId = payment.user_id;
          const matches = paymentUserId === employeeId;
          if (!matches) {
            console.warn(`Payment ${payment.id} has user_id=${paymentUserId}, but expected ${employeeId}. Filtering out.`);
          }
          return matches;
        });

        console.log(`Filtered payments for employee ${employeeId}:`, paymentsData.length, paymentsData);

        // Дополнительная клиентская фильтрация по датам (на случай, если API не отфильтровал)
        if (formData.dateFrom || formData.dateTo) {
          paymentsData = paymentsData.filter((payment: any) => {
            // Получаем дату выплаты (используем первую доступную дату)
            const paymentDateStr = payment.first_payment_date 
              || payment.second_payment_date 
              || payment.third_payment_date;
            
            if (!paymentDateStr) {
              return false;
            }
            
            const paymentDate = new Date(paymentDateStr);
            if (Number.isNaN(paymentDate.getTime())) {
              return false;
            }
            
            // Сбрасываем время для корректного сравнения дат
            const paymentDateOnly = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate());
            
            // Фильтр "от даты"
            if (formData.dateFrom) {
              const fromDate = new Date(formData.dateFrom);
              const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
              if (paymentDateOnly < fromDateOnly) {
                return false;
              }
            }
            
            // Фильтр "до даты"
            if (formData.dateTo) {
              const toDate = new Date(formData.dateTo);
              const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
              if (paymentDateOnly > toDateOnly) {
                return false;
              }
            }
            
            return true;
          });
        }

        // Группируем выплаты по месяцам
        const paymentsByMonth = new Map<string, any[]>();
        
        paymentsData.forEach((payment: any) => {
          // Определяем месяц по дате первой выплаты
          const paymentDate = payment.first_payment_date 
            ? new Date(payment.first_payment_date)
            : payment.second_payment_date 
            ? new Date(payment.second_payment_date)
            : payment.third_payment_date 
            ? new Date(payment.third_payment_date)
            : null;

          if (!paymentDate || Number.isNaN(paymentDate.getTime())) return;

          const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (!paymentsByMonth.has(monthKey)) {
            paymentsByMonth.set(monthKey, []);
          }
          paymentsByMonth.get(monthKey)!.push(payment);
        });

        // Для каждого месяца загружаем часы и формируем данные
        const historyData = await Promise.all(
          Array.from(paymentsByMonth.entries()).map(async ([monthKey, payments]) => {
            const [year, month] = monthKey.split('-');
            const monthDate = new Date(Number(year), Number(month) - 1, 1);
            
            // Берем первую выплату для определения месяца
            const firstPayment = payments[0];
            const paymentMonthDate = firstPayment.first_payment_date 
              ? new Date(firstPayment.first_payment_date)
              : firstPayment.second_payment_date 
              ? new Date(firstPayment.second_payment_date)
              : firstPayment.third_payment_date 
              ? new Date(firstPayment.third_payment_date)
              : monthDate;

            const monthStart = new Date(paymentMonthDate.getFullYear(), paymentMonthDate.getMonth(), 1);
            const monthEnd = new Date(paymentMonthDate.getFullYear(), paymentMonthDate.getMonth() + 1, 0, 23, 59, 59);
            
            const monthStartStr = monthStart.toISOString().split('T')[0];
            const monthEndStr = monthEnd.toISOString().split('T')[0];

            // Загружаем часы за этот месяц
            let hours = 0;
            const rate = employee.rate_per_hour || 0;

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
                  const isCurrentUser = empId === employee.id;
                  const isActive = !emp.pivot?.end_working_date;
                  return isCurrentUser && isActive;
                });
              });

              // Суммируем часы из всех проектов за месяц
              const allHours = await Promise.all(
                employeeProjects.map(async (project: any) => {
                  try {
                    const response = await apiService.getWorkReports(project.id, employee.id, {
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
                    
                    // Фильтруем отчеты по месяцу
                    const monthReports = reports.filter((report) => {
                      if (!report.report_date) return false;
                      const reportDate = new Date(report.report_date);
                      return reportDate >= monthStart && reportDate <= monthEnd;
                    });
                    
                    // Суммируем часы
                    return monthReports.reduce((sum, report) => {
                      const hoursWorked = Number(report.hours_worked) || 0;
                      const isAbsent = report.absent === true || report.absent === 1 || report.absent === '1';
                      return sum + (isAbsent ? 0 : hoursWorked);
                    }, 0);
                  } catch (error) {
                    console.error(`Error loading work reports for project ${project.id}:`, error);
                    return 0;
                  }
                })
              );

              hours = allHours.reduce((sum, h) => sum + h, 0);
            } catch (error) {
              console.error('Error loading hours:', error);
            }

            // Берем данные из первой выплаты месяца (или объединяем все выплаты)
            const payment = firstPayment;
            
            const total = hours * rate;
            const firstAmount = payment.first_payment_amount || 0;
            const secondAmount = payment.second_payment_amount || 0;
            // Остаток рассчитывается автоматически: total - первая выплата - вторая выплата
            const balanceAmount = Math.max(0, total - firstAmount - secondAmount);

            return {
              month: getMonthName(paymentMonthDate),
              year: String(paymentMonthDate.getFullYear()),
              hours: hours,
              rate: rate,
              total: total,
              firstPayout: {
                amount: firstAmount,
                date: payment.first_payment_date ? formatDateForPayment(payment.first_payment_date) : '',
                method: payment.first_payment_type || 'Ожидание',
              },
              secondPayout: {
                amount: secondAmount,
                date: payment.second_payment_date ? formatDateForPayment(payment.second_payment_date) : '',
                method: payment.second_payment_type || 'Ожидание',
              },
              balance: {
                amount: balanceAmount,
                date: payment.third_payment_date ? formatDateForPayment(payment.third_payment_date) : '',
                method: payment.third_payment_type || 'Ожидание',
              },
            };
          })
        );

        // Сортируем по дате (от новых к старым)
        historyData.sort((a, b) => {
          const dateA = new Date(`${a.month} 1, ${a.year}`);
          const dateB = new Date(`${b.month} 1, ${b.year}`);
          return dateB.getTime() - dateA.getTime();
        });

        setSalaryHistory(historyData);
      } catch (error) {
        console.error('Error loading salary history:', error);
        setSalaryHistory([]);
      } finally {
        setIsLoadingSalary(false);
      }
    };

    loadSalaryHistory();
  }, [employee?.id, isNew, formData.dateFrom, formData.dateTo]);

  const totalPages = Math.ceil(salaryHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHistory = salaryHistory.slice(startIndex, endIndex);
  const paginationRef = useRef<HTMLDivElement>(null);

  // Убираем паддинги у компонента Pagination через useEffect
  useEffect(() => {
    if (paginationRef.current) {
      const paginationElement = paginationRef.current.querySelector('.pagination') as HTMLElement;
      if (paginationElement) {
        paginationElement.style.padding = '0';
        paginationElement.style.margin = '0';
      }
    }
  }, [currentPage]);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    const trimmedFirstName = formData.first_name.trim();
    const trimmedLastName = formData.last_name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();

    // Валидация только для создания нового сотрудника
    if (isNew) {
      // Обязательные поля (кроме должности)
      if (!trimmedLastName || !trimmedFirstName) {
        alert('Пожалуйста, заполните ФИО сотрудника');
        return;
      }

      if (!trimmedEmail) {
        alert('Пожалуйста, заполните email сотрудника');
        return;
      }

      if (!trimmedPhone) {
        alert('Пожалуйста, заполните телефон сотрудника');
        return;
      }

      if (!formData.password.trim()) {
        alert('Пожалуйста, заполните пароль сотрудника');
        return;
      }

      if (!formData.birth_date) {
        alert('Пожалуйста, заполните дату рождения сотрудника');
        return;
      }

      if (!formData.employment_date) {
        alert('Пожалуйста, заполните дату трудоустройства сотрудника');
        return;
      }

      if (!formData.work_schedule) {
        alert('Пожалуйста, выберите график работы сотрудника');
        return;
      }

      if (!formData.rate_per_hour || formData.rate_per_hour.trim() === '') {
        alert('Пожалуйста, заполните ставку в час сотрудника');
        return;
      }

      // Должность (position) - не обязательное поле, пропускаем проверку

      const employmentDateValue = formData.employment_date || new Date().toISOString().split('T')[0];
      const rateValue = formData.rate_per_hour ? Number(formData.rate_per_hour) : 0;

      setIsSaving(true);
      try {
        const payload = {
          first_name: trimmedFirstName,
          second_name: formData.second_name.trim(),
          last_name: trimmedLastName,
          birth_date: formData.birth_date,
          gender: formData.gender,
          email: trimmedEmail,
          phone: trimmedPhone,
          password: formData.password,
          role: formData.position && formData.position !== 'Не выбрано' ? formData.position : 'user',
          is_employee: true,
          is_system_admin: false,
          employment_date: employmentDateValue,
          position: formData.position && formData.position !== 'Не выбрано' ? formData.position : '',
          employee_status: formData.status === 'Работает' ? 'active' : 'dismissed',
          rate_per_hour: Number.isFinite(rateValue) ? rateValue : 0,
          work_schedule: formData.work_schedule === '5/2' ? '5/2' : formData.work_schedule,
        };

        const response = await apiService.registerEmployee(payload);
        const createdEmployee = response?.data ?? response;

        if (!createdEmployee) {
          throw new Error('Пустой ответ сервера');
        }

        // Если role === "user", отображаем "Не выбрано" (пустую строку)
        const createdPositionValue = (createdEmployee.role === 'user' || !createdEmployee.role) 
          ? '' 
          : (createdEmployee.role || createdEmployee.position || formData.position);
        
        setFormData({
          first_name: createdEmployee.first_name || '',
          last_name: createdEmployee.last_name || '',
          second_name: createdEmployee.second_name || '',
          phone: createdEmployee.phone || '',
          email: createdEmployee.email || '',
          position: createdPositionValue,
          work_schedule: mapWorkSchedule(createdEmployee.work_schedule),
          status: createdEmployee.is_dismissed ? 'Уволен' : 'Работает',
          rate_per_hour: createdEmployee.rate_per_hour ? String(createdEmployee.rate_per_hour) : '',
          password: '',
          birth_date: createdEmployee.birth_date || formData.birth_date,
          gender: createdEmployee.gender || formData.gender,
          employment_date: createdEmployee.employment_date || employmentDateValue,
          dateFrom: '',
          dateTo: '',
        });
        setIsPasswordVisible(false);
        setIsStatusDropdownOpen(false);
        setIsGenderDropdownOpen(false);
        setIsScheduleDropdownOpen(false);
        setIsPositionDropdownOpen(false);
        setIsDotsMenuOpen(false);
        onCreate?.(createdEmployee);
        return;
      } catch (error) {
        console.error('Error creating employee:', error);
      } finally {
        setIsSaving(false);
      }

      return;
    }

    const rateValue = formData.rate_per_hour ? Number(formData.rate_per_hour) : 0;

    // Проверка прав перед отправкой запроса (для редактирования)
    if (!isNew && !canEditEmployee()) {
      return;
    }

    setIsSaving(true);
    try {
      // Формируем payload для обновления (все поля необязательные)
      const payload: any = {};
      
      // Добавляем только непустые поля (чтобы не перезаписывать существующие данные пустыми значениями)
      if (trimmedFirstName) payload.first_name = trimmedFirstName;
      if (trimmedLastName) payload.last_name = trimmedLastName;
      const trimmedSecondName = formData.second_name.trim();
      if (trimmedSecondName) payload.second_name = trimmedSecondName;
      if (trimmedEmail) payload.email = trimmedEmail;
      if (trimmedPhone) payload.phone = trimmedPhone;
      if (formData.position && formData.position !== 'Не выбрано') {
        payload.role = formData.position;
        payload.position = formData.position;
      } else {
        // Если должность не выбрана, отправляем role: "user"
        payload.role = 'user';
        payload.position = '';
      }
      if (formData.work_schedule) {
        payload.work_schedule = formData.work_schedule === '5/2 ' ? '5/2' : formData.work_schedule;
      }
      if (formData.status) {
        payload.employee_status = formData.status === 'Работает' ? 'active' : 'dismissed';
        // Если статус "Уволен", устанавливаем is_dismissed и dismissal_date
        if (formData.status === 'Уволен') {
          const dismissalDate = new Date().toISOString().split('T')[0];
          payload.is_dismissed = true;
          payload.dismissal_date = dismissalDate;
          
          // Устанавливаем end_working_date во всех проектах
          await updateEmployeeEndDateInAllProjects(employee.id, dismissalDate);
        }
        // Если статус "Работает", всегда сбрасываем эти поля (независимо от текущего состояния)
        else if (formData.status === 'Работает') {
          payload.is_dismissed = false;
          // Отправляем null для сброса даты увольнения в БД
          payload.dismissal_date = null;
        }
      }
      // rate_per_hour может быть 0, поэтому проверяем на undefined/null
      if (formData.rate_per_hour !== '' && formData.rate_per_hour !== undefined && formData.rate_per_hour !== null) {
        if (Number.isFinite(rateValue)) {
          payload.rate_per_hour = rateValue;
        }
      }
      if (formData.birth_date) payload.birth_date = formData.birth_date;
      if (formData.gender) payload.gender = formData.gender;
      if (formData.employment_date) payload.employment_date = formData.employment_date;
      
      // Пароль обновляем только если он был введен
      if (formData.password && formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      // НЕ изменяем is_employee (тип пользователя) - это запрещено
      // Права на редактирование проверяются на бэкенде

      await apiService.updateUser(employee.id, payload);
      // Формируем обновленного сотрудника с учетом всех изменений
      const updatedEmployee = {
        ...employee,
        ...payload,
        // Убеждаемся, что статус правильно установлен
        is_dismissed: formData.status === 'Уволен' ? true : false,
        dismissal_date: formData.status === 'Уволен' ? payload.dismissal_date : null,
        employee_status: formData.status === 'Работает' ? 'active' : 'dismissed',
      };

      if (onSave) {
        onSave(updatedEmployee);
      }
      onBack();
    } catch (error: any) {
      console.error('Error updating employee:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    onBack();
  };

  const formatEmployeeName = () => {
    const firstName = formData.first_name || '';
    const lastName = formData.last_name || '';
    const secondName = formData.second_name || '';
    const fullName = `${lastName} ${firstName} ${secondName}`.trim();
    return fullName || 'Новый сотрудник';
  };

  // Функция для получения инициалов (Иван Иванов -> ИИ)
  const getInitials = () => {
    const firstInitial = formData.first_name ? formData.first_name.charAt(0).toUpperCase() : '';
    const lastInitial = formData.last_name ? formData.last_name.charAt(0).toUpperCase() : '';
    return (lastInitial + firstInitial) || 'Н';
  };

  // Функция для получения цвета фона на основе имени
  const getAvatarColor = (text: string) => {
    const colors = [
      '#2787f5', '#26ab69', '#ff9e00', '#f5222d', 
      '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Дата увольнения: если есть дата - показываем, если нет - "-"
  const dismissalDateDisplay = employee.dismissal_date 
    ? formatDate(employee.dismissal_date) 
    : '-';
  const employmentDateDisplay = formData.employment_date
    ? formatDate(formData.employment_date)
    : (employee.employment_date ? formatDate(employee.employment_date) : '-') || '-';

  return (
    <div className="employee-detail">
      <div className="employee-detail__content">
        {/* Верхняя часть - детали сотрудника */}
        <div className="employee-detail__card employee-detail__card--top">
          <div className="employee-detail__header">
            <div className="employee-detail__header-left">
              <div className="employee-detail__avatar">
                {employee.avatar_id || employee.avatar_url ? (
                  <img 
                    src={employee.avatar_url || `http://92.53.97.20/api/avatars/${employee.avatar_id}`} 
                    alt={formatEmployeeName()} 
                  />
                ) : (
                  <div 
                    className="employee-detail__avatar-initials"
                    style={{ backgroundColor: getAvatarColor(formatEmployeeName()) }}
                  >
                    {getInitials()}
                  </div>
                )}
              </div>
              <div className="employee-detail__info">
                <div className="employee-detail__name-row">
                  <h2 className="employee-detail__name">{formatEmployeeName()}</h2>
                  <div className="employee-detail__dates">
                    <p className="employee-detail__date">
                      Дата увольнения: {dismissalDateDisplay}
                    </p>
                    <p className="employee-detail__date">
                      Дата трудоустройства: {employmentDateDisplay}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {!isNew && (
              <div className="employee-detail__header-right">
                <div className="employee-detail__dots-menu-wrapper" ref={dotsMenuRef}>
                  <button 
                    className="employee-detail__icon-btn employee-detail__icon-btn--dots"
                    onClick={() => setIsDotsMenuOpen(!isDotsMenuOpen)}
                  >
                    <img src={dotsIcon} alt="Меню" />
                  </button>
                  {isDotsMenuOpen && (
                    <div className="employee-detail__dots-menu">
                      <button 
                        className="employee-detail__dots-menu-item"
                        onClick={async () => {
                          setIsDotsMenuOpen(false);
                          
                          if (!confirm('Вы уверены, что хотите уволить этого сотрудника?')) {
                            return;
                          }

                          try {
                            const dismissalDate = new Date().toISOString().split('T')[0];
                            const payload = {
                              is_dismissed: true,
                              dismissal_date: dismissalDate,
                              employee_status: 'dismissed',
                            };

                            // Устанавливаем end_working_date во всех проектах
                            await updateEmployeeEndDateInAllProjects(employee.id, dismissalDate);

                            const response = await apiService.updateUser(employee.id, payload);
                            const updatedEmployee = response?.data ?? response ?? { ...employee, ...payload };

                            // Обновляем форму
                            setFormData({
                              ...formData,
                              status: 'Уволен',
                            });

                            if (onSave) {
                              onSave(updatedEmployee);
                            }
                          } catch (error: any) {
                            console.error('Error dismissing employee:', error);
                          }
                        }}
                      >
                        Уволить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="employee-detail__fields">
            <div className="employee-detail__fields-row">
              <TextInput
                label="Имя"
                value={formData.first_name}
                onChange={(v) => setFormData({ ...formData, first_name: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
              <TextInput
                label="Фамилия"
                value={formData.last_name}
                onChange={(v) => setFormData({ ...formData, last_name: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
              <TextInput
                label="Отчество"
                value={formData.second_name}
                onChange={(v) => setFormData({ ...formData, second_name: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
              <TextInput
                label="Номер телефона"
                value={formData.phone}
                onChange={(v) => setFormData({ ...formData, phone: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
              <TextInput
                label="Электронная почта"
                value={formData.email}
                onChange={(v) => setFormData({ ...formData, email: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
            </div>

            <div className="employee-detail__fields-row">
              <div className="employee-detail__dropdown-field" ref={positionDropdownRef}>
                <label className="employee-detail__field-label">Должность</label>
                <div 
                  className="employee-detail__dropdown"
                  onClick={() => setIsPositionDropdownOpen(!isPositionDropdownOpen)}
                >
                  <span>{formData.position || 'Не выбрано'}</span>
                  <img src={userDropdownIcon} alt="▼" />
                </div>
                {isPositionDropdownOpen && (
                  <div className="employee-detail__dropdown-menu">
                    {positionOptions.map((option) => (
                      <div
                        key={option}
                        className={`employee-detail__dropdown-option ${(formData.position === option) || (!formData.position && option === 'Не выбрано') ? 'employee-detail__dropdown-option--selected' : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, position: option === 'Не выбрано' ? '' : option });
                          setIsPositionDropdownOpen(false);
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="employee-detail__dropdown-field" ref={scheduleDropdownRef}>
                <label className="employee-detail__field-label">График работы</label>
                <div 
                  className="employee-detail__dropdown"
                  onClick={() => setIsScheduleDropdownOpen(!isScheduleDropdownOpen)}
                >
                  <span>{formData.work_schedule || '5/2'}</span>
                  <img src={userDropdownIcon} alt="▼" />
                </div>
                {isScheduleDropdownOpen && (
                  <div className="employee-detail__dropdown-menu">
                    {scheduleOptions.map((option) => (
                      <div
                        key={option}
                        className={`employee-detail__dropdown-option ${formData.work_schedule === option ? 'employee-detail__dropdown-option--selected' : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, work_schedule: option });
                          setIsScheduleDropdownOpen(false);
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="employee-detail__dropdown-field" ref={statusDropdownRef}>
                <label className="employee-detail__field-label">Статус</label>
                <div 
                  className="employee-detail__dropdown"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                >
                  <span>{formData.status}</span>
                  <img src={userDropdownIcon} alt="▼" />
                </div>
                {isStatusDropdownOpen && (
                  <div className="employee-detail__dropdown-menu">
                    {statusOptions.map((option) => (
                      <div
                        key={option}
                        className={`employee-detail__dropdown-option ${formData.status === option ? 'employee-detail__dropdown-option--selected' : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, status: option });
                          setIsStatusDropdownOpen(false);
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="employee-detail__password-field">
                <label className="employee-detail__field-label">Пароль</label>
                <TextInput
                  value={formData.password}
                  onChange={(v) => setFormData({ ...formData, password: v })}
                  type={isPasswordVisible ? 'text' : 'password'}
                  showPasswordToggle={true}
                  isPasswordVisible={isPasswordVisible}
                  onTogglePassword={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="employee-detail__password-input"
                  fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
                />
              </div>
            </div>

            {isNew && (
              <div className="employee-detail__fields-row">
                <div className="employee-detail__date-field">
                  <label className="employee-detail__field-label">Дата рождения</label>
                  <input
                    type="date"
                    className="employee-detail__date-field-input"
                    value={formData.birth_date || ''}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  />
                </div>
                <div className="employee-detail__dropdown-field employee-detail__dropdown-field--third" ref={genderDropdownRef}>
                  <label className="employee-detail__field-label">Пол</label>
                  <div
                    className="employee-detail__dropdown"
                    onClick={() => setIsGenderDropdownOpen(!isGenderDropdownOpen)}
                  >
                    <span>{genderOptions.find((option) => option.value === formData.gender)?.label || 'Мужской'}</span>
                    <img src={userDropdownIcon} alt="▼" />
                  </div>
                  {isGenderDropdownOpen && (
                    <div className="employee-detail__dropdown-menu">
                      {genderOptions.map((option) => (
                        <div
                          key={option.value}
                          className={`employee-detail__dropdown-option ${formData.gender === option.value ? 'employee-detail__dropdown-option--selected' : ''}`}
                          onClick={() => {
                            setFormData({ ...formData, gender: option.value });
                            setIsGenderDropdownOpen(false);
                          }}
                        >
                          {option.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="employee-detail__finances">
            <h3 className="employee-detail__finances-title">Финансы</h3>
            <TextInput
              label="Ставка, руб/час"
              value={formData.rate_per_hour}
              onChange={(v) => setFormData({ ...formData, rate_per_hour: v })}
              className="employee-detail__rate-input"
              fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
            />
          </div>

          <div className="employee-detail__actions">
            <Button
              text="Отмена"
              className="employee-detail__cancel-btn"
              onClick={handleCancel}
            />
            <Button
              text={isSaving ? 'Сохранение...' : isNew ? 'Создать' : 'Сохранить'}
              className="employee-detail__save-btn"
              disabled={isSaving}
              onClick={() => {
                void handleSave();
              }}
            />
          </div>
        </div>

        {/* Нижняя часть - история выплат ЗП */}
        <div className="employee-detail__card employee-detail__card--bottom">
          <div className="employee-detail__salary-header">
            <h3 className="employee-detail__salary-title">Выдача ЗП</h3>
            <div className="employee-detail__date-range">
              <div className="employee-detail__date-range-left">
                <img src={calendarIconGrey} alt="Календарь" />
                <div 
                  className="employee-detail__date-input-wrapper"
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
                    className="employee-detail__date-input"
                    value={formData.dateFrom || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, dateFrom: e.target.value });
                      setCurrentPage(1); // Сбрасываем страницу при изменении фильтра
                    }}
                  />
                  {formData.dateFrom ? (
                    <span className="employee-detail__date-display">
                      {formatDate(formData.dateFrom) || formData.dateFrom.split('T')[0]}
                    </span>
                  ) : (
                    <span className="employee-detail__date-placeholder">С ...</span>
                  )}
                </div>
              </div>
              <div className="employee-detail__date-range-divider"></div>
              <div className="employee-detail__date-range-right">
                <div 
                  className="employee-detail__date-input-wrapper"
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
                    className="employee-detail__date-input"
                    value={formData.dateTo || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, dateTo: e.target.value });
                      setCurrentPage(1); // Сбрасываем страницу при изменении фильтра
                    }}
                  />
                  {formData.dateTo ? (
                    <span className="employee-detail__date-display">
                      {formatDate(formData.dateTo) || formData.dateTo.split('T')[0]}
                    </span>
                  ) : (
                    <span className="employee-detail__date-placeholder">По ...</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="employee-detail__salary-table">
            <div className="employee-detail__salary-table-header">
              <div className="employee-detail__salary-table-header-col">
                <input type="checkbox" />
                <span>Месяц</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Кол-во часов</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Ставка, ₽/час</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Всего</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>1-я выплата</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Способ</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>2-я выплата</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Способ</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Остаток</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Способ</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
            </div>

            <div className="employee-detail__salary-table-body">
              {isLoadingSalary ? (
                <div className="employee-detail__salary-loading">Загрузка...</div>
              ) : paginatedHistory.length === 0 ? (
                <div className="employee-detail__salary-empty">Нет данных для отображения</div>
              ) : (
                paginatedHistory.map((item, index) => (
                  <div key={index} className="employee-detail__salary-table-row">
                    <div className="employee-detail__salary-table-col">
                      <input type="checkbox" />
                      <div className="employee-detail__month">
                        <span className="employee-detail__month-name">{item.month}</span>
                        <span className="employee-detail__month-year">{item.year}</span>
                      </div>
                    </div>
                    <div className="employee-detail__salary-table-col">
                      <span>{item.hours}</span>
                    </div>
                    <div className="employee-detail__salary-table-col">
                      <span>{formatCurrency(item.rate)}</span>
                    </div>
                    <div className="employee-detail__salary-table-col">
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                    <div className="employee-detail__salary-table-col">
                      {item.firstPayout.amount > 0 ? (
                        <div className="employee-detail__payout">
                          <span className="employee-detail__payout-amount">{formatCurrency(item.firstPayout.amount)}</span>
                          <span className="employee-detail__payout-date">{item.firstPayout.date}</span>
                        </div>
                      ) : (
                        <div className="employee-detail__payment-pending">Ожидание...</div>
                      )}
                    </div>
                    <div className="employee-detail__salary-table-col">
                      <span>{item.firstPayout.method}</span>
                    </div>
                    <div className="employee-detail__salary-table-col">
                      {item.secondPayout.amount > 0 ? (
                        <div className="employee-detail__payout">
                          <span className="employee-detail__payout-amount">{formatCurrency(item.secondPayout.amount)}</span>
                          <span className="employee-detail__payout-date">{item.secondPayout.date}</span>
                        </div>
                      ) : (
                        <div className="employee-detail__payment-pending">Ожидание...</div>
                      )}
                    </div>
                    <div className="employee-detail__salary-table-col">
                      <span>{item.secondPayout.method}</span>
                    </div>
                    <div className="employee-detail__salary-table-col">
                      {item.balance.amount > 0 ? (
                        <div className="employee-detail__payout">
                          <span className="employee-detail__payout-amount">{formatCurrency(item.balance.amount)}</span>
                          <span className="employee-detail__payout-date">{item.balance.date}</span>
                        </div>
                      ) : (
                        <div className="employee-detail__payment-pending">Ожидание...</div>
                      )}
                    </div>
                    <div className="employee-detail__salary-table-col">
                      <span>{item.balance.method}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="employee-detail__salary-pagination">
              <div className="employee-detail__pagination-override" ref={paginationRef}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

