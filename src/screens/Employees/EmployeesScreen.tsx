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

export const EmployeesScreen: React.FC = () => {
  // Состояние для выбранного сотрудника
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedEmployeeId');
    return saved ? parseInt(saved, 10) : null;
  });
  const [navigationHistory, setNavigationHistory] = useState<(number | null)[]>(() => {
    const saved = localStorage.getItem('selectedEmployeeId');
    const savedId = saved ? parseInt(saved, 10) : null;
    return savedId ? [null, savedId] : [null];
  });
  const [historyIndex, setHistoryIndex] = useState(() => {
    const saved = localStorage.getItem('selectedEmployeeId');
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

  // Фильтрация сотрудников
  const filteredEmployees = employees.filter((employee) => {
    // Фильтр по статусу
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'Работает') {
      matchesStatus = !employee.is_dismissed && employee.employee_status === 'active';
    } else if (statusFilter === 'Уволен') {
      matchesStatus = employee.is_dismissed || employee.employee_status === 'dismissed' || employee.dismissal_date;
    }

    // Фильтр по должности
    let matchesPosition = true;
    if (positionFilter !== 'all') {
      const position = employee.role || '';
      matchesPosition = position.toLowerCase().includes(positionFilter.toLowerCase());
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
        // По умолчанию сортируем по ID по убыванию
        const aValue = a.id || 0;
        const bValue = b.id || 0;
        return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
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
          const aStatus = a.is_dismissed || a.employee_status === 'dismissed' ? 'Уволен' : 'Работает';
          const bStatus = b.is_dismissed || b.employee_status === 'dismissed' ? 'Уволен' : 'Работает';
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
  const navigateToEmployee = (employeeId: number | null) => {
    const newHistory = navigationHistory.slice(0, historyIndex + 1);
    newHistory.push(employeeId);
    setNavigationHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSelectedEmployeeId(employeeId);
    
    // Сохраняем selectedEmployeeId в localStorage
    if (employeeId) {
      localStorage.setItem('selectedEmployeeId', employeeId.toString());
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
    navigateToEmployee(null);
  };

  // Обработчик навигации назад
  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevEmployeeId = navigationHistory[newIndex];
      setSelectedEmployeeId(prevEmployeeId);
      
      // Сохраняем selectedEmployeeId в localStorage
      if (prevEmployeeId) {
        localStorage.setItem('selectedEmployeeId', prevEmployeeId.toString());
      } else {
        localStorage.removeItem('selectedEmployeeId');
      }
    }
  };

  // Обработчик навигации вперед
  const handleForward = () => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextEmployeeId = navigationHistory[newIndex];
      setSelectedEmployeeId(nextEmployeeId);
      
      // Сохраняем selectedEmployeeId в localStorage
      if (nextEmployeeId) {
        localStorage.setItem('selectedEmployeeId', nextEmployeeId.toString());
      } else {
        localStorage.removeItem('selectedEmployeeId');
      }
    }
  };

  // Получаем выбранного сотрудника
  const selectedEmployee = selectedEmployeeId && !isLoading
    ? employees.find((emp) => emp.id === selectedEmployeeId)
    : null;

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
      .filter(emp => !emp.is_dismissed && emp.employee_status !== 'dismissed')
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
    // Для breadcrumb используем полное имя, для таблицы - только фамилия и имя
    return `${lastName} ${firstName} ${secondName}`.trim() || `${lastName} ${firstName}`.trim();
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

  // Получаем уникальные должности для фильтра
  const uniquePositions = Array.from(new Set(
    employees
      .map((emp: any) => emp.role || '')
      .filter((pos: string) => pos)
  ));

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
        categoryIcon={!selectedEmployee ? sotrudnikiIconGrey : undefined}
        categoryLabel={!selectedEmployee ? "Сотрудники" : undefined}
        breadcrumb={selectedEmployee ? [
          { icon: sotrudnikiIconGrey, label: "Сотрудники", onClick: () => navigateToEmployee(null) },
          { label: formatEmployeeName(selectedEmployee) }
        ] : undefined}
        showPagination={true}
        onBack={handleBack}
        onForward={handleForward}
        backDisabled={historyIndex === 0}
        forwardDisabled={historyIndex === navigationHistory.length - 1}
        createButtonText={!selectedEmployee ? "Добавить" : undefined}
        onCreate={!selectedEmployee ? () => {
          // TODO: Открыть модальное окно добавления сотрудника
        } : undefined}
        userName="Гиламанов Т.Р."
      />

      {/* Если выбран сотрудник и данные загружены, показываем детальный вид */}
      {selectedEmployee && !isLoading ? (
        <EmployeeDetail
          employee={selectedEmployee}
          onBack={handleBackToList}
          onSave={(updatedEmployee) => {
            // Обновляем данные сотрудника в списке
            setEmployees((prev) =>
              prev.map((emp) => (emp.id === updatedEmployee.id ? updatedEmployee : emp))
            );
          }}
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
                  {uniquePositions.map((position: string) => (
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
            onClick={() => {
              if (selectedEmployeeIds.size === 0) {
                return;
              }
              // TODO: Реализовать увольнение выбранных сотрудников
            }}
          >
            Уволить
          </button>
        </div>

        {/* Таблица */}
        <div className="employees__table">
          {/* Заголовок таблицы */}
          <div className="employees__table-header">
            <div className="employees__table-header-col employees__table-header-col--id">
              <input 
                type="checkbox" 
                className="employees__checkbox"
                checked={(() => {
                  const nonDismissed = sortedEmployees.filter(emp => !emp.is_dismissed && emp.employee_status !== 'dismissed');
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('id');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="employees__table-header-col employees__table-header-col--name">
              <span>Сотрудник</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'name' ? 'employees__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('name');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="employees__table-header-col employees__table-header-col--email">
              <span>Электронная почта</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'email' ? 'employees__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('email');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="employees__table-header-col employees__table-header-col--status">
              <span>Статус</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'status' ? 'employees__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('status');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="employees__table-header-col employees__table-header-col--date">
              <span>Дата трудоустройства</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`employees__sort-icon ${sortField === 'employment_date' ? 'employees__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('employment_date');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Строки таблицы */}
          {isLoading ? (
            <div className="employees__loading">Загрузка...</div>
          ) : paginatedEmployees.length === 0 ? (
            <div className="employees__empty">
              {employees.length === 0 ? 'Нет сотрудников' : 'Нет сотрудников с такими параметрами'}
            </div>
          ) : (
            paginatedEmployees.map((employee) => {
              const isDismissed = employee.is_dismissed || employee.employee_status === 'dismissed' || employee.dismissal_date;
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
                        {employee.role && (
                          <span className="employees__employee-position">{employee.role}</span>
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
                          {employee.dismissal_date && (
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