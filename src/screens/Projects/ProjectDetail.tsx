import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import sotrudnikiVProekte from '../../shared/icons/sotrudnikiVProekte.svg';
import editIcon from '../../shared/icons/editIcon.svg';
import dotsIcon from '../../shared/icons/dotsIcon.svg';
import userDropdownIcon from '../../shared/icons/user-dropdown-icon.svg';
import calendarIconGrey from '../../shared/icons/calendarIconGrey.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import deleteIcon from '../../shared/icons/deleteIcon.svg';
import addIcon from '../../shared/icons/addIcon.svg';
import AddNomenclatureModal from '../../shared/ui/AddNomenclatureModal/AddNomenclatureModal';
import EditNomenclatureModal from '../../shared/ui/EditNomenclatureModal/EditNomenclatureModal';
import ImportModal from '../../shared/ui/ImportModal/ImportModal';
import AddTrackingModal from '../../shared/ui/AddTrackingModal/AddTrackingModal';
import DeleteTrackingModal from '../../shared/ui/DeleteTrackingModal/DeleteTrackingModal';
import { CommentModal } from '../../shared/ui/CommentModal/CommentModal';
import commentMobIcon from '../../shared/icons/commentMob.svg';
import { Pagination } from '../../shared/ui/Pagination/Pagination';
import '../../shared/ui/CommentModal/comment-modal.scss';

// Функция для получения инициалов (Иван Иванов -> ИИ)
const getInitials = (employee: any) => {
  if (!employee) return '—';
  const { first_name, last_name } = employee;
  const firstInitial = first_name ? first_name.charAt(0).toUpperCase() : '';
  const lastInitial = last_name ? last_name.charAt(0).toUpperCase() : '';
  return (lastInitial + firstInitial) || '—';
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

type ProjectDetailProps = {
  project: any;
  onBack: () => void;
  onProjectUpdate?: (updatedProject: any) => void;
  onProjectCreate?: (createdProject: any) => void;
  onRefresh?: () => Promise<void>;
  isNew?: boolean;
};

const PROJECT_STATUS_META: Record<string, { className: string; color: string; label: string }> = {
  'Новый': { className: 'projects__status--new', color: '#2787F5', label: 'Новый' },
  'В работе': { className: 'projects__status--in-progress', color: '#FF9E00', label: 'В работе' },
  'Завершен': { className: 'projects__status--completed', color: '#26AB69', label: 'Завершен' },
  'Архив': { className: 'projects__status--archived', color: '#919399', label: 'Архив' },
};

const EDITABLE_PROJECT_STATUS_OPTIONS = [
  { label: 'Новый', value: 'Новый', color: '#2787F5' },
  { label: 'В работе', value: 'В работе', color: '#FF9E00' },
];

const EDITABLE_PROJECT_STATUS_VALUES = EDITABLE_PROJECT_STATUS_OPTIONS.map((option) => option.value);
const DEFAULT_EDITABLE_PROJECT_STATUS = EDITABLE_PROJECT_STATUS_OPTIONS[0].value;

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack, onProjectUpdate, onProjectCreate, onRefresh, isNew = false }) => {
  const [localProject, setLocalProject] = useState(project);
  // Восстанавливаем activeTab из localStorage при загрузке
  const [activeTab, setActiveTab] = useState(() => {
    if (!project?.id) {
      return 'general';
    }
    const saved = localStorage.getItem(`activeTab_${project.id}`);
    return saved || 'general';
  });

  // Обновляем activeTab при изменении проекта
  useEffect(() => {
    if (!project?.id) {
      setActiveTab('general');
      return;
    }
    const saved = localStorage.getItem(`activeTab_${project.id}`);
    if (saved) {
      setActiveTab(saved);
    } else {
      setActiveTab('general');
    }
  }, [project.id]);
  const [formData, setFormData] = useState({
    address: project.address || '',
    startDate: project.start_date || '',
    endDate: project.end_date || '',
    foreman: '',
    budget: project.budget || ''
  });
  const [isDotsMenuOpen, setIsDotsMenuOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddTrackingModalOpen, setIsAddTrackingModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [nomenclatureHistory, setNomenclatureHistory] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const [trackingCurrentPage, setTrackingCurrentPage] = useState(1);
  const trackingItemsPerPage = 5;
  const [foremen, setForemen] = useState<any[]>([]);
  const [_selectedForemanId, setSelectedForemanId] = useState<number | null>(null);
  const [allEmployees, setAllEmployees] = useState<any[]>([]); // Все доступные сотрудники (is_employee = true)
  const [isEmployeesTooltipVisible, setIsEmployeesTooltipVisible] = useState(false);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState(project.name || '');
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<{ comment: string; employeeName: string; date: string } | null>(null);
  const [editedStatus, setEditedStatus] = useState(
    project.status && EDITABLE_PROJECT_STATUS_VALUES.includes(project.status)
      ? project.status
      : DEFAULT_EDITABLE_PROJECT_STATUS
  );
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const isNewProject = isNew;

  const startDateInputRef = React.useRef<HTMLInputElement>(null);
  const endDateInputRef = React.useRef<HTMLInputElement>(null);
  const datesContainerRef = React.useRef<HTMLDivElement>(null);
  
  const getEditableStatusValue = (status: string | null | undefined) => {
    if (status && EDITABLE_PROJECT_STATUS_VALUES.includes(status)) {
      return status;
    }
    return DEFAULT_EDITABLE_PROJECT_STATUS;
  };

  const resolveStatusMeta = (status: string | null | undefined) => {
    if (!status) {
      return { className: '', color: '#919399', label: '—' };
    }

    return PROJECT_STATUS_META[status] || { className: '', color: '#919399', label: status };
  };

  useEffect(() => {
    if (!isEditingHeader) {
      setEditedProjectName(localProject.name || '');
      setEditedStatus(getEditableStatusValue(localProject.status));
    }
  }, [localProject.id, localProject.name, localProject.status, isEditingHeader]);

  useEffect(() => {
    if (!isStatusDropdownOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStatusDropdownOpen]);

  useEffect(() => {
    if (isNewProject) {
      setIsEditingHeader(true);
      setEditedProjectName(project.name || '');
      setEditedStatus(getEditableStatusValue(project.status));
    }
  }, [isNewProject, project.name, project.status]);

  
  // Функция для форматирования имени пользователя
  const formatUserName = (user: any) => {
    if (!user) return '';
    const { first_name, second_name, last_name } = user;
    const firstNameInitial = first_name ? first_name.charAt(0).toUpperCase() : '';
    const secondNameInitial = second_name ? second_name.charAt(0).toUpperCase() : '';
    return `${last_name} ${firstNameInitial}.${secondNameInitial ? ` ${secondNameInitial}.` : ''}`;
  };
  
  // Данные для спецификации - берем из localProject.nomenclature
  const [specificationItems, setSpecificationItems] = useState<any[]>([]);
  const [specificationSortField, setSpecificationSortField] = useState<string | null>('npp');
  const [specificationSortDirection, setSpecificationSortDirection] = useState<'asc' | 'desc'>('asc');

  // Выбранные элементы для удаления
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isDeleteTrackingModalOpen, setIsDeleteTrackingModalOpen] = useState(false);
  const [employeesToDelete, setEmployeesToDelete] = useState<Array<{ id: number; name: string; status: string }>>([]);

  // Данные для фиксации работ - формируем из реальных сотрудников проекта
  const [trackingItems, setTrackingItems] = useState<any[]>([]);
  const [trackingSortField, setTrackingSortField] = useState<string | null>(null);
  const [trackingSortDirection, setTrackingSortDirection] = useState<'asc' | 'desc'>('asc');

  // Проверка, является ли сотрудник ГИП (не отображаем в иконках и в фиксации работ)
  const isGIP = (emp: any) => {
    const role = (emp?.role || emp?.position || '').toLowerCase();
    return role.includes('гип') || role === 'главный инженер проекта';
  };

  // Вспомогательная функция для фильтрации активных (не удаленных) сотрудников
  const getActiveEmployees = (employees: any[]) => {
    if (!employees || !Array.isArray(employees)) return [];
    return employees.filter((emp: any) => {
      // Сотрудник считается активным, если у него нет end_working_date
      // Проверяем pivot?.end_working_date - если есть дата (не null, не undefined, не пустая строка), значит сотрудник удален
      const endWorkingDate = emp.pivot?.end_working_date;
      // Сотрудник активен, если end_working_date отсутствует или равен null/undefined/пустой строке
      return !endWorkingDate || endWorkingDate === null || endWorkingDate === undefined || endWorkingDate === '';
    });
  };

  // Функция для расчета количества дней в проекте
  const calculateDaysInProject = (startWorkingDate: string | null, endWorkingDate: string | null): number => {
    if (!startWorkingDate) return 0;
    
    try {
      const startDate = new Date(startWorkingDate);
      const endDate = endWorkingDate ? new Date(endWorkingDate) : new Date(); // Если нет даты окончания, используем сегодня
      
      // Проверяем валидность дат
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return 0;
      }
      
      // Устанавливаем время в 00:00:00 для корректного расчета дней
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      // Вычисляем разницу в миллисекундах
      const diffTime = endDate.getTime() - startDate.getTime();
      
      // Преобразуем в дни (округляем вверх для включения начального и конечного дня)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Возвращаем минимум 0 (если дата начала больше даты окончания) или 1 если дни совпадают
      return Math.max(0, diffDays === 0 ? 1 : diffDays);
    } catch (error) {
      return 0;
    }
  };

  // Обновляем данные для фиксации работ при изменении сотрудников проекта
  useEffect(() => {
    if (localProject.employees && Array.isArray(localProject.employees)) {
      if (!localProject.id) {
        // Новый проект: формируем trackingItems локально без API (work_reports не существуют)
        const employeesWithoutGIP = localProject.employees.filter((emp: any) => !isGIP(emp));
        const formattedEmployees = employeesWithoutGIP.map((employee: any) => {
          const startWorkingDate = employee.pivot?.start_working_date || null;
          const endWorkingDate = employee.pivot?.end_working_date || null;
          const daysInProject = calculateDaysInProject(startWorkingDate, endWorkingDate);
          const status = endWorkingDate ? 'Удалён' :
            (employee.employee_status === 'active' ? 'Работает' : employee.is_dismissed ? 'Уволен' : 'Неизвестно');
          const rate = employee.pivot?.rate_per_hour || employee.rate_per_hour || 0;
          return {
            id: employee.id,
            name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
            role: employee.role || 'Не указана',
            status,
            deletionDate: endWorkingDate ? new Date(endWorkingDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
            startDate: startWorkingDate ? new Date(startWorkingDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Не указана',
            days: daysInProject,
            hours: 0,
            lastHours: 0,
            lastReport: null,
            rate,
            lastSum: 0,
            totalSum: 0
          };
        });
        const sorted = formattedEmployees.sort((a: any, b: any) => {
          const aDel = a.status === 'Удалён';
          const bDel = b.status === 'Удалён';
          return aDel === bDel ? 0 : aDel ? 1 : -1;
        });
        setTrackingItems(sorted);
        setTrackingCurrentPage(1);
        return;
      }
      const loadTrackingData = async () => {
        const employeesWithoutGIP = localProject.employees.filter((emp: any) => !isGIP(emp));
        const formattedEmployees = await Promise.all(
          employeesWithoutGIP.map(async (employee: any) => {
            // Получаем дату начала работы сотрудника из pivot
            const startWorkingDate = employee.pivot?.start_working_date || null;
            const endWorkingDate = employee.pivot?.end_working_date || null;
            const daysInProject = calculateDaysInProject(startWorkingDate, endWorkingDate);
            
            // Определяем статус: если есть end_working_date, то "Удалён"
            const status = endWorkingDate ? 'Удалён' : 
                          (employee.employee_status === 'active' ? 'Работает' :
                          employee.is_dismissed ? 'Удалён' : 'Неизвестно');
            
            // Форматируем дату удаления
            const deletionDate = endWorkingDate ? 
              new Date(endWorkingDate).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              }) : null;
            
            // Получаем ставку в час
            const rate = employee.pivot?.rate_per_hour || employee.rate_per_hour || 0;
            
            // Загружаем work_reports для сотрудника
            let hours = 0;
            let lastHours = 0;
            let totalSum = 0;
            let lastSum = 0;
            
            try {
              const response = await apiService.getWorkReports(localProject.id, employee.id, {
                per_page: 1000,
              });
              
              let reports: any[] = [];
              // Проверяем разные варианты структуры ответа
              if (response?.data?.data && Array.isArray(response.data.data)) {
                reports = response.data.data;
              } else if (response?.data && Array.isArray(response.data)) {
                reports = response.data;
              } else if (Array.isArray(response)) {
                reports = response;
              }
              
              // Сортируем reports по дате (от новых к старым) для получения последнего
              reports.sort((a, b) => {
                const dateA = new Date(a.report_date).getTime();
                const dateB = new Date(b.report_date).getTime();
                return dateB - dateA;
              });
              
              // Суммируем все часы
              hours = reports.reduce((sum, report) => {
                const hoursWorked = Number(report.hours_worked) || 0;
                const isAbsent = report.absent === true || report.absent === 1 || report.absent === '1';
                return sum + (isAbsent ? 0 : hoursWorked);
              }, 0);
              
              // Получаем последние часы (из самого последнего отчета)
              let lastReport: any = null;
              if (reports.length > 0) {
                lastReport = reports[0];
                const lastHoursWorked = Number(lastReport.hours_worked) || 0;
                const isLastAbsent = lastReport.absent === true || lastReport.absent === 1 || lastReport.absent === '1';
                lastHours = isLastAbsent ? 0 : lastHoursWorked;
              }
              
              // Рассчитываем суммы
              totalSum = hours * rate;
              lastSum = lastHours * rate;
              
              return {
                id: employee.id,
                name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
                role: employee.role || 'Не указана',
                status: status,
                deletionDate: deletionDate,
                startDate: startWorkingDate ?
                          new Date(startWorkingDate).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }) : 'Не указана',
                days: daysInProject,
                hours: hours,
                lastHours: lastHours,
                lastReport: lastReport, // Сохраняем последний отчет для проверки комментария
                rate: rate,
                lastSum: lastSum,
                totalSum: totalSum
              };
            } catch (error) {
              console.error(`Error loading work reports for employee ${employee.id}:`, error);
              return {
                id: employee.id,
                name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
                role: employee.role || 'Не указана',
                status: status,
                deletionDate: deletionDate,
                startDate: startWorkingDate ?
                          new Date(startWorkingDate).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }) : 'Не указана',
                days: daysInProject,
                hours: 0,
                lastHours: 0,
                lastReport: null,
                rate: rate,
                lastSum: 0,
                totalSum: 0
              };
            }
          })
        );
          
        // Сортируем: сначала активные, затем удаленные
        const sortedEmployees = formattedEmployees.sort((a: any, b: any) => {
          const aIsDeleted = a.status === 'Удалён';
          const bIsDeleted = b.status === 'Удалён';
          
          if (aIsDeleted === bIsDeleted) {
            return 0;
          }
          
          return aIsDeleted ? 1 : -1;
        });
        
        setTrackingItems(sortedEmployees);
        // Сбрасываем пагинацию при изменении данных
        setTrackingCurrentPage(1);
      };
      
      loadTrackingData();
    } else {
      // Если employees пустой или undefined, очищаем trackingItems
      setTrackingItems([]);
      setTrackingCurrentPage(1);
    }
  }, [localProject.employees?.length, localProject.id]); // Используем длину массива для принудительного обновления

  // Загрузка всех сотрудников при монтировании компонента (для модального окна добавления)
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await apiService.getUsers();
        
        if (response && response.data) {
          const users = Array.isArray(response.data) ? response.data : [];
          // Фильтруем всех сотрудников (is_employee = true) для модального окна
          const employeesList = users.filter((user: any) => user.is_employee === true);
          setAllEmployees(employeesList);
        }
      } catch (error) {
        setAllEmployees([]);
      }
    };

    fetchEmployees();
  }, []);

  // Получаем бригадиров из сотрудников проекта (только просмотр)
  useEffect(() => {
    if (localProject.employees && Array.isArray(localProject.employees)) {
      // Фильтруем только активных сотрудников (не удаленных), затем только бригадиров
      const activeEmployees = getActiveEmployees(localProject.employees);
      const projectForemen = activeEmployees.filter((emp: any) => emp.role === 'Бригадир');
      setForemen(projectForemen);
      
      // Устанавливаем первого бригадира для отображения в поле
      if (projectForemen.length > 0) {
        const firstForeman = projectForemen[0];
        setSelectedForemanId(firstForeman.id);
        setFormData(prev => ({
          ...prev,
          foreman: formatUserName(firstForeman)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          foreman: ''
        }));
      }
    } else {
      setForemen([]);
      setFormData(prev => ({
        ...prev,
        foreman: ''
      }));
    }
  }, [localProject.employees]); // Обновляем при изменении сотрудников проекта

  // Синхронизация localProject с prop project (без сброса бригадира)
  useEffect(() => {
    if (localProject.id !== project.id) {
      setLocalProject(project);
      setFormData({
        address: project.address || '',
        startDate: project.start_date || '',
        endDate: project.end_date || '',
        foreman: '',
        budget: project.budget || ''
      });
    } else {
      // Обновляем только измененные поля, сохраняя бригадира
      setLocalProject(project);
      setFormData(prev => ({
        ...prev,
        address: project.address || prev.address,
        startDate: project.start_date || prev.startDate,
        endDate: project.end_date || prev.endDate,
        budget: project.budget || prev.budget
      }));
    }
  }, [project]);

  // Обновляем данные спецификации при изменении localProject.nomenclature
  useEffect(() => {
    const loadNomenclatureWithChanges = async () => {
      if (localProject.nomenclature && Array.isArray(localProject.nomenclature) && localProject.id) {
        try {
          // Загружаем изменения для каждого материала
          const itemsWithChanges = await Promise.all(
            localProject.nomenclature.map(async (item: any, index: number) => {
              let lastChange = null;
              let factValue = 0;
              
              try {
                // Получаем историю изменений для этого материала
                const changesResponse = await apiService.getNomenclatureChanges(localProject.id, item.id);
                
                // Берем последнее изменение (последнее в массиве, так как API возвращает их по возрастанию даты)
                if (changesResponse && changesResponse.data && Array.isArray(changesResponse.data) && changesResponse.data.length > 0) {
                  const latestChange = changesResponse.data[changesResponse.data.length - 1];
                  lastChange = latestChange.amount_change;
                }
              } catch (error) {
                // Тихо игнорируем ошибки - материал просто не будет иметь изменений
              }

              try {
                // Загружаем факты и суммируем их
                const factsResponse = await apiService.getNomenclatureFacts(localProject.id, item.id, {
                  per_page: 1000,
                });
                
                let factsData: any[] = [];
                if (factsResponse?.data?.data && Array.isArray(factsResponse.data.data)) {
                  factsData = factsResponse.data.data;
                } else if (factsResponse?.data && Array.isArray(factsResponse.data)) {
                  factsData = factsResponse.data;
                } else if (Array.isArray(factsResponse)) {
                  factsData = factsResponse;
                }

                // Суммируем все факты (исключая удаленные)
                factValue = factsData
                  .filter((fact: any) => !fact.is_deleted)
                  .reduce((sum: number, fact: any) => {
                    const amount = Number(fact.amount) || 0;
                    return sum + amount;
                  }, 0);
              } catch (error) {
                // Игнорируем ошибки загрузки фактов, используем значение из pivot
                factValue = Number(item?.pivot?.current_amount ?? item?.fact ?? 0);
              }

              return {
                id: item.id,
                npp: item.index_number ?? item.npp ?? item.pivot?.npp ?? index + 1,
                name: item.name,
                status: item.is_deleted ? `Удалён\n${new Date(item.deleted_at).toLocaleDateString('ru-RU')}` : 'Активен',
                unit: item.unit || '',
                plan: item.pivot?.start_amount || 0,
                changes: lastChange,
                fact: Number.isFinite(factValue) ? factValue : 0
              };
            })
          );
          
          setSpecificationItems(itemsWithChanges);
        } catch (error) {
          // Ошибка загрузки изменений обработана
        }
      } else {
        // Если номенклатуры нет, очищаем список
        setSpecificationItems([]);
      }
    };

    loadNomenclatureWithChanges();
  }, [localProject.id, localProject.nomenclature]);

  const handleInputChange = (field: string, value: string) => {
    // Для поля budget проверяем, что значение не отрицательное
    if (field === 'budget') {
      const numValue = parseFloat(value);
      // Если значение отрицательное или пустое, устанавливаем пустую строку или 0
      if (value === '' || value === '-') {
        setFormData(prev => ({
          ...prev,
          [field]: value
        }));
        return;
      }
      if (!isNaN(numValue) && numValue < 0) {
        // Если значение отрицательное, не обновляем
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStartHeaderEdit = () => {
    setEditedProjectName(localProject.name || '');
    setEditedStatus(getEditableStatusValue(localProject.status));
    setIsStatusDropdownOpen(false);
    setIsDotsMenuOpen(false);
    setIsEditingHeader(true);
  };

  const handleHeaderCancel = () => {
    if (isNewProject) {
      onBack();
      return;
    }

    setEditedProjectName(localProject.name || '');
    setEditedStatus(getEditableStatusValue(localProject.status));
    setIsStatusDropdownOpen(false);
    setIsEditingHeader(false);
  };

  const handleHeaderSave = async () => {
    if (isNewProject) {
      setIsSavingHeader(true);
      try {
        await handleSave();
      } finally {
        setIsSavingHeader(false);
      }
      return;
    }

    if (!localProject?.id) {
      return;
    }

    const trimmedName = editedProjectName.trim();

    if (!trimmedName) {
      alert('Введите название проекта');
      return;
    }

    setIsSavingHeader(true);

    try {
      const currentEmployees = localProject.employees || [];

      const employeeObjects = currentEmployees.map((emp: any) => ({
        id: emp.id,
        start_working_date: emp.pivot?.start_working_date || localProject.start_date,
        end_working_date: emp.pivot?.end_working_date || null,
        rate_per_hour: emp.pivot?.rate_per_hour || emp.rate_per_hour || 0,
      }));

      const foremenIdsHeader = (localProject.employees || [])
        .filter((emp: any) => emp.role === 'Бригадир')
        .map((emp: any) => emp.id);
      const pmHeader = foremenIdsHeader.length > 0
        ? foremenIdsHeader
        : (localProject.project_managers ?? (localProject.project_manager_id ? [localProject.project_manager_id] : []));
      const updateData: any = {
        name: trimmedName,
        project_managers: pmHeader,
        start_date: formData.startDate,
        end_date: formData.endDate,
        budget: formData.budget ? parseFloat(formData.budget.toString()) : null,
        address: formData.address || null,
        description: localProject.description || '',
        status: editedStatus,
        employee: employeeObjects,
      };

      await apiService.updateProject(localProject.id, updateData);

      // Оптимистичное обновление - обновляем локальное состояние сразу
      const optimisticUpdate = {
        ...localProject,
        name: trimmedName,
        status: editedStatus,
      };
      setLocalProject(optimisticUpdate);
      if (onProjectUpdate) {
        onProjectUpdate(optimisticUpdate);
      }

      // Перезагружаем с сервера в фоне для синхронизации (не блокируем UI)
      try {
        const updatedProjectResponse = await apiService.getProjectById(localProject.id);
        if (updatedProjectResponse && updatedProjectResponse.data) {
          const updatedProject = updatedProjectResponse.data;
          setLocalProject(updatedProject);
          if (onProjectUpdate) {
            onProjectUpdate(updatedProject);
          }
        }
      } catch (error) {
        console.error('Error refreshing project after update:', error);
        // Оставляем оптимистичное обновление
      }

      setIsEditingHeader(false);
      setIsStatusDropdownOpen(false);
    } catch (error) {
      console.error('Error updating project title or status:', error);
      alert('Не удалось сохранить изменения. Попробуйте еще раз.');
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = (isEditingHeader ? editedProjectName : localProject.name || '').trim();

    if (!trimmedName) {
      alert('Введите название проекта');
      setIsEditingHeader(true);
      return;
    }

    const statusForSave = isEditingHeader ? editedStatus : getEditableStatusValue(localProject.status);
    const currentUser = apiService.getCurrentUser();
    const foremenIds = (localProject.employees || [])
      .filter((emp: any) => emp.role === 'Бригадир')
      .map((emp: any) => emp.id);
    let projectManagers: number[];
    if (isNewProject) {
      projectManagers = foremenIds;
    } else {
      projectManagers = foremenIds.length > 0
        ? foremenIds
        : (localProject.project_managers ?? (localProject.project_manager_id ? [localProject.project_manager_id] : (currentUser?.id ? [currentUser.id] : [])));
      if (projectManagers.length === 0 && currentUser?.id) projectManagers = [currentUser.id];
    }
    if (projectManagers.length === 0) {
      alert('Добавьте хотя бы одного бригадира через вкладку «Фиксация работ» (кнопка «Добавить»).');
      return;
    }

    const currentEmployees = localProject.employees || [];
    const employeeObjects = currentEmployees.map((emp: any) => ({
      id: emp.id,
      start_working_date: emp.pivot?.start_working_date || localProject.start_date || formData.startDate || null,
      end_working_date: emp.pivot?.end_working_date || null,
      rate_per_hour: emp.pivot?.rate_per_hour || emp.rate_per_hour || 0,
    }));

    // Проверяем и исправляем budget, если он отрицательный
    let budgetValue = null;
    if (formData.budget) {
      const parsedBudget = parseFloat(formData.budget.toString());
      if (!isNaN(parsedBudget) && parsedBudget >= 0) {
        budgetValue = parsedBudget;
      } else if (!isNaN(parsedBudget) && parsedBudget < 0) {
        // Если значение отрицательное, устанавливаем 0
        budgetValue = 0;
        setFormData(prev => ({ ...prev, budget: '0' }));
      }
    }

    const basePayload: any = {
      name: trimmedName,
      project_managers: projectManagers,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      budget: budgetValue,
      address: formData.address || null,
      description: localProject.description || '',
      status: statusForSave,
      employee: employeeObjects,
    };

    if (isNewProject) {
      try {
        const defaultStartDate = formData.startDate || new Date().toISOString().split('T')[0];
        const employeesForRequest = projectManagers.map((id: number) => {
          const emp = allEmployees.find((e: any) => e.id === id);
          return {
            id,
            start_working_date: defaultStartDate,
            end_working_date: null,
            rate_per_hour: emp?.rate_per_hour ?? 0,
          };
        });

        const createPayload = {
          ...basePayload,
          employee: employeesForRequest,
        };

        const response = await apiService.createProject(createPayload);
        const createdProject = (response?.data ?? response?.project ?? response) as Record<string, unknown>;

        if (!createdProject || (typeof createdProject === 'object' && !('id' in createdProject))) {
          throw new Error('Пустой или некорректный ответ сервера при создании проекта');
        }

        setLocalProject(createdProject);
        setEditedProjectName(createdProject.name || '');
        setEditedStatus(getEditableStatusValue(createdProject.status as string | null | undefined));
        setIsEditingHeader(false);
        setFormData(prev => ({
          ...prev,
          address: createdProject.address || '',
          startDate: createdProject.start_date || '',
          endDate: createdProject.end_date || '',
          budget: createdProject.budget ? createdProject.budget.toString() : '',
        }));

        if (onProjectCreate) {
          onProjectCreate(createdProject);
        }
      } catch (error: any) {
        console.error('Error creating project:', error);
        let message = 'Не удалось создать проект. Проверьте заполненные данные и попробуйте еще раз.';
        try {
          const errMsg = error?.message || '';
          const bodyMatch = errMsg.match(/body:\s*(.+)$/);
          if (bodyMatch) {
            const body = JSON.parse(bodyMatch[1].trim());
            if (body?.error) message = body.error;
            else if (body?.message) message = body.message;
            else if (body?.errors && typeof body.errors === 'object') {
              const errParts = Object.entries(body.errors).flatMap(([k, v]) =>
                Array.isArray(v) ? v.map((e: unknown) => `${k}: ${e}`) : [`${k}: ${v}`]
              );
              if (errParts.length) message = errParts.join('\n');
            }
          }
        } catch (_) {}
        alert(message);
      }

      return;
    }

    try {
      await apiService.updateProject(localProject.id, basePayload);

      // Оптимистичное обновление - обновляем локальное состояние сразу
      const optimisticUpdate = {
        ...localProject,
        name: trimmedName,
        status: statusForSave,
        project_managers: projectManagers,
      };
      setLocalProject(optimisticUpdate);
      if (onProjectUpdate) {
        onProjectUpdate(optimisticUpdate);
      }

      // Перезагружаем с сервера в фоне для синхронизации (не блокируем UI)
      try {
        const updatedProjectResponse = await apiService.getProjectById(localProject.id);
        if (updatedProjectResponse && updatedProjectResponse.data) {
          const updatedProject = updatedProjectResponse.data;
          setLocalProject(updatedProject);
          if (onProjectUpdate) {
            onProjectUpdate(updatedProject);
          }
        }
      } catch (error) {
        console.error('Error refreshing project after update:', error);
        // Оставляем оптимистичное обновление
      }
    } catch (error) {
      // Ошибка обработана без уведомления пользователя
    }
  };

  const handleCancel = () => {
    // Сброс к исходным данным
    // Получаем всех бригадиров из проекта
    let foremenList: any[] = [];

    if (localProject.employees && Array.isArray(localProject.employees)) {
      foremenList = localProject.employees.filter((emp: any) => emp.role === 'Бригадир');
      
      if (foremenList.length > 0) {
        const firstForeman = foremenList[0];
        setFormData(prev => ({
          ...prev,
          foreman: formatUserName(firstForeman)
        }));
      }
    }
    
    setForemen(foremenList);
    setSelectedForemanId(foremenList.length > 0 ? foremenList[0].id : null);
    
    setFormData({
      address: localProject.address || '',
      startDate: localProject.start_date || '',
      endDate: localProject.end_date || '',
      foreman: '',
      budget: localProject.budget || ''
    });

    // Возвращаемся на страницу проектов
    onBack();
  };

  const handleAddNomenclature = async (data: { nomenclatureId: number; nomenclature: string; unit: string; quantity: number }) => {
    if (!localProject.id) return;
    
    try {
      // Отправляем запрос на добавление номенклатуры в проект
      await apiService.addNomenclatureToProject(localProject.id, data.nomenclatureId, data.quantity);
      
      // Обновляем проект, чтобы загрузить новую номенклатуру с фактами
      const updatedProject = await apiService.getProjectById(localProject.id);
      const projectData = updatedProject?.data || updatedProject;
      
      if (projectData) {
        setLocalProject(projectData);
        onProjectUpdate?.(projectData);
      }
      await onRefresh?.();
    } catch (error) {
      console.error('Ошибка при добавлении номенклатуры:', error);
    }
  };

  const handleEditNomenclature = async (item: any) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
    setNomenclatureHistory([]); // Сбрасываем историю

    // Загружаем историю изменений для этого материала
    if (localProject.id && item.id) {
      try {
        const changesResponse = await apiService.getNomenclatureChanges(localProject.id, item.id);
        
        if (changesResponse && changesResponse.data && Array.isArray(changesResponse.data)) {
          // Форматируем данные для отображения в модальном окне
          // Разворачиваем массив, чтобы последние изменения были первыми
          const formattedHistory = changesResponse.data.reverse().map((change: any) => {
            // Извлекаем данные пользователя из logs
            let userName = 'Неизвестно';
            if (change.logs && Array.isArray(change.logs) && change.logs.length > 0) {
              const log = change.logs[0];
              // Проверяем наличие объекта user в log
              if (log.user) {
                const user = log.user;
                const lastName = user.last_name || '';
                const firstName = user.first_name ? user.first_name.charAt(0) + '.' : '';
                const middleName = user.middle_name ? user.middle_name.charAt(0) + '.' : '';
                userName = [lastName, firstName, middleName].filter(Boolean).join(' ') || 'Неизвестно';
              } else if (log.user_id) {
                // Если есть только user_id, но нет объекта user, оставляем "Неизвестно"
                // В будущем можно сделать отдельный запрос для получения данных пользователя
                userName = 'Неизвестно';
              }
            } else if (change.user) {
              // Fallback на старую структуру, если logs нет
              const user = change.user;
              const lastName = user.last_name || '';
              const firstName = user.first_name ? user.first_name.charAt(0) + '.' : '';
              const middleName = user.middle_name ? user.middle_name.charAt(0) + '.' : '';
              userName = [lastName, firstName, middleName].filter(Boolean).join(' ') || 'Неизвестно';
            }
            
            return {
              date: new Date(change.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
              quantity: `${change.amount_change} ${item.unit || ''}`,
              changedBy: userName
            };
          });
          setNomenclatureHistory(formattedHistory);
        }
      } catch (error) {
        // Ошибка загрузки истории обработана
      }
    }
  };

  const handleSaveEdit = async (data: { nomenclature: string; changeDate: string; quantity: number }) => {
    if (editingItem && localProject.id) {
      try {
        // Отправляем новое изменение на сервер
        await apiService.addNomenclatureChange(
          localProject.id,
          editingItem.id,
          data.quantity
        );

        // Обновляем локальное состояние - добавляем изменение
        setSpecificationItems(prev => 
          prev.map(item => 
            item.id === editingItem.id 
              ? { ...item, changes: data.quantity }
              : item
          )
        );

        // Перезагружаем историю изменений
        const changesResponse = await apiService.getNomenclatureChanges(localProject.id, editingItem.id);
        if (changesResponse && changesResponse.data && Array.isArray(changesResponse.data)) {
          // Разворачиваем массив, чтобы последние изменения были первыми
          const formattedHistory = changesResponse.data.reverse().map((change: any) => {
            // Извлекаем данные пользователя из logs
            let userName = 'Неизвестно';
            if (change.logs && Array.isArray(change.logs) && change.logs.length > 0) {
              const log = change.logs[0];
              // Проверяем наличие объекта user в log
              if (log.user) {
                const user = log.user;
                const lastName = user.last_name || '';
                const firstName = user.first_name ? user.first_name.charAt(0) + '.' : '';
                const middleName = user.middle_name ? user.middle_name.charAt(0) + '.' : '';
                userName = [lastName, firstName, middleName].filter(Boolean).join(' ') || 'Неизвестно';
              } else if (log.user_id) {
                // Если есть только user_id, но нет объекта user, оставляем "Неизвестно"
                // В будущем можно сделать отдельный запрос для получения данных пользователя
                userName = 'Неизвестно';
              }
            } else if (change.user) {
              // Fallback на старую структуру, если logs нет
              const user = change.user;
              const lastName = user.last_name || '';
              const firstName = user.first_name ? user.first_name.charAt(0) + '.' : '';
              const middleName = user.middle_name ? user.middle_name.charAt(0) + '.' : '';
              userName = [lastName, firstName, middleName].filter(Boolean).join(' ') || 'Неизвестно';
            }
            
            return {
              date: new Date(change.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
              quantity: `${change.amount_change} ${editingItem.unit || ''}`,
              changedBy: userName
            };
          });
          setNomenclatureHistory(formattedHistory);
        }

      } catch (error) {
        // Ошибка обработана без уведомления пользователя
      }
    }
    setIsEditModalOpen(false);
    setEditingItem(null);
    setNomenclatureHistory([]);
  };

  const handleImport = async (_file: File, parsedData?: any[], _matches?: string[]) => {
    if (!localProject.id || !parsedData || parsedData.length === 0) return;

    try {
      // Получаем список всей номенклатуры для поиска по названию
      const allNomenclatureResponse = await apiService.getNomenclature();
      const allNomenclature = Array.isArray(allNomenclatureResponse?.data) 
        ? allNomenclatureResponse.data 
        : allNomenclatureResponse?.data 
        ? [allNomenclatureResponse.data] 
        : [];

      // Обрабатываем каждую строку из файла
      for (const row of parsedData) {
        // Ищем номенклатуру по названию в общем списке
        let nomenclatureItem = allNomenclature.find((item: any) => {
          const itemName = String(item.name || '').toLowerCase().trim();
          const rowName = row.nomenclature.toLowerCase().trim();
          return itemName === rowName;
        });

        // Если номенклатура не найдена - создаём её в общей номенклатуре
        if (!nomenclatureItem) {
          try {
            console.log(`Создаём номенклатуру "${row.nomenclature}" в общей номенклатуре`);
            const createResponse = await apiService.createNomenclature({
              name: row.nomenclature,
              unit: row.unit || '',
              price: 1, // По умолчанию цена 1, можно будет изменить позже
              description: '',
            });
            
            // Получаем созданную номенклатуру из ответа
            const createdNomenclature = createResponse?.data || createResponse;
            if (createdNomenclature && createdNomenclature.id) {
              nomenclatureItem = createdNomenclature;
              // Добавляем в локальный список, чтобы не создавать повторно
              allNomenclature.push(nomenclatureItem);
              console.log(`Номенклатура "${row.nomenclature}" успешно создана с ID: ${nomenclatureItem.id}`);
            } else {
              console.error(`Не удалось создать номенклатуру "${row.nomenclature}"`);
              continue;
            }
          } catch (error: any) {
            console.error(`Ошибка при создании номенклатуры "${row.nomenclature}":`, error);
            continue;
          }
        }

        // Проверяем, есть ли эта номенклатура уже в проекте
        const existingInProject = localProject.nomenclature?.find((item: any) => {
          return item.id === nomenclatureItem.id;
        });

        if (existingInProject) {
          // Если номенклатура уже есть в проекте - обновляем через changes
          await apiService.addNomenclatureChange(
            localProject.id,
            nomenclatureItem.id,
            row.quantity
          );
        } else {
          // Если номенклатуры нет в проекте - добавляем через add
          await apiService.addNomenclatureToProject(
            localProject.id,
            nomenclatureItem.id,
            row.quantity
          );
        }
      }

      // Обновляем проект после импорта
      const updatedProject = await apiService.getProjectById(localProject.id);
      const projectData = updatedProject?.data || updatedProject;
      
      if (projectData) {
        setLocalProject(projectData);
        onProjectUpdate?.(projectData);
      }
      await onRefresh?.();
      setIsImportModalOpen(false);
    } catch (error: any) {
      console.error('Error importing nomenclature:', error);
      alert('Ошибка при импорте номенклатуры: ' + (error.message || 'Неизвестная ошибка'));
    }
  };

  const handleAddTracking = async (data: { employeeId: number; employeeName: string; rate: number; startDate: string }) => {
    const currentEmployees = localProject.employees || [];

    // Находим информацию о новом сотруднике из списка всех сотрудников
    const newEmployeeData = allEmployees.find((emp: any) => emp.id === data.employeeId);

    if (!newEmployeeData) {
      console.error('Employee not found in allEmployees list');
      return;
    }

    // Уже есть в проекте — не дублируем
    if (currentEmployees.some((e: any) => e.id === data.employeeId)) return;

    const optimisticEmployee = {
      ...newEmployeeData,
      pivot: {
        start_working_date: data.startDate,
        end_working_date: null,
        rate_per_hour: data.rate
      }
    };

    const optimisticEmployees = [...currentEmployees, optimisticEmployee];
    const optimisticProject = { ...localProject, employees: optimisticEmployees };

    const formattedEmployees = optimisticEmployees.map((employee: any) => {
      const startWorkingDate = employee.pivot?.start_working_date || null;
      const endWorkingDate = employee.pivot?.end_working_date || null;
      const daysInProject = calculateDaysInProject(startWorkingDate, endWorkingDate);
      return {
        id: employee.id,
        name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
        role: employee.role || 'Не указана',
        status: employee.employee_status === 'active' ? 'Работает' :
                employee.is_dismissed ? 'Уволен' : 'Неизвестно',
        startDate: startWorkingDate ?
          new Date(startWorkingDate).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short', year: 'numeric'
          }) : 'Не указана',
        days: daysInProject,
        hours: 0,
        lastHours: 0,
        rate: employee.pivot?.rate_per_hour || employee.rate_per_hour || 0,
        lastSum: 0,
        totalSum: 0
      };
    });

    const sortedEmployees = formattedEmployees.sort((a: any, b: any) => {
      const aIsDeleted = a.status === 'Удалён';
      const bIsDeleted = b.status === 'Удалён';
      if (aIsDeleted === bIsDeleted) return 0;
      return aIsDeleted ? 1 : -1;
    });

    setLocalProject(optimisticProject);
    setTrackingItems(sortedEmployees);

    if (onProjectUpdate) onProjectUpdate(optimisticProject);

    // Для нового проекта — только локальное обновление, API не вызываем
    if (!localProject.id) return;

    try {
      // Формируем массив employee для PATCH запроса согласно документации:
      // { id, start_working_date, end_working_date: null, rate_per_hour }
      const employeeArray = [
        // Сохраняем существующих сотрудников
        ...currentEmployees.map((emp: any) => ({
          id: emp.id,
          start_working_date: emp.pivot?.start_working_date || localProject.start_date,
          end_working_date: emp.pivot?.end_working_date || null,
          rate_per_hour: emp.pivot?.rate_per_hour || emp.rate_per_hour || 0
        })),
        // Добавляем нового сотрудника
        {
          id: data.employeeId,
          start_working_date: data.startDate,
          end_working_date: null,
          rate_per_hour: data.rate
        }
      ];

      // Ответственные бригадиры = все бригадиры в проекте (для фильтра в мобильной версии)
      const foremenIds = optimisticEmployees
        .filter((emp: any) => emp.role === 'Бригадир')
        .map((emp: any) => emp.id);

      // Отправляем PATCH запрос для обновления проекта на сервере
      await apiService.updateProject(localProject.id, {
        employee: employeeArray,
        project_managers: foremenIds.length > 0 ? foremenIds : localProject.project_managers,
      });

      // После успешного PATCH делаем GET запрос для синхронизации с сервером
      // Небольшая задержка для обработки на сервере
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedProjectResponse = await apiService.getProjectById(localProject.id);
      
      if (updatedProjectResponse && updatedProjectResponse.data) {
        const serverProject = updatedProjectResponse.data;
        
        // Сравниваем и обновляем с данными с сервера (более актуальными)
        if (serverProject.employees && Array.isArray(serverProject.employees)) {
          // Синхронизируем с сервером - обновляем localProject реальными данными
          setLocalProject({
            ...serverProject,
            employees: [...serverProject.employees]
          });
          
          // Обновляем trackingItems с серверными данными
          const serverFormattedEmployees = serverProject.employees.map((employee: any) => {
            const startWorkingDate = employee.pivot?.start_working_date || null;
            const endWorkingDate = employee.pivot?.end_working_date || null;
            const daysInProject = calculateDaysInProject(startWorkingDate, endWorkingDate);
            
            return {
              id: employee.id,
              name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
              role: employee.role || 'Не указана',
              status: employee.employee_status === 'active' ? 'Работает' :
                      employee.is_dismissed ? 'Уволен' : 'Неизвестно',
              startDate: startWorkingDate ?
                        new Date(startWorkingDate).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : 'Не указана',
              days: daysInProject,
              hours: 0,
              lastHours: 0,
              rate: employee.pivot?.rate_per_hour || employee.rate_per_hour || 0,
              lastSum: 0,
              totalSum: 0
            };
          });
          setTrackingItems(serverFormattedEmployees);
          
          // Обновляем данные в родительском компоненте
          if (onProjectUpdate) {
            onProjectUpdate(serverProject);
          }
        }
      }
    } catch (error) {
      // Если ошибка - откатываем оптимистичное обновление
      console.error('Error adding employee:', error);
      
      // Откатываем к предыдущему состоянию
      const currentEmployees = localProject.employees || [];
      const rolledBackEmployees = currentEmployees.filter((emp: any) => emp.id !== data.employeeId);
      setLocalProject({
        ...localProject,
        employees: rolledBackEmployees
      });
      
      // Обновляем trackingItems без удаленного сотрудника
      const rolledBackFormattedEmployees = rolledBackEmployees.map((employee: any) => {
        const startWorkingDate = employee.pivot?.start_working_date || null;
        const endWorkingDate = employee.pivot?.end_working_date || null;
        const daysInProject = calculateDaysInProject(startWorkingDate, endWorkingDate);
        
        return {
          id: employee.id,
          name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
          role: employee.role || 'Не указана',
          status: employee.employee_status === 'active' ? 'Работает' :
                  employee.is_dismissed ? 'Уволен' : 'Неизвестно',
          startDate: startWorkingDate ?
                    new Date(startWorkingDate).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    }) : 'Не указана',
          days: daysInProject,
          hours: 0,
          lastHours: 0,
          rate: employee.pivot?.rate_per_hour || employee.rate_per_hour || 0,
          lastSum: 0,
          totalSum: 0
        };
      });
      setTrackingItems(rolledBackFormattedEmployees);
    }
  };

  const handleDeleteTracking = async (data: { employeeId: number; endDate: string }) => {
    if (!localProject.id) return;

    try {
      // Получаем текущий список сотрудников проекта
      const currentEmployees = localProject.employees || [];
      
      // Получаем ID всех выбранных сотрудников для удаления
      const employeesToDeleteIds = Array.from(selectedItems);
      
      if (employeesToDeleteIds.length === 0) {
        console.warn('No employees selected for deletion');
        return;
      }

      // ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ: Сначала обновляем локально
      const optimisticEmployees = currentEmployees.map((emp: any) => {
        if (employeesToDeleteIds.includes(emp.id)) {
          // Устанавливаем end_working_date для удаляемых сотрудников
          return {
            ...emp,
            pivot: {
              ...emp.pivot,
              end_working_date: data.endDate
            },
            is_dismissed: true, // Устанавливаем флаг увольнения
            employee_status: 'dismissed' // Изменяем статус
          };
        }
        return emp;
      });

      const optimisticProject = {
        ...localProject,
        employees: optimisticEmployees
      };

      // Обновляем localProject оптимистично - таблица обновится сразу
      setLocalProject(optimisticProject);
      
      // Обновляем trackingItems оптимистично (статус изменится на "Уволен")
      const formattedEmployees = optimisticEmployees.map((employee: any) => {
        const startWorkingDate = employee.pivot?.start_working_date || null;
        const endWorkingDate = employee.pivot?.end_working_date || null;
        const daysInProject = calculateDaysInProject(startWorkingDate, endWorkingDate);
        
        // Определяем статус: если есть end_working_date, то "Удалён"
        const status = endWorkingDate ? 'Удалён' : 
                      (employee.employee_status === 'active' ? 'Работает' :
                      employee.is_dismissed ? 'Удалён' : 'Неизвестно');
        
        // Форматируем дату удаления
        const deletionDate = endWorkingDate ? 
          new Date(endWorkingDate).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }) : null;
        
        return {
          id: employee.id,
          name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
          role: employee.role || 'Не указана',
          status: status,
          deletionDate: deletionDate,
          startDate: startWorkingDate ?
                    new Date(startWorkingDate).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    }) : 'Не указана',
          days: daysInProject,
          hours: 0,
          lastHours: 0,
          rate: employee.pivot?.rate_per_hour || employee.rate_per_hour || 0,
          lastSum: 0,
          totalSum: 0
        };
      });
          
          // Сортируем: сначала активные, затем удаленные
          const sortedEmployees = formattedEmployees.sort((a: any, b: any) => {
            const aIsDeleted = a.status === 'Удалён';
            const bIsDeleted = b.status === 'Удалён';
            
            if (aIsDeleted === bIsDeleted) {
              return 0;
            }
            
            return aIsDeleted ? 1 : -1;
          });
          
          setTrackingItems(sortedEmployees);
      
      // Обновляем данные в родительском компоненте
      if (onProjectUpdate) {
        onProjectUpdate(optimisticProject);
      }
      
      // Формируем массив employee для PATCH запроса - устанавливаем end_working_date для всех выбранных
      const employeeArray = currentEmployees.map((emp: any) => {
        if (employeesToDeleteIds.includes(emp.id)) {
          // Устанавливаем дату окончания для удаляемого сотрудника
          return {
            id: emp.id,
            start_working_date: emp.pivot?.start_working_date || localProject.start_date,
            end_working_date: data.endDate,
            rate_per_hour: emp.pivot?.rate_per_hour || emp.rate_per_hour || 0
          };
        } else {
          // Сохраняем остальных сотрудников без изменений
          return {
            id: emp.id,
            start_working_date: emp.pivot?.start_working_date || localProject.start_date,
            end_working_date: emp.pivot?.end_working_date || null,
            rate_per_hour: emp.pivot?.rate_per_hour || emp.rate_per_hour || 0
          };
        }
      });

      // Ответственные бригадиры = только активные (без end_working_date)
      const foremenIds = optimisticEmployees
        .filter((emp: any) => emp.role === 'Бригадир' && !emp.pivot?.end_working_date)
        .map((emp: any) => emp.id);

      // Отправляем PATCH запрос для обновления проекта на сервере
      await apiService.updateProject(localProject.id, {
        employee: employeeArray,
        project_managers: foremenIds.length > 0 ? foremenIds : localProject.project_managers,
      });

      // После успешного PATCH делаем GET запрос для синхронизации с сервером
      // Небольшая задержка для обработки на сервере
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedProjectResponse = await apiService.getProjectById(localProject.id);
      
      if (updatedProjectResponse && updatedProjectResponse.data) {
        const serverProject = updatedProjectResponse.data;
        
        // Синхронизируем с сервером - обновляем localProject реальными данными
        if (serverProject.employees && Array.isArray(serverProject.employees)) {
          setLocalProject({
            ...serverProject,
            employees: [...serverProject.employees]
          });
          
          // Обновляем trackingItems с серверными данными
          const serverFormattedEmployees = serverProject.employees.map((employee: any) => {
            const startWorkingDate = employee.pivot?.start_working_date || null;
            const endWorkingDate = employee.pivot?.end_working_date || null;
            const daysInProject = calculateDaysInProject(startWorkingDate, endWorkingDate);
            
            // Определяем статус: если есть end_working_date, то "Уволен"
            const status = endWorkingDate ? 'Уволен' : 
                          (employee.employee_status === 'active' ? 'Работает' :
                          employee.is_dismissed ? 'Уволен' : 'Неизвестно');
            
            return {
              id: employee.id,
              name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
              role: employee.role || 'Не указана',
              status: status,
              startDate: startWorkingDate ?
                        new Date(startWorkingDate).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : 'Не указана',
              days: daysInProject,
              hours: 0,
              lastHours: 0,
              rate: employee.pivot?.rate_per_hour || employee.rate_per_hour || 0,
              lastSum: 0,
              totalSum: 0
            };
          });
          setTrackingItems(serverFormattedEmployees);
          
          // Обновляем данные в родительском компоненте
          if (onProjectUpdate) {
            onProjectUpdate(serverProject);
          }
        }
      }

      // Очищаем выбор
      setSelectedItems(new Set());
    } catch (error) {
      // Если ошибка - откатываем оптимистичное обновление
      console.error('Error deleting employee:', error);
      
      // Откатываем к предыдущему состоянию - перезагружаем проект с сервера
      try {
        const response = await apiService.getProjectById(localProject.id);
        if (response && response.data) {
          setLocalProject(response.data);
          
          // Обновляем trackingItems с серверными данными
          if (response.data.employees && Array.isArray(response.data.employees)) {
            const rolledBackFormattedEmployees = response.data.employees.map((employee: any) => {
              const startWorkingDate = employee.pivot?.start_working_date || null;
              const endWorkingDate = employee.pivot?.end_working_date || null;
              const daysInProject = calculateDaysInProject(startWorkingDate, endWorkingDate);
              
              const status = endWorkingDate ? 'Уволен' : 
                            (employee.employee_status === 'active' ? 'Работает' :
                            employee.is_dismissed ? 'Уволен' : 'Неизвестно');
              
              return {
                id: employee.id,
                name: `${employee.last_name} ${employee.first_name.charAt(0)}. ${employee.second_name.charAt(0)}.`,
                role: employee.role || 'Не указана',
                status: status,
                startDate: startWorkingDate ?
                          new Date(startWorkingDate).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }) : 'Не указана',
                days: daysInProject,
                hours: 0,
                lastHours: 0,
                rate: employee.pivot?.rate_per_hour || employee.rate_per_hour || 0,
                lastSum: 0,
                totalSum: 0
              };
            });
            setTrackingItems(rolledBackFormattedEmployees);
          }
          
          if (onProjectUpdate) {
            onProjectUpdate(response.data);
          }
        }
      } catch (rollbackError) {
        console.error('Error rolling back:', rollbackError);
      }
    }
  };

  // Обработчик выбора чекбокса для отдельного сотрудника
  const handleEmployeeCheckboxChange = (employeeId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  // Обработчик выбора всех сотрудников (чекбокс в хедере)
  const handleSelectAllEmployees = () => {
    if (selectedItems.size === trackingItems.length && trackingItems.length > 0) {
      // Снять выделение со всех
      setSelectedItems(new Set());
    } else {
      // Выбрать всех
      const allIds = new Set(trackingItems.map(item => item.id));
      setSelectedItems(allIds);
    }
  };

  // Обработчик открытия модального окна удаления
  const handleOpenDeleteModal = () => {
    if (selectedItems.size === 0) return;
    
    // Собираем всех выбранных сотрудников
    const selectedEmployees = trackingItems
      .filter(item => selectedItems.has(item.id))
      .map(item => ({
        id: item.id,
        name: item.name,
        status: item.status
      }));
    
    if (selectedEmployees.length > 0) {
      setEmployeesToDelete(selectedEmployees);
      setIsDeleteTrackingModalOpen(true);
    }
  };


  // Функция для форматирования даты в "15 дек 2025" (формат месяцев: Янв, Февр, Март, Апр, Май, Июнь, Июль, Авг, Сент, Октб, Нояб, Дек)
  const formatDateWithMonth = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const months = ['янв', 'февр', 'март', 'апр', 'май', 'июнь', 'июль', 'авг', 'сент', 'октб', 'нояб', 'дек'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Функция сортировки для спецификации
  const handleSpecificationSort = (field: string | null) => {
    if (specificationSortField === field) {
      setSpecificationSortDirection(specificationSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSpecificationSortField(field);
      setSpecificationSortDirection('asc');
    }
  };

  // Сортировка спецификации
  const sortedSpecificationItems = React.useMemo(() => {
    const sorted = [...specificationItems];
    if (specificationSortField) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (specificationSortField) {
          case 'npp':
            aValue = a.npp ?? 0;
            bValue = b.npp ?? 0;
            break;
          case 'name':
            aValue = (a.name || '').toLowerCase();
            bValue = (b.name || '').toLowerCase();
            break;
          case 'status':
            aValue = (a.status || '').toLowerCase();
            bValue = (b.status || '').toLowerCase();
            break;
          case 'unit':
            aValue = (a.unit || '').toLowerCase();
            bValue = (b.unit || '').toLowerCase();
            break;
          case 'plan':
            aValue = Number(a.plan) || 0;
            bValue = Number(b.plan) || 0;
            break;
          case 'changes':
            aValue = Number(a.changes) || 0;
            bValue = Number(b.changes) || 0;
            break;
          case 'total':
            aValue = Number(a.fact) || 0;
            bValue = Number(b.fact) || 0;
            break;
          default:
            return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return specificationSortDirection === 'asc' 
            ? aValue.localeCompare(bValue, 'ru')
            : bValue.localeCompare(aValue, 'ru');
        } else {
          return specificationSortDirection === 'asc' 
            ? aValue - bValue
            : bValue - aValue;
        }
      });
    }
    return sorted;
  }, [specificationItems, specificationSortField, specificationSortDirection]);

  // Функция сортировки для фиксации работ
  const handleTrackingSort = (field: string | null) => {
    if (trackingSortField === field) {
      setTrackingSortDirection(trackingSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setTrackingSortField(field);
      setTrackingSortDirection('asc');
    }
  };

  // Сортировка фиксации работ
  const sortedTrackingItems = React.useMemo(() => {
    const sorted = [...trackingItems];
    if (trackingSortField) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (trackingSortField) {
          case 'name':
            aValue = (a.name || '').toLowerCase();
            bValue = (b.name || '').toLowerCase();
            break;
          case 'status':
            aValue = (a.status || '').toLowerCase();
            bValue = (b.status || '').toLowerCase();
            break;
          case 'start':
            aValue = a.startWorkingDate ? new Date(a.startWorkingDate).getTime() : 0;
            bValue = b.startWorkingDate ? new Date(b.startWorkingDate).getTime() : 0;
            break;
          case 'days':
            aValue = Number(a.daysInProject) || 0;
            bValue = Number(b.daysInProject) || 0;
            break;
          case 'hours':
            aValue = Number(a.hours) || 0;
            bValue = Number(b.hours) || 0;
            break;
          case 'lastHours':
            aValue = Number(a.lastHours) || 0;
            bValue = Number(b.lastHours) || 0;
            break;
          case 'rate':
            aValue = Number(a.rate) || 0;
            bValue = Number(b.rate) || 0;
            break;
          case 'lastSum':
            aValue = Number(a.lastSum) || 0;
            bValue = Number(b.lastSum) || 0;
            break;
          case 'totalSum':
            aValue = Number(a.totalSum) || 0;
            bValue = Number(b.totalSum) || 0;
            break;
          default:
            return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return trackingSortDirection === 'asc' 
            ? aValue.localeCompare(bValue, 'ru')
            : bValue.localeCompare(aValue, 'ru');
        } else {
          return trackingSortDirection === 'asc' 
            ? aValue - bValue
            : bValue - aValue;
        }
      });
    }
    return sorted;
  }, [trackingItems, trackingSortField, trackingSortDirection]);

  // Пагинация для спецификации
  const totalPages = Math.ceil(sortedSpecificationItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = sortedSpecificationItems.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleTrackingPageChange = (page: number) => {
    setTrackingCurrentPage(page);
  };

  // Функции для работы с чекбоксами
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedItems.map(item => item.id));
      setSelectedItems(allIds);
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0 || !localProject.id) return;

    try {
      for (const itemId of selectedItems) {
        await apiService.removeNomenclature(localProject.id, itemId);
      }

      setSpecificationItems(prev => prev.filter(item => !selectedItems.has(item.id)));
      setSelectedItems(new Set());

      // Обновляем проект с сервера и синхронизируем с родителем
      const response = await apiService.getProjectById(localProject.id);
      const updatedProject = response?.data ?? response;
      if (updatedProject) {
        setLocalProject(updatedProject);
        onProjectUpdate?.(updatedProject);
      }
      await onRefresh?.();
    } catch (error) {
      // Ошибка обработана без уведомления пользователя
    }
  };

  // Функция для форматирования даты в DD/MM/YYYY
  const formatDateDDMMYYYY = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Обработчик клика на контейнер с датами
  const handleDatesContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Если клик не на самом input
    if (!target.matches('input[type="date"]')) {
      e.preventDefault();
      e.stopPropagation();
      
      const container = e.currentTarget as HTMLDivElement;
      const wrappers = container.querySelectorAll('.projects__date-display-wrapper');
      
      if (wrappers.length >= 2) {
        const firstWrapper = wrappers[0] as HTMLDivElement;
        const secondWrapper = wrappers[1] as HTMLDivElement;
        
        const firstInput = firstWrapper.querySelector('input[type="date"]') as HTMLInputElement;
        const secondInput = secondWrapper.querySelector('input[type="date"]') as HTMLInputElement;
        
        // Определяем позицию клика относительно контейнера
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const containerWidth = rect.width;
        
        // Клик в левую половину - открываем первый датапикер
        // Клик в правую половину - открываем второй датапикер
        if (x < containerWidth / 2) {
          firstInput?.focus();
          firstInput?.showPicker?.();
        } else {
          secondInput?.focus();
          secondInput?.showPicker?.();
        }
      }
    }
  };
  const displayProjectName = isEditingHeader ? editedProjectName : (localProject.name || '');
  const displayStatus = isEditingHeader ? editedStatus : localProject.status;
  const currentStatusMeta = resolveStatusMeta(displayStatus);
  const selectedStatusMeta = resolveStatusMeta(editedStatus);

  return (
    <>
      {/* Верхняя часть - отдельный блок */}
      <div className="projects__detail-top">
        <div className="projects__detail-header-row">
          {/* Заголовок, статус и последнее изменение в одной строке */}
          <div className="projects__detail-title-row">
            <div className="projects__detail-title-wrapper">
              {isEditingHeader ? (
                <input
                  type="text"
                  className="projects__detail-title-input"
                  value={editedProjectName}
                  onChange={(e) => setEditedProjectName(e.target.value)}
                  placeholder="Введите название проекта"
                />
              ) : (
                <h1 className="projects__detail-title">{displayProjectName || 'Без названия'}</h1>
              )}
            </div>
            <div className="projects__detail-status-group">
              {isEditingHeader ? (
                <div
                  className={`projects__detail-status-editor ${isStatusDropdownOpen ? 'projects__detail-status-editor--open' : ''}`}
                  ref={statusDropdownRef}
                >
                  <button
                    type="button"
                    className={`projects__detail-status-trigger ${isStatusDropdownOpen ? 'projects__detail-status-trigger--open' : ''}`}
                    onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                  >
                    <span
                      className="projects__detail-status-indicator"
                      style={{ backgroundColor: selectedStatusMeta.color }}
                    />
                    <span className="projects__detail-status-trigger-text">{editedStatus}</span>
                    <div className="projects__detail-status-trigger-arrow">
                      <img src={userDropdownIcon} alt="▼" />
                    </div>
                  </button>
                  {isStatusDropdownOpen && (
                    <div className="projects__detail-status-dropdown">
                      {EDITABLE_PROJECT_STATUS_OPTIONS.map(option => (
                        <button
                          type="button"
                          key={option.value}
                          className={`projects__detail-status-option ${option.value === editedStatus ? 'projects__detail-status-option--selected' : ''}`}
                          onClick={() => {
                            setEditedStatus(option.value);
                            setIsStatusDropdownOpen(false);
                          }}
                        >
                          <span
                            className="projects__detail-status-option-indicator"
                            style={{ backgroundColor: option.color }}
                          />
                          <span className="projects__detail-status-option-text">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`projects__status ${currentStatusMeta.className}`}>
                  <div
                    className="projects__status-dot"
                    style={{ backgroundColor: currentStatusMeta.color }}
                  ></div>
                  <span>{displayStatus || '—'}</span>
                </div>
              )}
            </div>

            <div className="projects__detail-last-update">
              Последнее изменение: {formatDateWithMonth(localProject.updated_at)}
            </div>
          </div>

          {/* Иконки действий */}
          <div className="projects__detail-actions-top">
            <div className="projects__detail-icon-buttons">
              {isEditingHeader ? (
                <div className="projects__detail-edit-actions">
                  <button
                    type="button"
                    className="projects__detail-edit-btn projects__detail-edit-btn--save"
                    onClick={handleHeaderSave}
                    disabled={isSavingHeader}
                  >
                    {isSavingHeader ? 'Сохранение...' : isNewProject ? 'Создать' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    className="projects__detail-edit-btn projects__detail-edit-btn--cancel"
                    onClick={handleHeaderCancel}
                    disabled={isSavingHeader}
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                !isNewProject && (
                  <>
                    <button className="projects__detail-icon-btn" onClick={handleStartHeaderEdit}>
                      <img src={editIcon} alt="Редактировать" />
                    </button>
                    <div className="projects__detail-dots-menu-wrapper">
                      <button 
                        className="projects__detail-icon-btn projects__detail-icon-btn--dots"
                        onClick={() => setIsDotsMenuOpen(!isDotsMenuOpen)}
                      >
                        <img src={dotsIcon} alt="Меню" />
                      </button>
                      {isDotsMenuOpen && (
                        <div className="projects__detail-dots-menu">
                          <button 
                            className="projects__detail-dots-menu-item"
                            onClick={async () => {
                              if (!localProject.id || isArchiving) return;
                              
                              setIsArchiving(true);
                              try {
                                await apiService.archiveProject(localProject.id);
                                
                                // Обновляем проект
                                const updatedProject = {
                                  ...localProject,
                                  is_archived: 1,
                                  status: 'Архив'
                                };
                                
                                setLocalProject(updatedProject);
                                
                                // Уведомляем родительский компонент об обновлении
                                if (onProjectUpdate) {
                                  onProjectUpdate(updatedProject);
                                }
                                
                                // Закрываем проект и возвращаемся к списку
                                onBack();
                              } catch (error) {
                                console.error('Error archiving project:', error);
                                alert('Ошибка при архивировании проекта. Попробуйте еще раз.');
                              } finally {
                                setIsArchiving(false);
                                setIsDotsMenuOpen(false);
                              }
                            }}
                            disabled={isArchiving}
                          >
                            {isArchiving ? 'Архивирование...' : 'Перенести в архив'}
                          </button>
                          <button 
                            className="projects__detail-dots-menu-item projects__detail-dots-menu-item--delete"
                            onClick={async () => {
                              if (!localProject.id || isDeleting) return;
                              
                              const confirmMessage = `Вы уверены, что хотите удалить проект "${localProject.name}"?`;
                              if (!confirm(confirmMessage)) {
                                return;
                              }
                              
                              setIsDeleting(true);
                              try {
                                await apiService.deleteProject(localProject.id);
                                
                                // Обновляем проект локально
                                const updatedProject = {
                                  ...localProject,
                                  is_deleted: true
                                };
                                
                                setLocalProject(updatedProject);
                                
                                // Уведомляем родительский компонент об обновлении
                                if (onProjectUpdate) {
                                  onProjectUpdate(updatedProject);
                                }
                                
                                // Закрываем проект и возвращаемся к списку
                                onBack();
                              } catch (error) {
                                console.error('Error deleting project:', error);
                              } finally {
                                setIsDeleting(false);
                                setIsDotsMenuOpen(false);
                              }
                            }}
                            disabled={isDeleting}
                          >
                            {isDeleting ? 'Удаление...' : 'Удалить'}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        </div>

        {/* Сотрудники */}
        <div className="projects__detail-employees-section">
          <div className="projects__detail-employees-label">
            <img src={sotrudnikiVProekte} alt="Сотрудники" />
            <span>Сотрудники в проекте</span>
          </div>
          <div className="projects__detail-employees-cards">
            <div className="projects__detail-employees-list">
              {(() => {
                const activeEmployees = getActiveEmployees(localProject.employees).filter((emp: any) => !isGIP(emp));
                return activeEmployees.slice(0, 3).map((emp: any) => (
                  <div key={emp.id} className="projects__detail-employee-card">
                    {emp.avatar_id || emp.avatar_url ? (
                      <img 
                        src={emp.avatar_url || `http://92.53.97.20/api/avatars/${emp.avatar_id}`} 
                        alt={`${emp.last_name} ${emp.first_name}`} 
                        className="projects__detail-employee-avatar" 
                      />
                    ) : (
                      <div 
                        className="projects__detail-employee-avatar projects__detail-employee-avatar--initials"
                        style={{ backgroundColor: getAvatarColor(`${emp.last_name} ${emp.first_name}`) }}
                      >
                        {getInitials(emp)}
                      </div>
                    )}
                    <span>{emp.last_name} {emp.first_name.charAt(0)}. {emp.second_name?.charAt(0)}.</span>
                  </div>
                ));
              })()}
            </div>
            {(() => {
              const activeEmployees = getActiveEmployees(localProject.employees).filter((emp: any) => !isGIP(emp));
              // Дополнительная фильтрация: убеждаемся, что в tooltip попадают только активные сотрудники
              const hiddenEmployees = activeEmployees
                .slice(3)
                .filter((emp: any) => !emp.pivot?.end_working_date);
              return activeEmployees.length > 3 && (
                <div 
                  className="projects__detail-employees-more"
                  onMouseEnter={() => setIsEmployeesTooltipVisible(true)}
                  onMouseLeave={() => setIsEmployeesTooltipVisible(false)}
                  style={{ position: 'relative' }}
                >
                  <span>+{activeEmployees.length - 3}</span>
                  {isEmployeesTooltipVisible && hiddenEmployees.length > 0 && (
                    <div className="projects__detail-employees-tooltip">
                      {hiddenEmployees
                        .filter((emp: any) => !emp.pivot?.end_working_date)
                        .map((emp: any) => (
                          <div key={emp.id} className="projects__detail-employees-tooltip-item">
                            {formatUserName(emp)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Нижняя строка: табы слева, бюджет справа */}
        <div className="projects__detail-tabs-row">
          {/* Табы */}
          <div className="projects__detail-tabs-top">
            <button 
              className={`projects__detail-tab ${activeTab === 'general' ? 'projects__detail-tab--active' : ''}`}
              onClick={() => {
                setActiveTab('general');
                if (project?.id) {
                  localStorage.setItem(`activeTab_${project.id}`, 'general');
                }
              }}
            >
              Общая информация
            </button>
            <button 
              className={`projects__detail-tab ${activeTab === 'specification' ? 'projects__detail-tab--active' : ''}`}
              onClick={() => {
                setActiveTab('specification');
                if (project?.id) {
                  localStorage.setItem(`activeTab_${project.id}`, 'specification');
                }
              }}
            >
              Спецификация
            </button>
            <button 
              className={`projects__detail-tab ${activeTab === 'tracking' ? 'projects__detail-tab--active' : ''}`}
              onClick={() => {
                setActiveTab('tracking');
                setTrackingCurrentPage(1); // Сбрасываем пагинацию при переключении на вкладку
                if (project?.id) {
                  localStorage.setItem(`activeTab_${project.id}`, 'tracking');
                }
              }}
            >
              Фиксация работ
            </button>
          </div>

          {/* Карточки бюджета */}
          <div className="projects__detail-budget-cards">
            <div className="projects__detail-budget-card projects__detail-budget-card--allocated">
              <span className="projects__detail-budget-label">Выделено</span>
              <div className="projects__detail-budget-value">
                {localProject.budget ? `${localProject.budget.toLocaleString('ru-RU')} ₽` : '0 ₽'}
              </div>
            </div>
            <div className="projects__detail-budget-card projects__detail-budget-card--spent">
              <span className="projects__detail-budget-label">Израсходовали</span>
              <div className="projects__detail-budget-value">
                {trackingItems.reduce((sum, item) => sum + (item.totalSum || 0), 0).toLocaleString('ru-RU')} ₽
              </div>
            </div>
            <div className="projects__detail-budget-card projects__detail-budget-card--remaining">
              <span className="projects__detail-budget-label">Остаток</span>
              <div className="projects__detail-budget-value">
                {(() => {
                  const allocated = localProject?.budget || 0;
                  const spent = trackingItems.reduce((sum, item) => sum + (item.totalSum || 0), 0);
                  const remaining = Math.max(0, allocated - spent);
                  return `${remaining.toLocaleString('ru-RU')} ₽`;
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Нижняя часть - отдельный блок с контентом */}
      <div className="projects__detail-bottom">

        {/* Контент табов - переключаемая часть */}
        <div className="projects__detail-content">
          {activeTab === 'general' && (
            <div className="projects__detail-general">
              {/* Форма - первая строка */}
              <div className="projects__detail-form-row">
                {/* Поле адреса скрыто */}
                {/* <div className="projects__form-field">
                  <label>Адрес проекта</label>
                  <input
                    type="text"
                    className="projects__form-input projects__form-input--editable"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Введите адрес проекта"
                  />
                </div> */}

                <div className="projects__form-field">
                  <label>Сроки проекта</label>
                  <div 
                    ref={datesContainerRef}
                    className="projects__form-input projects__form-input--dates"
                    onClick={handleDatesContainerClick}
                  >
                    <img src={calendarIconGrey} alt="Календарь" className="projects__form-input-icon" />
                    <div 
                      className="projects__date-display-wrapper"
                      onClick={(e) => {
                        e.stopPropagation();
                        startDateInputRef.current?.focus();
                        startDateInputRef.current?.showPicker?.();
                      }}
                    >
                      <input
                        ref={startDateInputRef}
                        type="date"
                        lang="ru"
                        className="projects__form-input--date projects__form-input--date-hidden"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                      />
                      <span className="projects__date-display">{formatDateDDMMYYYY(formData.startDate) || 'дд/мм/гггг'}</span>
                    </div>
                    <div 
                      className="projects__date-display-wrapper"
                      onClick={(e) => {
                        e.stopPropagation();
                        endDateInputRef.current?.focus();
                        endDateInputRef.current?.showPicker?.();
                      }}
                    >
                      <input
                        ref={endDateInputRef}
                        type="date"
                        lang="ru"
                        className="projects__form-input--date projects__form-input--date-hidden"
                        value={formData.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                      />
                      <span className="projects__date-display">{formatDateDDMMYYYY(formData.endDate) || 'дд/мм/гггг'}</span>
                    </div>
                  </div>
                </div>

                <div className="projects__form-field projects__form-field--foremen">
                  <label>Бригадиры</label>
                  <div className="projects__form-foremen-fields">
                    {foremen.length > 0 ? (
                      foremen.map((foreman) => (
                        <input
                          key={foreman.id}
                          type="text"
                          className="projects__form-input projects__form-input--editable"
                          value={formatUserName(foreman)}
                          readOnly
                        />
                      ))
                    ) : (
                      <input
                        type="text"
                        className="projects__form-input projects__form-input--editable"
                        value=""
                        readOnly
                      />
                    )}
                  </div>
                </div>

                <div className="projects__form-field">
                  <label>Выделено на ФОТ</label>
                  <input
                    type="text"
                    className="projects__form-input projects__form-input--editable"
                    value={formData.budget ? `${formData.budget} ₽` : ''}
                    onChange={(e) => {
                      // Убираем символ ₽, пробелы и все нечисловые символы (кроме точки для десятичных)
                      let value = e.target.value.replace(/[₽\s]/g, '').trim();
                      // Оставляем только цифры и одну точку для десятичных чисел
                      value = value.replace(/[^\d.]/g, '');
                      // Разрешаем только одну точку
                      const parts = value.split('.');
                      if (parts.length > 2) {
                        value = parts[0] + '.' + parts.slice(1).join('');
                      }
                      handleInputChange('budget', value);
                    }}
                    onBlur={() => {
                      // При потере фокуса проверяем и исправляем значение
                      const numValue = parseFloat(formData.budget);
                      if (!isNaN(numValue) && numValue < 0) {
                        handleInputChange('budget', '0');
                      }
                    }}
                    placeholder="Введите сумму"
                  />
                </div>
              </div>

              {/* Кнопки */}
              <div className="projects__detail-actions">
                <button 
                  className="projects__detail-btn projects__detail-btn--secondary"
                  onClick={handleCancel}
                >
                  Отмена
                </button>
                <button 
                  className="projects__detail-btn projects__detail-btn--primary"
                  onClick={handleSave}
                >
                  Сохранить
                </button>
              </div>
            </div>
          )}

          {activeTab === 'specification' && (
            <div className="projects__specification">
              {/* Кнопки действий */}
              <div className="projects__specification-actions">
                <button
                  className="projects__specification-btn projects__specification-btn--delete"
                  disabled={selectedItems.size === 0}
                  onClick={handleDeleteSelected}
                >
                  <img src={deleteIcon} alt="Удалить" />
                  Удалить
                </button>
                <button 
                  className="projects__specification-btn projects__specification-btn--add"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <img src={addIcon} alt="Добавить" />
                  Добавить
                </button>
                <button 
                  className="projects__specification-btn projects__specification-btn--import"
                  onClick={() => setIsImportModalOpen(true)}
                >
                  Импорт
                </button>
              </div>

              {/* Таблица спецификации */}
              <div className="projects__specification-table">
                {/* Группированный заголовок */}
                <div className="projects__specification-header-groups">
                  <div className="projects__specification-header-group"></div>
                  <div className="projects__specification-header-group"></div>
                  <div className="projects__specification-header-group"></div>
                  <div className="projects__specification-header-group"></div>
                  <div className="projects__specification-header-group"></div>
                  <div className="projects__specification-header-group">План</div>
                  <div className="projects__specification-header-group">Изменения</div>
                  <div className="projects__specification-header-group">Итого</div>
                </div>

                {/* Заголовок таблицы */}
                <div className="projects__specification-header" style={{ flexShrink: 0 }}>
                  <div className="projects__specification-header-col">
                    <input
                      type="checkbox"
                      className="projects__checkbox"
                      checked={paginatedItems.length > 0 && paginatedItems.every(item => selectedItems.has(item.id))}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </div>
                  <div 
                    className="projects__specification-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpecificationSort('npp');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>№</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${specificationSortField === 'npp' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__specification-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpecificationSort('name');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Номенклатура</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${specificationSortField === 'name' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__specification-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpecificationSort('status');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Статус</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${specificationSortField === 'status' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__specification-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpecificationSort('unit');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Ед. изм.</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${specificationSortField === 'unit' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__specification-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpecificationSort('plan');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Кол-во</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${specificationSortField === 'plan' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__specification-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpecificationSort('changes');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Кол-во</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${specificationSortField === 'changes' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>Действие</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div 
                    className="projects__specification-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpecificationSort('total');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Итого</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${specificationSortField === 'total' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                </div>

                {/* Строки таблицы */}
                <div className="projects__specification-table-body">
                {paginatedItems.map((item, index) => (
                  <div 
                    key={item.id} 
                    className={`projects__specification-row ${item.status.includes('Удалён') ? 'projects__specification-row--deleted' : ''}`}
                  >
                    <div className="projects__specification-col">
                      <input
                        type="checkbox"
                        className="projects__checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                      />
                    </div>
                    <div className="projects__specification-col">
                      <span>{item.npp ?? startIndex + index + 1}</span>
                    </div>
                    <div className="projects__specification-col">
                      <span>{item.name}</span>
                    </div>
                    <div className="projects__specification-col">
                      <span>
                        {item.status}
                      </span>
                    </div>
                    <div className="projects__specification-col">
                      <span>{item.unit}</span>
                    </div>
                    <div className="projects__specification-col">
                      <span>{Math.floor(Number(item.plan) || 0)}</span>
                    </div>
                    <div className="projects__specification-col">
                      <span>{item.changes !== null ? Math.floor(Number(item.changes)) : ''}</span>
                    </div>
                    <div className="projects__specification-col">
                      <button 
                        className="projects__specification-change-btn"
                        onClick={() => handleEditNomenclature(item)}
                      >
                        Изменить
                      </button>
                    </div>
                    <div className="projects__specification-col">
                      <span>{item.fact !== null && item.fact !== undefined ? Math.floor(Number(item.fact)).toLocaleString('ru-RU') : '0'}</span>
                    </div>
                  </div>
                ))}
                </div>
              </div>

              {/* Кнопки внизу с пагинацией */}
              <div className="projects__specification-bottom-actions" style={{ flexShrink: 0 }}>
                {/* Пагинация слева */}
                <div className="projects__specification-pagination">
                  {sortedSpecificationItems.length > itemsPerPage && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  )}
                </div>
                
              </div>
            </div>
          )}

          {activeTab === 'tracking' && (
            <div className="projects__tracking">
              {/* Кнопки действий */}
              <div className="projects__tracking-actions">
                <button 
                  className="projects__tracking-btn projects__tracking-btn--delete"
                  onClick={handleOpenDeleteModal}
                  disabled={selectedItems.size === 0}
                >
                  <img src={deleteIcon} alt="Удалить" />
                  Удалить с проекта
                </button>
                <button 
                  className="projects__tracking-btn projects__tracking-btn--add"
                  onClick={() => setIsAddTrackingModalOpen(true)}
                >
                  <img src={addIcon} alt="Добавить" />
                  Добавить
                </button>
              </div>

              {/* Таблица фиксации работ */}
              <div className="projects__tracking-table">
                {/* Заголовок таблицы */}
                <div className="projects__tracking-header" style={{ flexShrink: 0 }}>
                  <div 
                    className="projects__tracking-header-col"
                    onClick={(e) => {
                      // Не сортируем, если клик был на чекбокс
                      if ((e.target as HTMLElement).tagName === 'INPUT') {
                        return;
                      }
                      e.stopPropagation();
                      handleTrackingSort('name');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <input 
                      type="checkbox" 
                      className="projects__checkbox"
                      checked={trackingItems.length > 0 && selectedItems.size === trackingItems.length}
                      onChange={handleSelectAllEmployees}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span>ФИО</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${trackingSortField === 'name' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__tracking-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackingSort('status');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Статус</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${trackingSortField === 'status' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__tracking-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackingSort('days');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Дней</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${trackingSortField === 'days' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__tracking-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackingSort('hours');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Часов</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${trackingSortField === 'hours' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__tracking-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackingSort('lastHours');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Часов (посл.)</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${trackingSortField === 'lastHours' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__tracking-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackingSort('rate');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Ставка, руб/час</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${trackingSortField === 'rate' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__tracking-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackingSort('lastSum');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Сумма (посл.)</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${trackingSortField === 'lastSum' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                  <div 
                    className="projects__tracking-header-col"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackingSort('totalSum');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Сумма (всего)</span>
                    <img 
                      src={upDownTableFilter} 
                      alt="↑↓" 
                      className={`projects__sort-icon ${trackingSortField === 'totalSum' ? 'projects__sort-icon--active' : ''}`} 
                    />
                  </div>
                </div>

                {/* Строки таблицы */}
                <div className="projects__tracking-rows-wrapper">
                {(() => {
                  // Пагинация для trackingItems
                  const trackingStartIndex = (trackingCurrentPage - 1) * trackingItemsPerPage;
                  const trackingEndIndex = trackingStartIndex + trackingItemsPerPage;
                  const paginatedTrackingItems = sortedTrackingItems.slice(trackingStartIndex, trackingEndIndex);
                  
                  return paginatedTrackingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`projects__tracking-row ${item.status === 'Удалён' ? 'projects__tracking-row--deleted' : ''}`}
                  >
                    <div className="projects__tracking-col">
                      <input 
                        type="checkbox" 
                        className="projects__checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleEmployeeCheckboxChange(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="projects__tracking-name">
                        <div className="projects__tracking-name-main">{item.name}</div>
                        <div className="projects__tracking-name-role">{item.role}</div>
                      </div>
                    </div>
                    <div className="projects__tracking-col">
                      <div className={`projects__tracking-status ${item.status === 'Удалён' ? 'projects__tracking-status--deleted' : ''}`}>
                        <div className="projects__tracking-status-text">{item.status}</div>
                        {item.deletionDate && (
                          <div className="projects__tracking-status-date">{item.deletionDate}</div>
                        )}
                      </div>
                    </div>
                    <div className="projects__tracking-col">
                      <span>{item.days}</span>
                    </div>
                    <div className="projects__tracking-col">
                      <span>{item.hours}</span>
                    </div>
                    <div className="projects__tracking-col">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <span>{item.lastHours}</span>
                        {item.lastReport && item.lastReport.notes && item.lastReport.notes.trim() !== '' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedComment({
                                comment: item.lastReport.notes,
                                employeeName: item.name,
                                date: item.lastReport.report_date,
                              });
                              setIsCommentModalOpen(true);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            aria-label="Показать комментарий"
                          >
                            <img src={commentMobIcon} alt="Комментарий" style={{ width: '16px', height: '16px' }} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="projects__tracking-col">
                      <span>{item.rate.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="projects__tracking-col">
                      <span>{item.lastSum.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="projects__tracking-col">
                      <span>{item.totalSum.toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>
                  ));
                })()}
                </div>
              </div>

              {/* Итого */}
              <div className="projects__tracking-total" style={{ flexShrink: 0 }}>
                <div className="projects__tracking-total-row">
                  <div className="projects__tracking-total-label">Итого</div>
                  <div className="projects__tracking-total-value">
                    {trackingItems.reduce((sum, item) => sum + item.totalSum, 0).toLocaleString('ru-RU')} ₽
                  </div>
                </div>
                
                {/* Пагинация снизу справа */}
                <div className="projects__tracking-total-pagination">
                  {(() => {
                    const trackingTotalPages = Math.ceil(sortedTrackingItems.length / trackingItemsPerPage);
                    return trackingTotalPages > 1 && (
                      <Pagination
                        currentPage={trackingCurrentPage}
                        totalPages={trackingTotalPages}
                        onPageChange={handleTrackingPageChange}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddNomenclatureModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddNomenclature}
        projectId={localProject.id}
        existingNomenclatureIds={specificationItems.map(item => item.id)}
      />

      <EditNomenclatureModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
          setNomenclatureHistory([]);
        }}
        onEdit={handleSaveEdit}
        initialData={editingItem ? {
          nomenclature: editingItem.name,
          changeDate: new Date().toISOString().split('T')[0], // Формат YYYY-MM-DD для date input
          quantity: editingItem.changes || editingItem.plan
        } : undefined}
        historyData={nomenclatureHistory}
      />

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
        projectId={localProject.id || 0}
      />

      <AddTrackingModal
        isOpen={isAddTrackingModalOpen}
        onClose={() => setIsAddTrackingModalOpen(false)}
        onAdd={handleAddTracking}
        employees={allEmployees}
        projectEmployees={localProject.employees || []}
      />

      <DeleteTrackingModal
        isOpen={isDeleteTrackingModalOpen}
        onClose={() => {
          setIsDeleteTrackingModalOpen(false);
          setEmployeesToDelete([]);
        }}
        onDelete={handleDeleteTracking}
        employees={employeesToDelete}
      />

      {selectedComment && (
        <CommentModal
          isOpen={isCommentModalOpen}
          onClose={() => {
            setIsCommentModalOpen(false);
            setSelectedComment(null);
          }}
          comment={selectedComment.comment}
          employeeName={selectedComment.employeeName}
          date={selectedComment.date}
        />
      )}
    </>
  );
};

