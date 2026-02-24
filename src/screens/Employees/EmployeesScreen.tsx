import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../services/api';
import sotrudnikiIconGrey from '../../shared/icons/sotrudnikiIconGrey.svg';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import searchIcon from '../../shared/icons/searchIcon.svg';
import { Pagination } from '../../shared/ui/Pagination/Pagination';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import userDropdownIcon from '../../shared/icons/user-dropdown-icon.svg';
import { EmployeeDetail } from './EmployeeDetail';
import './employees.scss';

type EmployeeHistoryEntry = number | 'new' | null;

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

export const EmployeesScreen: React.FC = () => {
  // Состояние для выбранного сотрудника
  // При перезагрузке страницы восстанавливаем из sessionStorage (если есть)
  // При переключении вкладок localStorage будет очищен, поэтому карточка не откроется
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(() => {
    // Сначала проверяем sessionStorage (для перезагрузки страницы)
    const savedFromSession = sessionStorage.getItem('savedEmployeeId');
    if (savedFromSession) {
      return parseInt(savedFromSession, 10);
    }
    // Затем проверяем localStorage (для обычной навигации)
    const saved = localStorage.getItem('selectedEmployeeId');
    return saved ? parseInt(saved, 10) : null;
  });
  const [navigationHistory, setNavigationHistory] = useState<EmployeeHistoryEntry[]>(() => {
    const savedFromSession = sessionStorage.getItem('savedEmployeeId');
    const savedId = savedFromSession ? parseInt(savedFromSession, 10) : (localStorage.getItem('selectedEmployeeId') ? parseInt(localStorage.getItem('selectedEmployeeId')!, 10) : null);
    return savedId ? [null, savedId] : [null];
  });
  const [historyIndex, setHistoryIndex] = useState(() => {
    const savedFromSession = sessionStorage.getItem('savedEmployeeId');
    const saved = savedFromSession || localStorage.getItem('selectedEmployeeId');
    return saved ? 1 : 0;
  });
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [draftEmployee, setDraftEmployee] = useState<any | null>(null);
  
  // Состояние для сортировки
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Загружаем сотрудников
  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoading(true);
      try {
        const response = await apiService.getUsers();
        
        // Фильтруем только сотрудников (is_employee = true)
        const employeesData = response && response.data 
          ? (Array.isArray(response.data) ? response.data : [response.data])
          : (Array.isArray(response) ? response : []);
        
        const filteredEmployees = employeesData.filter((user: any) => user.is_employee === true);
        setEmployees(filteredEmployees);
      } catch (error) {
        console.error('Error fetching employees:', error);
        setEmployees([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const createEmptyEmployeeDraft = () => ({
    id: null,
    first_name: '',
    last_name: '',
    second_name: '',
    phone: '',
    email: '',
    role: '',
    work_schedule: '5/2',
    is_dismissed: false,
    employee_status: 'active',
    rate_per_hour: '',
    birth_date: '',
    gender: 'male',
    employment_date: new Date().toISOString().split('T')[0],
  });

  const startEmployeeCreation = () => {
    const draft = createEmptyEmployeeDraft();
    setIsCreatingEmployee(true);
    setDraftEmployee(draft);
    setSelectedEmployeeId(null);
    setSelectedEmployeeIds(new Set());
    localStorage.removeItem('selectedEmployeeId');
  };

  const exitCreationToList = () => {
    setIsCreatingEmployee(false);
    setDraftEmployee(null);
    setSelectedEmployeeId(null);
    setNavigationHistory((prevHistory) => {
      const updated = [...prevHistory];
      if (historyIndex >= 0 && historyIndex < updated.length) {
        updated[historyIndex] = null;
      } else {
        updated.push(null);
      }
      const newIndex = Math.min(historyIndex, updated.length - 1);
      setHistoryIndex(newIndex);
      return updated;
    });
    localStorage.removeItem('selectedEmployeeId');
  };

  // Фильтрация сотрудников
  const filteredEmployees = employees.filter((employee) => {
    // Фильтр по статусу
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'Работает') {
      matchesStatus = !employee.is_dismissed;
    } else if (statusFilter === 'Уволен') {
      matchesStatus = employee.is_dismissed === true;
    }

    // Фильтр по должности
    let matchesPosition = true;
    if (positionFilter !== 'all') {
      // Если роль "user", считаем что должность "Не выбрано"
      const position = (employee.role === 'user' || !employee.role) ? '' : (employee.role || '');
      const filterLower = positionFilter.toLowerCase().trim();
      const positionLower = position.toLowerCase().trim();
      
      // Точное совпадение
      if (positionLower === filterLower) {
        matchesPosition = true;
      }
      // Для "Главный инженер проекта" проверяем различные варианты написания
      else if (filterLower === 'главный инженер проекта') {
        matchesPosition = positionLower.includes('главный') && 
                         positionLower.includes('инженер') && 
                         (positionLower.includes('проекта') || positionLower.includes('гип'));
      }
      // Для остальных должностей - частичное совпадение
      else {
        matchesPosition = positionLower.includes(filterLower);
      }
    }

    // Фильтр по поиску
    let matchesSearch = true;
    if (searchValue.trim()) {
      const searchLower = searchValue.toLowerCase().trim();
      const fullName = `${employee.last_name || ''} ${employee.first_name || ''} ${employee.second_name || ''}`.toLowerCase();
      const email = (employee.email || '').toLowerCase();
      const phone = (employee.phone || '').toLowerCase();
      const id = employee.id.toString();
      
      matchesSearch = fullName.includes(searchLower) || 
                      email.includes(searchLower) || 
                      phone.includes(searchLower) ||
                      id.includes(searchLower);
    }

    return matchesStatus && matchesPosition && matchesSearch;
  });

  // Функция сортировки
  const getSortedEmployees = () => {
    const sorted = [...filteredEmployees];
    
    sorted.sort((a: any, b: any) => {
      if (sortField === null) {
        // По умолчанию сначала работающие, потом уволенные
        // Внутри каждой группы сортируем по ID по убыванию
        const aIsDismissed = a.is_dismissed === true;
        const bIsDismissed = b.is_dismissed === true;
        
        // Если статусы разные, работающие идут первыми
        if (aIsDismissed !== bIsDismissed) {
          return aIsDismissed ? 1 : -1; // Работающие (false) идут первыми
        }
        
        // Если статусы одинаковые, сортируем по ID по убыванию
        const aValue = a.id || 0;
        const bValue = b.id || 0;
        return bValue - aValue;
      }
      
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'id':
          aValue = a.id || 0;
          bValue = b.id || 0;
          return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
          
        case 'name':
          const aFullName = `${a.last_name || ''} ${a.first_name || ''} ${a.second_name || ''}`.toLowerCase();
          const bFullName = `${b.last_name || ''} ${b.first_name || ''} ${b.second_name || ''}`.toLowerCase();
          if (sortDirection === 'desc') {
            return bFullName.localeCompare(aFullName, 'ru');
          } else {
            return aFullName.localeCompare(bFullName, 'ru');
          }
          
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
          if (sortDirection === 'desc') {
            return bValue.localeCompare(aValue, 'ru');
          } else {
            return aValue.localeCompare(bValue, 'ru');
          }
          
        case 'status':
          const aStatus = a.is_dismissed ? 'Уволен' : 'Работает';
          const bStatus = b.is_dismissed ? 'Уволен' : 'Работает';
          if (sortDirection === 'desc') {
            return bStatus.localeCompare(aStatus, 'ru');
          } else {
            return aStatus.localeCompare(bStatus, 'ru');
          }
          
        case 'employment_date':
          aValue = a.employment_date ? new Date(a.employment_date).getTime() : 0;
          bValue = b.employment_date ? new Date(b.employment_date).getTime() : 0;
          return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
          
        default:
          return 0;
      }
    });
    
    return sorted;
  };

  const sortedEmployees = getSortedEmployees();

  // Пагинация
  const totalPages = Math.ceil(sortedEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmployees = sortedEmployees.slice(startIndex, endIndex);

  // Функция для навигации с сохранением истории
  const navigateToEmployee = (entry: EmployeeHistoryEntry) => {
    const newHistory = navigationHistory.slice(0, historyIndex + 1);
    newHistory.push(entry);
    setNavigationHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    if (entry === 'new') {
      startEmployeeCreation();
      return;
    }

    setIsCreatingEmployee(false);
    setDraftEmployee(null);
    setSelectedEmployeeId(entry ?? null);

    if (typeof entry === 'number' && entry) {
      localStorage.setItem('selectedEmployeeId', entry.toString());
    } else {
      localStorage.removeItem('selectedEmployeeId');
    }
  };

  // Обработчик клика на строку таблицы
  const handleRowClick = (employeeId: number, event: React.MouseEvent) => {
    // Не переходим к детальному виду, если клик был по чекбоксу
    if ((event.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    navigateToEmployee(employeeId);
  };

  // Обработчик возврата к списку
  const handleBackToList = () => {
    if (isCreatingEmployee) {
      exitCreationToList();
    } else {
      navigateToEmployee(null);
    }
  };

  // Обработчик навигации назад
  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevEntry = navigationHistory[newIndex];

      if (prevEntry === 'new') {
        startEmployeeCreation();
      } else {
        setIsCreatingEmployee(false);
        setDraftEmployee(null);
        setSelectedEmployeeId(prevEntry ?? null);

        if (typeof prevEntry === 'number' && prevEntry) {
          localStorage.setItem('selectedEmployeeId', prevEntry.toString());
        } else {
          localStorage.removeItem('selectedEmployeeId');
        }
      }
    }
  };

  // Обработчик навигации вперед
  const handleForward = () => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextEntry = navigationHistory[newIndex];

      if (nextEntry === 'new') {
        startEmployeeCreation();
      } else {
        setIsCreatingEmployee(false);
        setDraftEmployee(null);
        setSelectedEmployeeId(nextEntry ?? null);

        if (typeof nextEntry === 'number' && nextEntry) {
          localStorage.setItem('selectedEmployeeId', nextEntry.toString());
        } else {
          localStorage.removeItem('selectedEmployeeId');
        }
      }
    }
  };

  // Получаем выбранного сотрудника
  const selectedEmployeeData = selectedEmployeeId && !isLoading
    ? employees.find((emp) => emp.id === selectedEmployeeId)
    : null;

  const detailEmployee = isCreatingEmployee ? draftEmployee : selectedEmployeeData;
 
  // Обработчик сортировки
  const handleSort = (field: string | null) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      if (field === 'name' || field === 'email' || field === 'status') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
    }
  };

  // Обработчик выбора сотрудника
  const handleEmployeeSelect = (employeeId: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedEmployeeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  // Обработчик выбора всех сотрудников
  const handleSelectAll = (event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    const nonDismissedIds = sortedEmployees
      .filter(emp => !emp.is_dismissed)
      .map(emp => emp.id);
    
    if (selectedEmployeeIds.size === nonDismissedIds.length && nonDismissedIds.length > 0) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(nonDismissedIds));
    }
  };

  // Функция форматирования имени
  const formatEmployeeName = (employee: any) => {
    if (!employee) return '';
    const firstName = employee.first_name || '';
    const lastName = employee.last_name || '';
    const secondName = employee.second_name || '';
    const fullName = `${lastName} ${firstName} ${secondName}`.trim();
    return fullName || 'Новый сотрудник';
  };

  // Функция форматирования даты
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return null;
    }
  };

  // Список всех должностей для фильтра
  const allPositions = [
    'Главный инженер проекта',
    'Бухгалтер',
    'Бригадир',
    'Сметчик'
  ];

  // Обработчик фильтра по должности
  const [isPositionDropdownOpen, setIsPositionDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const positionDropdownRef = useRef<HTMLDivElement>(null);

  // Закрытие дропдаунов при клике вне их
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (positionDropdownRef.current && !positionDropdownRef.current.contains(event.target as Node)) {
        setIsPositionDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="employees">
      <PageHeader
        categoryIcon={!detailEmployee ? sotrudnikiIconGrey : undefined}
        categoryLabel={!detailEmployee ? "Сотрудники" : undefined}
        breadcrumb={detailEmployee ? [
          { icon: sotrudnikiIconGrey, label: "Сотрудники", onClick: () => navigateToEmployee(null) },
          { label: formatEmployeeName(detailEmployee) }
        ] : undefined}
        showPagination={true}
        onBack={handleBack}
        onForward={handleForward}
        backDisabled={historyIndex === 0}
        forwardDisabled={historyIndex === navigationHistory.length - 1}
        createButtonText={!detailEmployee ? "Добавить" : undefined}
        onCreate={!detailEmployee ? () => navigateToEmployee('new') : undefined}
        userName="Гиламанов Т.Р."
      />

      {/* Если выбран сотрудник и данные загружены, показываем детальный вид */}
      {(detailEmployee && (isCreatingEmployee || !isLoading)) ? (
        <EmployeeDetail
          employee={detailEmployee}
          onBack={handleBackToList}
          onSave={(updatedEmployee) => {
            // Обновляем данные сотрудника в списке
            setEmployees((prev) =>
              prev.map((emp) => {
                if (emp.id === updatedEmployee.id) {
                  // Объединяем старые данные с новыми, чтобы не потерять поля
                  return { ...emp, ...updatedEmployee };
                }
                return emp;
              })
            );
            // Данные selectedEmployeeData обновятся автоматически через employees.find в следующем рендере
          }}
          onCreate={async (createdEmployee) => {
            if (!createdEmployee || !createdEmployee.id) {
              exitCreationToList();
              return;
            }

            // Оптимистично добавляем сотрудника в список
            setEmployees((prev) => {
              const filtered = prev.filter((emp) => emp.id !== createdEmployee.id);
              return [createdEmployee, ...filtered];
            });

            // Сразу возвращаемся к таблице — пользователь видит обновлённый список
            exitCreationToList();

            // Перезагружаем список с сервера для синхронизации
            try {
              const response = await apiService.getUsers();
              const employeesData = response && response.data
                ? (Array.isArray(response.data) ? response.data : [response.data])
                : (Array.isArray(response) ? response : []);
              const filteredEmployees = employeesData.filter((user: any) => user.is_employee === true);
              setEmployees(filteredEmployees);
            } catch (error) {
              console.error('Error refreshing employees list:', error);
            }
          }}
          isNew={isCreatingEmployee}
        />
      ) : (
      
      <div className="employees__content">
        {/* Верхняя панель с фильтрами */}
        <div className="employees__toolbar">
          <div className="employees__filters">
            {/* Фильтр по статусу сотрудников */}
            <div className="employees__status-filter" ref={statusDropdownRef}>
              <button
                className="employees__status-filter-trigger"
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              >
                <span>
                  {statusFilter === 'all' ? 'Все статусы' : statusFilter === 'Работает' ? 'Работает' : 'Уволен'}
                </span>
                <img src={userDropdownIcon} alt="▼" />
              </button>
              {isStatusDropdownOpen && (
                <div className="employees__status-filter-dropdown">
                  <div
                    className={`employees__status-filter-option ${statusFilter === 'all' ? 'employees__status-filter-option--selected' : ''}`}
                    onClick={() => {
                      setStatusFilter('all');
                      setIsStatusDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                  >
                    Все статусы
                  </div>
                  <div
                    className={`employees__status-filter-option ${statusFilter === 'Работает' ? 'employees__status-filter-option--selected' : ''}`}
                    onClick={() => {
                      setStatusFilter('Работает');
                      setIsStatusDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                  >
                    Работает
                  </div>
                  <div
                    className={`employees__status-filter-option ${statusFilter === 'Уволен' ? 'employees__status-filter-option--selected' : ''}`}
                    onClick={() => {
                      setStatusFilter('Уволен');
                      setIsStatusDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                  >
                    Уволен
                  </div>
                </div>
              )}
            </div>
            
            {/* Фильтр по должности */}
            <div className="employees__position-filter" ref={positionDropdownRef}>
              <button
                className="employees__position-filter-trigger"
                onClick={() => setIsPositionDropdownOpen(!isPositionDropdownOpen)}
              >
                <span>{positionFilter === 'all' ? 'Должность' : positionFilter}</span>
                <img src={userDropdownIcon} alt="▼" />
              </button>
              {isPositionDropdownOpen && (
                <div className="employees__position-filter-dropdown">
                  <div
                    className={`employees__position-filter-option ${positionFilter === 'all' ? 'employees__position-filter-option--selected' : ''}`}
                    onClick={() => {
                      setPositionFilter('all');
                      setIsPositionDropdownOpen(false);
                      setCurrentPage(1);
                    }}
                  >
                    Все должности
                  </div>
                  {allPositions.map((position: string) => (
                    <div
                      key={position}
                      className={`employees__position-filter-option ${positionFilter === position ? 'employees__position-filter-option--selected' : ''}`}
                      onClick={() => {
                        setPositionFilter(position);
                        setIsPositionDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                    >
                      {position}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="employees__search">
              <img src={searchIcon} alt="Поиск" className="employees__search-icon" />
              <input
                type="text"
                className="employees__search-input"
                placeholder="Поиск"
                value={searchValue}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          <button 
            className="employees__dismiss-btn"
            onClick={async () => {
              if (selectedEmployeeIds.size === 0) {
                return;
              }

              const confirmMessage = `Вы уверены, что хотите уволить ${selectedEmployeeIds.size} ${selectedEmployeeIds.size === 1 ? 'сотрудника' : 'сотрудников'}?`;
              if (!confirm(confirmMessage)) {
                return;
              }

              try {
                const dismissalDate = new Date().toISOString().split('T')[0];
                
                // Сначала обновляем end_working_date во всех проектах для всех увольняемых сотрудников
                const updateProjectsPromises = Array.from(selectedEmployeeIds).map((employeeId) =>
                  updateEmployeeEndDateInAllProjects(employeeId, dismissalDate)
                );
                await Promise.all(updateProjectsPromises);
                
                // Затем обновляем данные сотрудников
                const dismissPromises = Array.from(selectedEmployeeIds).map(async (employeeId) => {
                  const payload = {
                    is_dismissed: true,
                    dismissal_date: dismissalDate,
                    employee_status: 'dismissed',
                  };
                  return apiService.updateUser(employeeId, payload);
                });

                await Promise.all(dismissPromises);

                // Обновляем список сотрудников
                const updatedEmployees = employees.map((emp) => {
                  if (selectedEmployeeIds.has(emp.id)) {
                    return {
                      ...emp,
                      is_dismissed: true,
                      dismissal_date: new Date().toISOString().split('T')[0],
                      employee_status: 'dismissed',
                    };
                  }
                  return emp;
                });
                setEmployees(updatedEmployees);

                // Очищаем выбор
                setSelectedEmployeeIds(new Set());
              } catch (error: any) {
                console.error('Error dismissing employees:', error);
              }
            }}
          >
            Уволить
          </button>
        </div>

        {/* Таблица */}
        <div className="employees__table">
          {/* Заголовок таблицы */}
          <div className="employees__table-header">
            <div 
              className="employees__table-header-col employees__table-header-col--id"
              onClick={(e) => {
                // Не сортируем, если клик был на чекбокс
                if ((e.target as HTMLElement).tagName === 'INPUT') {
                  return;
                }
                e.stopPropagation();
                handleSort('id');
              }}
              style={{ cursor: 'pointer' }}
            >
              <input 
                type="checkbox" 
                className="employees__checkbox"
                checked={(() => {
                  const nonDismissed = sortedEmployees.filter(emp => !emp.is_dismissed);
                  return nonDismissed.length > 0 && 
                         nonDismissed.every(emp => selectedEmployeeIds.has(emp.id));
                })()}
                onChange={(e) => {
                  e.stopPropagation();
                  handleSelectAll(e as any);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <span>ID</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'id' ? 'employees__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="employees__table-header-col employees__table-header-col--name"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('name');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Сотрудник</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'name' ? 'employees__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="employees__table-header-col employees__table-header-col--email"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('email');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Электронная почта</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'email' ? 'employees__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="employees__table-header-col employees__table-header-col--status"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('status');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Статус</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'status' ? 'employees__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="employees__table-header-col employees__table-header-col--date"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('employment_date');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Дата трудоустройства</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'employment_date' ? 'employees__sort-icon--active' : ''}`}
              />
            </div>
          </div>

          {/* Строки таблицы */}
          <div className="employees__table-body">
          {isLoading ? (
            <div className="employees__loading">Загрузка...</div>
          ) : paginatedEmployees.length === 0 ? (
            <div className="employees__empty">
              {employees.length === 0 ? 'Нет сотрудников' : 'Нет сотрудников с такими параметрами'}
            </div>
          ) : (
            paginatedEmployees.map((employee) => {
              const isDismissed = employee.is_dismissed === true;
              const isSelected = selectedEmployeeIds.has(employee.id);
              
              return (
                <div 
                  key={employee.id}
                  className={`employees__table-row ${isSelected ? 'employees__table-row--selected' : ''} ${isDismissed ? 'employees__table-row--dismissed' : ''}`}
                  onClick={(e) => handleRowClick(employee.id, e)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="employees__table-row-col employees__table-row-col--id">
                    <input 
                      type="checkbox" 
                      className="employees__checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (!isDismissed) {
                          handleEmployeeSelect(employee.id, e as any);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isDismissed}
                      style={{ cursor: isDismissed ? 'not-allowed' : 'pointer' }}
                    />
                    <span>{employee.id}</span>
                  </div>
                  <div className="employees__table-row-col employees__table-row-col--name">
                    <div className="employees__employee-info">
                      <div className="employees__employee-details">
                        {employee.phone && (
                          <span className="employees__employee-phone">{employee.phone}</span>
                        )}
                        {employee.phone && employee.role && ' · '}
                        {employee.role && employee.role !== 'user' && (
                          <span className="employees__employee-position">{employee.role}</span>
                        )}
                        {employee.role === 'user' && (
                          <span className="employees__employee-position">Не выбрано</span>
                        )}
                      </div>
                      <div className="employees__employee-name">
                        {(() => {
                          const firstName = employee.first_name || '';
                          const lastName = employee.last_name || '';
                          return `${lastName} ${firstName}`.trim();
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="employees__table-row-col employees__table-row-col--email">
                    <span>{employee.email || '—'}</span>
                  </div>
                  <div className="employees__table-row-col employees__table-row-col--status">
                    <div className="employees__status">
                      {isDismissed ? (
                        <>
                          <span className="employees__status-text employees__status-text--dismissed">Уволен</span>
                          {employee.is_dismissed && employee.dismissal_date && (
                            <span className="employees__status-date">{formatDate(employee.dismissal_date)}</span>
                          )}
                        </>
                      ) : (
                        <span className="employees__status-text employees__status-text--active">Работает</span>
                      )}
                    </div>
                  </div>
                  <div className="employees__table-row-col employees__table-row-col--date">
                    <span>{formatDate(employee.employment_date) || '—'}</span>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="employees__pagination">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
};