import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { apiService } from '../../services/api';
import { canCreateProject, isPTOEngineer } from '../../services/permissions';
import { unwrapCreatedProject } from '../../utils/unwrapApiEntity';
import { fetchAllProjectPages } from '../../utils/projectPages';
import { ProjectDetail } from './ProjectDetail';
import menuIconGreyRaw from '../../shared/icons/menuIconGrey.svg?raw';
import searchIconRaw from '../../shared/icons/searchIcon.svg?raw';
import upDownTableFilterRaw from '../../shared/icons/upDownTableFilter.svg?raw';
import brigadirIconRaw from '../../shared/icons/brigadirIcon.svg?raw';

const toDataUrl = (raw: string) => `data:image/svg+xml,${encodeURIComponent(raw)}`;
const menuIconGrey = toDataUrl(menuIconGreyRaw);
const searchIcon = toDataUrl(searchIconRaw);
const upDownTableFilter = toDataUrl(upDownTableFilterRaw);
const brigadirIcon = toDataUrl(brigadirIconRaw);
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import StatusFilter from '../../shared/ui/StatusFilter/StatusFilter';
import { Pagination } from '../../shared/ui/Pagination/Pagination';
import './projects.scss';

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

// Функция для форматирования имени пользователя
const formatUserName = (user: any) => {
  if (!user) return '';
  const { first_name, second_name, last_name } = user;
  const firstNameInitial = first_name ? first_name.charAt(0).toUpperCase() : '';
  const secondNameInitial = second_name ? second_name.charAt(0).toUpperCase() : '';
  const lastName = last_name || '';
  return `${lastName} ${firstNameInitial}${secondNameInitial ? `.${secondNameInitial}.` : '.'}`.trim();
};

type ProjectsScreenProps = {
  onLogout?: () => void;
};

type ProjectHistoryEntry = number | 'new' | null;

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ onLogout }) => {
  const navigate = useNavigate();
  const params = useParams();

  const selectedProjectId: number | null = params['*']
    ? (() => {
        const seg = params['*'].split('/')[0];
        if (seg === 'new') return null;
        const parsed = parseInt(seg, 10);
        return isNaN(parsed) ? null : parsed;
      })()
    : null;

  const isCreatingFromUrl = params['*'] === 'new';

  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<ProjectHistoryEntry[]>(() => {
    return selectedProjectId ? [null, selectedProjectId] : [null];
  });
  const [historyIndex, setHistoryIndex] = useState(() => {
    return selectedProjectId ? 1 : 0;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 11;
  const [isCreatingProject, setIsCreatingProject] = useState(isCreatingFromUrl);
  const [hoveredProjectId, setHoveredProjectId] = useState<number | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number } | null>(null);
  const [tooltipEmployees, setTooltipEmployees] = useState<any[]>([]);
  const tooltipCloseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipProjectFetchRef = React.useRef<number | null>(null);

  const clearCloseTimeout = React.useCallback(() => {
    if (tooltipCloseTimeoutRef.current) {
      clearTimeout(tooltipCloseTimeoutRef.current);
      tooltipCloseTimeoutRef.current = null;
    }
  }, []);

  const scheduleTooltipClose = React.useCallback(() => {
    clearCloseTimeout();
    tooltipCloseTimeoutRef.current = setTimeout(() => {
      setHoveredProjectId(null);
      setTooltipAnchor(null);
      setTooltipEmployees([]);
      tooltipCloseTimeoutRef.current = null;
    }, 150);
  }, [clearCloseTimeout]);

  const updateTooltipPosition = React.useCallback((el: HTMLElement, employees: any[]) => {
    const rect = el.getBoundingClientRect();
    setTooltipAnchor({ x: rect.left + rect.width / 2, y: rect.top });
    setTooltipEmployees(employees);
  }, []);

  const handleTooltipMouseEnter = React.useCallback((projectId: number, employees: any[], e: React.MouseEvent) => {
    clearCloseTimeout();
    setHoveredProjectId(projectId);
    updateTooltipPosition(e.currentTarget as HTMLElement, employees);
  }, [updateTooltipPosition, clearCloseTimeout]);

  const handleTooltipMouseLeave = React.useCallback(() => {
    scheduleTooltipClose();
  }, [scheduleTooltipClose]);

  useEffect(() => () => {
    if (tooltipCloseTimeoutRef.current) {
      clearTimeout(tooltipCloseTimeoutRef.current);
    }
  }, []);

  // Состояние для сортировки
  const [sortField, setSortField] = useState<string | null>(null); // null = сортировка по дате добавления (по умолчанию)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // по умолчанию по убыванию

  const isProjectArchived = (project: any) =>
    project.is_archived === 1 ||
    project.is_archived === true ||
    project.status === 'Архив' ||
    project.status === 'archived';

  const currentUser = apiService.getCurrentUser();
  const isBrigadier = (currentUser?.role || currentUser?.position) === 'Бригадир';
  const hideFotColumn = isPTOEngineer(currentUser);
  const projectsFetchKey = isBrigadier && currentUser?.id ? `m:${currentUser.id}` : 'all';

  const loadAllProjects = React.useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading !== false;
    if (showLoading) setIsLoading(true);
    try {
      /** Не 100: при большом per_page бэкенд иногда отдаёт массив без last_page — остаётся одна «порция» (~15). */
      const perPage = 15;
      const cu = apiService.getCurrentUser();
      const brig = (cu?.role || cu?.position) === 'Бригадир';
      const filter = brig && cu?.id ? { filter: { manager_id: [cu.id] } } : undefined;
      const all = await fetchAllProjectPages(
        (p, pp) =>
          apiService.getProjects(p, pp, {
            ...filter,
            with: ['employees', 'logs'],
          }),
        perPage
      );
      setProjects(all);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllProjects();
  }, [projectsFetchKey, loadAllProjects]);

  useEffect(() => {
    if (hideFotColumn && sortField === 'spent') {
      setSortField(null);
    }
  }, [hideFotColumn, sortField]);

  const calculateTotalSpent = (project: any): number => {
    const budgetBalance = project?.budget_balance;
    const budget = project?.budget;
    if (Number.isFinite(Number(budget)) && Number.isFinite(Number(budgetBalance))) {
      const spent = Number(budget) - Number(budgetBalance);
      return spent > 0 ? spent : 0;
    }

    const spentCandidates = [
      project?.total_spent,
      project?.spent,
      project?.budget_spent,
    ];
    const spentCandidate = spentCandidates.find((value) => Number.isFinite(Number(value)));
    if (spentCandidate != null) {
      return Number(spentCandidate) || 0;
    }

    // Fallback: если бэкенд возвращает список tracking_items (иногда в других ключах)
    const trackingItems = project?.tracking_items ?? project?.trackingItems;
    if (Array.isArray(trackingItems)) {
      const fromTrackingItems = trackingItems.reduce(
        (acc: number, item: any) => acc + (Number(item?.total_sum) || 0),
        0
      );
      if (Number.isFinite(fromTrackingItems)) return fromTrackingItems;
    }

    return 0;
  };

  // Фильтрация проектов по статусу и поиску (клиентская, пока сервер не поддерживает)
  const filteredProjects = projects.filter((project) => {
    // Исключаем удаленные проекты
    if (project.is_deleted === true || project.is_deleted === 1) {
      return false;
    }
    
    // Фильтр по статусу
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'Архив') {
      matchesStatus = isProjectArchived(project);
    } else {
      // Для остальных статусов проверяем project.status
      matchesStatus = project.status === statusFilter;
    }
    
    // Фильтр по поиску
    let matchesSearch = false;
    if (searchValue === '') {
      matchesSearch = true;
    } else {
      const searchLower = searchValue.toLowerCase().trim();
      
      // Поиск по ID
      if (project.id.toString().includes(searchValue)) {
        matchesSearch = true;
      }
      // Поиск по наименованию
      else if (project.name && project.name.toLowerCase().includes(searchLower)) {
        matchesSearch = true;
      }
      // Поиск по ФИО ответственного бригадира
      else if (project.employees && Array.isArray(project.employees)) {
        const activeEmployees = project.employees.filter((emp: any) => !emp.pivot?.end_working_date);
        const foreman = activeEmployees.find((emp: any) => emp.role === 'Бригадир');
        
        if (foreman) {
          const foremanFullName = `${foreman.last_name || ''} ${foreman.first_name || ''} ${foreman.second_name || ''}`.toLowerCase().trim();
          const foremanInitials = `${foreman.last_name || ''} ${foreman.first_name?.charAt(0) || ''}.${foreman.second_name?.charAt(0) ? ` ${foreman.second_name.charAt(0)}.` : ''}`.toLowerCase().trim();
          
          if (foremanFullName.includes(searchLower) || foremanInitials.includes(searchLower)) {
            matchesSearch = true;
          }
        }
        
        // Поиск по ФИО любого сотрудника
        if (!matchesSearch && activeEmployees.length > 0) {
          const foundEmployee = activeEmployees.find((emp: any) => {
            const employeeFullName = `${emp.last_name || ''} ${emp.first_name || ''} ${emp.second_name || ''}`.toLowerCase().trim();
            const employeeInitials = `${emp.last_name || ''} ${emp.first_name?.charAt(0) || ''}.${emp.second_name?.charAt(0) ? ` ${emp.second_name.charAt(0)}.` : ''}`.toLowerCase().trim();
            
            return employeeFullName.includes(searchLower) || employeeInitials.includes(searchLower);
          });
          
          if (foundEmployee) {
            matchesSearch = true;
          }
        }
      }
    }
    
    return matchesStatus && matchesSearch;
  });

  // Функция сортировки проектов
  const getSortedProjects = () => {
    const sorted = [...filteredProjects];
    
    sorted.sort((a: any, b: any) => {
      const archA = isProjectArchived(a) ? 1 : 0;
      const archB = isProjectArchived(b) ? 1 : 0;
      if (archA !== archB) {
        return archA - archB;
      }

      // Если sortField === null, сортируем по дате добавления (по умолчанию)
      if (sortField === null) {
        // Сортируем по ID (по дате добавления) по убыванию по умолчанию
        const aValue = a.id || a.created_at || 0;
        const bValue = b.id || b.created_at || 0;
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
          aValue = (a.name || '').toLowerCase();
          bValue = (b.name || '').toLowerCase();
          if (sortDirection === 'desc') {
            return bValue.localeCompare(aValue, 'ru');
          } else {
            return aValue.localeCompare(bValue, 'ru');
          }
          
        case 'status':
          aValue = (a.status || '').toLowerCase();
          bValue = (b.status || '').toLowerCase();
          if (sortDirection === 'desc') {
            return bValue.localeCompare(aValue, 'ru');
          } else {
            return aValue.localeCompare(bValue, 'ru');
          }
          
        case 'dates':
          // Сортируем по дате начала
          aValue = a.start_date ? new Date(a.start_date).getTime() : 0;
          bValue = b.start_date ? new Date(b.start_date).getTime() : 0;
          return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
          
        case 'foreman':
          // Получаем имя бригадира
          const getForemanName = (project: any) => {
            const activeEmployees = (project.employees || []).filter((emp: any) => !emp.pivot?.end_working_date);
            const foreman = activeEmployees.find((emp: any) => emp.role === 'Бригадир');
            if (foreman) {
              return `${foreman.last_name || ''} ${foreman.first_name || ''} ${foreman.second_name || ''}`.toLowerCase();
            }
            return '';
          };
          aValue = getForemanName(a);
          bValue = getForemanName(b);
          if (sortDirection === 'desc') {
            return bValue.localeCompare(aValue, 'ru');
          } else {
            return aValue.localeCompare(bValue, 'ru');
          }
          
        case 'employees':
          // Сортируем по количеству активных сотрудников
          const getActiveEmployeesCount = (project: any) => {
            return (project.employees || []).filter((emp: any) => !emp.pivot?.end_working_date).length;
          };
          aValue = getActiveEmployeesCount(a);
          bValue = getActiveEmployeesCount(b);
          return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
          
        case 'spent':
          // Сортируем по расходу ФОТ
          aValue = calculateTotalSpent(a);
          bValue = calculateTotalSpent(b);
          return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
          
        default:
          return 0;
      }
    });
    
    return sorted;
  };

  const sortedProjects = getSortedProjects();

  const totalPagesCalculated = Math.max(1, Math.ceil(sortedProjects.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPagesCalculated) {
      setCurrentPage(totalPagesCalculated);
    }
  }, [currentPage, totalPagesCalculated]);

  const paginatedProjects = sortedProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Обработчик клика на значок сортировки
  const handleSort = (field: string | null) => {
    if (sortField === field) {
      // Если кликнули по уже активному полю, меняем направление сортировки
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Если кликнули по новому полю, устанавливаем его и направление сортировки
      setSortField(field);
      // Для текстовых полей - по возрастанию (А-Я), для числовых - по убыванию
      if (field === 'name' || field === 'status' || field === 'foreman') {
        setSortDirection('asc');
      } else {
        setSortDirection('desc');
      }
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Сбрасываем страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchValue]);

  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  // Загружаем полные данные проекта при выборе
  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (selectedProjectId) {
        // Пропускаем fetch, если данные только что пришли от ProjectDetail (добавление/удаление сотрудника и т.д.)
        if (skipProjectFetchRef.current === selectedProjectId) {
          skipProjectFetchRef.current = null;
          return;
        }
        // Сначала показываем данные из локального списка (если есть) для мгновенного отображения
        const localProject = projects.find(p => p.id === selectedProjectId);
        if (localProject) {
          setSelectedProject(localProject);
        }
        
        setIsLoadingProject(true);
        try {
          // Параллельно загружаем полные данные с сервера
          const response = await apiService.getProjectById(selectedProjectId);
          
          if (response && response.data) {
            setSelectedProject(response.data);
          } else if (response) {
            setSelectedProject(response);
          } else if (!localProject) {
            // Если не удалось загрузить с сервера и нет локальных данных
            setSelectedProject(null);
          }
        } catch (error) {
          console.error('Error fetching project details:', error);
          // Если ошибка и нет локальных данных, очищаем
          if (!localProject) {
            setSelectedProject(null);
          }
        } finally {
          setIsLoadingProject(false);
          setIsCreatingProject(false);
        }
      } else if (!isCreatingProject) {
        setSelectedProject(null);
      }
    };

    fetchProjectDetails();
  }, [selectedProjectId, projects, isCreatingProject]);

  // Функция для навигации с сохранением истории
  const navigateToProject = (projectId: ProjectHistoryEntry) => {
    const newHistory = navigationHistory.slice(0, historyIndex + 1);
    newHistory.push(projectId);
    setNavigationHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    if (projectId === 'new') {
      startProjectCreation();
      navigate('/projects/new');
    } else if (typeof projectId === 'number' && projectId) {
      setIsCreatingProject(false);
      navigate(`/projects/${projectId}`);
    } else {
      setIsCreatingProject(false);
      navigate('/projects');
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevEntry = navigationHistory[newIndex];

      if (prevEntry === 'new') {
        startProjectCreation();
        navigate('/projects/new');
      } else if (typeof prevEntry === 'number' && prevEntry) {
        setIsCreatingProject(false);
        navigate(`/projects/${prevEntry}`);
      } else {
        setIsCreatingProject(false);
        setSelectedProject(null);
        navigate('/projects');
      }
    }
  };

  const handleForward = () => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextEntry = navigationHistory[newIndex];

      if (nextEntry === 'new') {
        startProjectCreation();
        navigate('/projects/new');
      } else if (typeof nextEntry === 'number' && nextEntry) {
        setIsCreatingProject(false);
        navigate(`/projects/${nextEntry}`);
      } else {
        setIsCreatingProject(false);
        setSelectedProject(null);
        navigate('/projects');
      }
    }
  };

  const createEmptyProjectDraft = () => {
    const isBrigadier = (currentUser?.role || currentUser?.position) === 'Бригадир';
    return {
      id: null,
      name: '',
      status: 'Новый',
      start_date: '',
      end_date: '',
      address: '',
      description: '',
      budget: '',
      project_managers: isBrigadier && currentUser?.id ? [currentUser.id] : [] as number[],
      employees: [],
      nomenclature: [],
    };
  };

  const startProjectCreation = () => {
    const draftProject = createEmptyProjectDraft();
    setIsCreatingProject(true);
    setSelectedProject(draftProject);
    setIsLoadingProject(false);
  };

  useEffect(() => {
    if (isCreatingFromUrl && !isCreatingProject) {
      startProjectCreation();
    } else if (!isCreatingFromUrl && isCreatingProject) {
      setIsCreatingProject(false);
    }
  }, [isCreatingFromUrl]);

  const handleStartCreateProject = () => {
    const newHistory = navigationHistory.slice(0, historyIndex + 1);
    newHistory.push('new');
    setNavigationHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    startProjectCreation();
    navigate('/projects/new');
  };

  const handleProjectUpdate = async (updatedProject: any) => {
    // Если проект был удален, обновляем список с сервера
    if (updatedProject.is_deleted === true || updatedProject.is_deleted === 1) {
      try {
        await loadAllProjects();
      } catch (error) {
        console.error('Error refreshing projects after delete:', error);
        // В случае ошибки обновляем локально
        setProjects(prevProjects => 
          prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p)
        );
      }
    } else {
      // Обновляем проект в списке
      setProjects(prevProjects => 
        prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p)
      );
      // Обновляем выбранный проект, если это он (ребёнок уже загрузил полные данные — избегаем дубль GET)
      if (selectedProject && selectedProject.id === updatedProject.id) {
        setSelectedProject(updatedProject);
        skipProjectFetchRef.current = updatedProject.id;
      }
    }
  };

  const handleRefreshProject = async () => {
    if (selectedProjectId) {
      try {
        const response = await apiService.getProjectById(selectedProjectId);
        const updatedProject = response?.data ?? response;
        if (updatedProject) {
          handleProjectUpdate(updatedProject);
        }
      } catch (e) {
        console.error('Ошибка обновления проекта:', e);
      }
    }
  };

  // Обработчик выбора/снятия выбора проекта
  const handleProjectSelect = (projectId: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const isArchived = project.is_archived === 1 || project.is_archived === true || project.status === 'Архив';
    
    setSelectedProjectIds(prev => {
      const newSet = new Set(prev);
      
      // Если проект уже выбран, просто снимаем выбор
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
        return newSet;
      }
      
      // Проверяем, есть ли уже выбранные проекты
      if (newSet.size > 0) {
        // Проверяем, все ли выбранные проекты имеют такой же статус архивации
        const selectedProjects = Array.from(newSet).map(id => projects.find(p => p.id === id)).filter(Boolean);
        const hasArchived = selectedProjects.some(p => p.is_archived === 1 || p.is_archived === true || p.status === 'Архив');
        const hasNonArchived = selectedProjects.some(p => !(p.is_archived === 1 || p.is_archived === true || p.status === 'Архив'));
        
        // Если пытаемся выбрать архивный проект, а уже выбраны неархивные - запрещаем
        if (isArchived && hasNonArchived) {
          alert('Нельзя одновременно выбрать архивированные и неархивированные проекты. Снимите выбор с неархивированных проектов.');
          return prev;
        }
        
        // Если пытаемся выбрать неархивный проект, а уже выбраны архивные - запрещаем
        if (!isArchived && hasArchived) {
          alert('Нельзя одновременно выбрать архивированные и неархивированные проекты. Снимите выбор с архивированных проектов.');
          return prev;
        }
      }
      
      newSet.add(projectId);
      return newSet;
    });
  };

  // Обработчик выбора/снятия выбора всех проектов
  const handleSelectAll = (event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    const filteredProjects = sortedProjects; // Используем уже отфильтрованные и отсортированные проекты
    const filteredProjectIds = filteredProjects.map(p => p.id);
    
    // Проверяем, все ли проекты уже выбраны
    const allSelected = filteredProjectIds.length > 0 && 
                       filteredProjectIds.every(id => selectedProjectIds.has(id));
    
    if (allSelected) {
      // Снять выделение со всех
      setSelectedProjectIds(new Set());
    } else {
      // Выбрать всех (включая архивные, если они в фильтре)
      setSelectedProjectIds(new Set(filteredProjectIds));
    }
  };

  // Функция архивирования/снятия с архива выбранных проектов
  const handleArchiveProjects = async () => {
    if (selectedProjectIds.size === 0) return;

    const selectedIdsArray = Array.from(selectedProjectIds);
    
    // Определяем, какие проекты архивные, а какие нет
    const selectedProjects = selectedIdsArray.map(id => projects.find(p => p.id === id)).filter(Boolean);
    const archivedProjects = selectedProjects.filter(p => p.is_archived === 1 || p.is_archived === true || p.status === 'Архив');
    const nonArchivedProjects = selectedProjects.filter(p => !(p.is_archived === 1 || p.is_archived === true || p.status === 'Архив'));
    
    // Проверяем на смешанный выбор
    if (archivedProjects.length > 0 && nonArchivedProjects.length > 0) {
      alert('Нельзя одновременно архивировать и снимать с архива проекты. Выберите только архивированные или только неархивированные проекты.');
      return;
    }

    setIsArchiving(true);
    try {
      // Используем один и тот же метод archiveProject для архивирования и разархивирования
      // Бэкенд сам определяет, нужно ли архивировать или разархивировать
      const allSelectedProjects = selectedIdsArray.map(id => projects.find(p => p.id === id)).filter(Boolean);
      const archivePromises = allSelectedProjects.map(project => 
        apiService.archiveProject(project.id)
      );
      
      await Promise.all(archivePromises);
      
      try {
        await loadAllProjects();
      } catch (error) {
        console.error('Error refreshing projects after archive/unarchive:', error);
        // В случае ошибки обновляем локально
        const updatedProjects = projects.map(project => {
          if (selectedProjectIds.has(project.id)) {
            const isCurrentlyArchived = project.is_archived === 1 || project.is_archived === true || project.status === 'Архив';
            
            if (isCurrentlyArchived) {
              return { ...project, is_archived: 0 };
            } else {
              return { ...project, is_archived: 1, status: 'Архив' };
            }
          }
          return project;
        });
        setProjects(updatedProjects);
      }
      
      // Если архивируемый проект открыт, закрываем его
      if (selectedProject && selectedProjectIds.has(selectedProject.id)) {
        const isCurrentlyArchived = selectedProject.is_archived === 1 || selectedProject.is_archived === true || selectedProject.status === 'Архив';
        if (!isCurrentlyArchived) {
          navigate('/projects');
        }
      }
      
      // Очищаем выбор
      setSelectedProjectIds(new Set());
    } catch (error) {
      console.error('Error archiving/unarchiving projects:', error);
      alert('Ошибка при выполнении операции. Попробуйте еще раз.');
    } finally {
      setIsArchiving(false);
    }
  };
  
  // Определяем текст кнопки и действие
  const getArchiveButtonText = () => {
    if (selectedProjectIds.size === 0) {
      return 'Перенести в архив';
    }
    
    const selectedProjects = Array.from(selectedProjectIds)
      .map(id => projects.find(p => p.id === id))
      .filter(Boolean);
    
    const hasArchived = selectedProjects.some(p => p.is_archived === 1 || p.is_archived === true || p.status === 'Архив');
    
    if (isArchiving) {
      return hasArchived ? 'Снятие с архива...' : 'Архивирование...';
    }
    
    return hasArchived ? 'Убрать из архива' : 'Перенести в архив';
  };

  const isDetailView = selectedProject && !(selectedProject.is_archived === 1 || selectedProject.is_archived === true) && !isLoadingProject;

  return (
    <div className={`projects ${isDetailView ? 'projects--detail-view' : ''}`}>
      <PageHeader
        categoryIcon={!selectedProject ? menuIconGrey : undefined}
        categoryLabel={!selectedProject ? "Проекты" : undefined}
        breadcrumb={selectedProject ? [
          { icon: menuIconGrey, label: "Проекты", onClick: () => navigateToProject(null) },
          { label: `№ ${selectedProject.id} ${selectedProject.name}` }
        ] : undefined}
        showPagination={true}
        onBack={handleBack}
        onForward={handleForward}
        backDisabled={historyIndex === 0}
        forwardDisabled={historyIndex === navigationHistory.length - 1}
        createButtonText={!selectedProject ? "Создать" : undefined}
        onCreate={!selectedProject ? () => {
          if (!canCreateProject(apiService.getCurrentUser())) {
            alert('Недостаточно прав');
            return;
          }
          handleStartCreateProject();
        } : undefined}
        userName="Гиламанов Т.Р."
        onLogout={onLogout}
      />

      {!selectedProject ? (
        <div className="projects__content">
          <div className="projects__toolbar">
          <div className="projects__filters">
            <StatusFilter onStatusChange={(status) => setStatusFilter(status)} />

            <div className="projects__search">
              <img src={searchIcon} alt="Поиск" className="projects__search-icon" />
              <input
                type="text"
                className="projects__search-input"
                placeholder="Поиск"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
          </div>

          <button 
            className="projects__archive-btn"
            onClick={handleArchiveProjects}
            disabled={isArchiving || selectedProjectIds.size === 0}
          >
            {getArchiveButtonText()}
          </button>
        </div>

        <div className="projects__table">
          <div className="projects__table-header">
            <div 
              className="projects__table-header-col"
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
                className="projects__checkbox"
                checked={(() => {
                  const filteredProjectIds = sortedProjects.map(p => p.id);
                  return filteredProjectIds.length > 0 && 
                         filteredProjectIds.every(id => selectedProjectIds.has(id));
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
                className={`projects__sort-icon ${sortField === 'id' ? 'projects__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="projects__table-header-col"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('name');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Наименование</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'name' ? 'projects__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="projects__table-header-col"
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
                className={`projects__sort-icon ${sortField === 'status' ? 'projects__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="projects__table-header-col"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('dates');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Сроки</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'dates' ? 'projects__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="projects__table-header-col"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('foreman');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Ответ. бригадир</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'foreman' ? 'projects__sort-icon--active' : ''}`}
              />
            </div>
            <div 
              className="projects__table-header-col"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('employees');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Сотрудники</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'employees' ? 'projects__sort-icon--active' : ''}`}
              />
            </div>
            {!hideFotColumn && (
            <div 
              className="projects__table-header-col"
              onClick={(e) => {
                e.stopPropagation();
                handleSort('spent');
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Расход ФОТ</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'spent' ? 'projects__sort-icon--active' : ''}`}
              />
            </div>
            )}
          </div>

          {/* Строки таблицы */}
          {isLoading ? (
            <div className="projects__loading">Загрузка...</div>
          ) : sortedProjects.length === 0 ? (
            <div className="projects__empty">
              {projects.length === 0 ? 'Нет проектов' : 'Нет проектов с такими параметрами'}
            </div>
          ) : (
            paginatedProjects.map((project) => {
              const isArchived = isProjectArchived(project);
              const statusClassNames = [
                'projects__status',
                project.status === 'Новый' ? 'projects__status--new' : '',
                project.status === 'В работе' ? 'projects__status--in-progress' : '',
                project.status === 'Завершен' ? 'projects__status--completed' : '',
                isArchived ? 'projects__status--archived' : '',
              ].filter(Boolean).join(' ');
              const statusLabel = isArchived ? 'Архив' : project.status || '—';
              return (
                <div 
                key={project.id} 
                className={`projects__table-row ${isArchived ? 'projects__table-row--archived' : ''}`}
                onClick={(e) => {
                  // Не переходим в проект, если кликнули на чекбокс
                  if ((e.target as HTMLElement).closest('.projects__checkbox')) {
                    return;
                  }
                  // Не переходим в архивный проект
                  if (!isArchived) {
                    navigateToProject(project.id);
                  }
                }}
              >
                <div className="projects__table-row-col">
                  <input 
                    type="checkbox" 
                    className="projects__checkbox"
                    checked={selectedProjectIds.has(project.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleProjectSelect(project.id, e as any);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>{project.id}</span>
                </div>
                <div className="projects__table-row-col">
                  <span>{project.name}</span>
                </div>
                <div className="projects__table-row-col">
                  <div className={statusClassNames}>
                    <div className="projects__status-dot"></div>
                    <span>{statusLabel}</span>
                  </div>
                </div>
                <div className="projects__table-row-col">
                  <div className="projects__dates">
                    <div className="projects__date-item">
                      <span className="projects__year">{new Date(project.start_date).getFullYear()}</span>
                      <span className="projects__year">{new Date(project.end_date).getFullYear()}</span>
                    </div>
                    <span className="projects__period">
                      {new Date(project.start_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - {new Date(project.end_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <div className="projects__table-row-col">
                  <div className="projects__foreman">
                    {(() => {
                      // Фильтруем только активных (не удаленных) бригадиров
                      const activeEmployees = (project.employees || []).filter((emp: any) => !emp.pivot?.end_working_date);
                      const foreman = activeEmployees.find((emp: any) => emp.role === 'Бригадир');
                      if (foreman) {
                        return (
                          <>
                            {foreman.avatar_id || foreman.avatar_url ? (
                              <img 
                                src={foreman.avatar_url || `http://92.53.97.20/api/avatars/${foreman.avatar_id}`} 
                                alt={`${foreman.last_name} ${foreman.first_name}`} 
                                className="projects__foreman-avatar" 
                              />
                            ) : (
                              <img src={brigadirIcon} alt="—" className="projects__foreman-avatar" />
                            )}
                            <span>
                              {(() => {
                                const firstNameInitial = foreman.first_name ? foreman.first_name.charAt(0).toUpperCase() : '';
                                const secondNameInitial = foreman.second_name ? foreman.second_name.charAt(0).toUpperCase() : '';
                                return `${foreman.last_name} ${firstNameInitial}.${secondNameInitial ? ` ${secondNameInitial}.` : ''}`;
                              })()}
                            </span>
                          </>
                        );
                      }
                      return (
                        <>
                          <img src={brigadirIcon} alt="—" className="projects__foreman-avatar" />
                          <span>—</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="projects__table-row-col">
                  <div className="projects__employees">
                    {(() => {
                      // Фильтруем только активных (не удаленных) сотрудников
                      const activeEmployees = (project.employees || []).filter((emp: any) => !emp.pivot?.end_working_date);
                      return (
                        <>
                          <div className="projects__employee-avatars">
                            {activeEmployees.slice(0, 3).map((emp: any) => (
                              emp.avatar_id || emp.avatar_url ? (
                                <img 
                                  key={emp.id} 
                                  src={emp.avatar_url || `http://92.53.97.20/api/avatars/${emp.avatar_id}`} 
                                  alt={`${emp.last_name} ${emp.first_name}`} 
                                  className="projects__employee-avatar" 
                                />
                              ) : (
                                <div 
                                  key={emp.id}
                                  className="projects__employee-avatar projects__employee-avatar--initials"
                                  style={{ backgroundColor: getAvatarColor(`${emp.last_name} ${emp.first_name}`) }}
                                >
                                  {getInitials(emp)}
                                </div>
                              )
                            ))}
                          </div>
                          {activeEmployees.length > 3 && (
                            <div 
                              className="projects__employee-count"
                              onMouseEnter={(e) => handleTooltipMouseEnter(
                                project.id,
                                activeEmployees.slice(3).filter((emp: any) => !emp.pivot?.end_working_date),
                                e
                              )}
                              onMouseLeave={handleTooltipMouseLeave}
                              style={{ position: 'relative' }}
                            >
                              <span>+{activeEmployees.length - 3} Сотр.</span>
                              {hoveredProjectId === project.id && tooltipAnchor && tooltipEmployees.length > 0 && ReactDOM.createPortal(
                                <div 
                                  className="projects__employees-tooltip projects__employees-tooltip--portal"
                                  style={{
                                    position: 'fixed',
                                    left: tooltipAnchor.x,
                                    bottom: typeof window !== 'undefined' ? window.innerHeight - tooltipAnchor.y + 8 : undefined,
                                    transform: 'translateX(-50%)',
                                  }}
                                  onMouseEnter={clearCloseTimeout}
                                  onMouseLeave={handleTooltipMouseLeave}
                                >
                                  {tooltipEmployees.map((emp: any) => (
                                    <div key={emp.id} className="projects__employees-tooltip-item">
                                      {formatUserName(emp)}
                                    </div>
                                  ))}
                                </div>,
                                document.body
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                {!hideFotColumn && (
                <div className="projects__table-row-col">
                  <div className="projects__budget">
                    <div className="projects__budget-remaining">
                      <span className="projects__budget-label">Осталось:</span>
                      <span className="projects__budget-amount">
                        {(() => {
                          const budgetBalance = (project as { budget_balance?: number })?.budget_balance;
                          if (budgetBalance != null && Number.isFinite(Number(budgetBalance))) {
                            return `${Number(budgetBalance).toLocaleString('ru-RU')} ₽`;
                          }
                          const budget = project.budget || 0;
                          const spent = calculateTotalSpent(project);
                          const remaining = budget - spent;
                          return remaining >= 0 
                            ? `${remaining.toLocaleString('ru-RU')} ₽`
                            : '—';
                        })()}
                      </span>
                    </div>
                    <div className="projects__budget-spent">
                      <span className="projects__budget-label">Израсходовано:</span>
                      <span className="projects__budget-amount">
                        {calculateTotalSpent(project).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>
                </div>
                )}
                </div>
              );
            })
          )}
        </div>

        {/* Пагинация */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPagesCalculated}
          onPageChange={handlePageChange}
        />
        </div>
      ) : isLoadingProject ? (
        <div className="projects__content">
          <div className="projects__loading">Загрузка проекта...</div>
        </div>
      ) : selectedProject && !(selectedProject.is_archived === 1 || selectedProject.is_archived === true) ? (
        <div className="projects__detail-wrapper">
        <ProjectDetail 
          project={selectedProject} 
          onBack={() => {
            setIsCreatingProject(false);
            setSelectedProject(null);
            navigate('/projects');
          }}
          onProjectUpdate={handleProjectUpdate}
          onRefresh={handleRefreshProject}
          onProjectCreate={async (createdRaw) => {
            const createdProject = unwrapCreatedProject(createdRaw) ?? (createdRaw as Record<string, unknown>);
            if (createdProject?.id == null) {
              console.error('onProjectCreate: нет id у созданного проекта', createdRaw);
              return;
            }
            setProjects((prev) => {
              const id = Number(createdProject.id);
              return [createdProject, ...prev.filter((p) => Number(p?.id) !== id)];
            });
            setIsCreatingProject(false);
            setSelectedProject(createdProject);
            setIsLoadingProject(false);
            setNavigationHistory((prevHistory) => {
              const updated = [...prevHistory];
              if (updated.length === 0) {
                const result = [null, createdProject.id] as ProjectHistoryEntry[];
                setHistoryIndex(result.length - 1);
                return result;
              }
              const targetIndex = Math.min(historyIndex, updated.length - 1);
              updated[targetIndex] = createdProject.id as number;
              setHistoryIndex(targetIndex);
              return updated;
            });
            if (createdProject?.id) {
              navigate(`/projects/${createdProject.id}`, { replace: true });
            }
            try {
              await loadAllProjects({ showLoading: false });
            } catch (e) {
              console.error('Не удалось обновить список проектов после создания', e);
            }
          }}
          isNew={isCreatingProject}
        />
        </div>
      ) : (
        <div className="projects__content">
          <div className="projects__empty">Проект не найден</div>
        </div>
      )}
    </div>
  );
};

