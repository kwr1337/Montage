import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { ProjectDetail } from './ProjectDetail';
import menuIconGrey from '../../shared/icons/menuIconGrey.svg';
import searchIcon from '../../shared/icons/searchIcon.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import brigadirIcon from '../../shared/icons/brigadirIcon.svg';
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

type ProjectsScreenProps = {
  onLogout?: () => void;
};

type ProjectHistoryEntry = number | 'new' | null;

export const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ onLogout }) => {
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [isArchiving, setIsArchiving] = useState(false);
  // Восстанавливаем selectedProjectId из localStorage при загрузке
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedProjectId');
    return saved ? parseInt(saved, 10) : null;
  });
  const [navigationHistory, setNavigationHistory] = useState<ProjectHistoryEntry[]>(() => {
    const saved = localStorage.getItem('selectedProjectId');
    const savedId = saved ? parseInt(saved, 10) : null;
    return savedId ? [null, savedId] : [null];
  });
  const [historyIndex, setHistoryIndex] = useState(() => {
    const saved = localStorage.getItem('selectedProjectId');
    return saved ? 1 : 0;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 11;
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectSpentMap, setProjectSpentMap] = useState<Map<number, number>>(new Map());
  
  // Состояние для сортировки
  const [sortField, setSortField] = useState<string | null>(null); // null = сортировка по дате добавления (по умолчанию)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // по умолчанию по убыванию

  // Функция для расчета суммы израсходованных средств проекта
  // На основе суммы колонки "Сумма (всего)" из таблицы фиксации работ
  const calculateTotalSpent = (project: any): number => {
    // Используем кэшированное значение, если оно есть
    if (projectSpentMap.has(project.id)) {
      return projectSpentMap.get(project.id) || 0;
    }
    
    // Если данных еще нет, возвращаем 0 (данные загрузятся асинхронно)
    return 0;
  };

  // Функция для загрузки израсходованных сумм для всех проектов
  const loadProjectsSpent = async (projectsList: any[]) => {
    const spentMap = new Map<number, number>();
    
    await Promise.all(
      projectsList.map(async (project) => {
        if (!project.id || !project.employees || !Array.isArray(project.employees)) {
          spentMap.set(project.id, 0);
          return;
        }
        
        try {
          // Загружаем work_reports для всех сотрудников проекта и суммируем
          const totalSpent = await Promise.all(
            project.employees
              .filter((emp: any) => !emp.pivot?.end_working_date) // Только активные
              .map(async (emp: any) => {
                try {
                  const response = await apiService.getWorkReports(project.id, emp.id, {
                    per_page: 1000,
                  });
                  
                  let reports: any[] = [];
                  if (response?.data?.data && Array.isArray(response.data.data)) {
                    reports = response.data.data;
                  } else if (response?.data && Array.isArray(response.data)) {
                    reports = response.data;
                  } else if (Array.isArray(response)) {
                    reports = response;
                  }
                  
                  // Суммируем часы
                  const totalHours = reports.reduce((sum, report) => {
                    const hoursWorked = Number(report.hours_worked) || 0;
                    const isAbsent = report.absent === true || report.absent === 1 || report.absent === '1';
                    return sum + (isAbsent ? 0 : hoursWorked);
                  }, 0);
                  
                  // Получаем ставку
                  const rate = emp.pivot?.rate_per_hour || emp.rate_per_hour || emp.pivot?.hourly_rate || 0;
                  
                  // Рассчитываем сумму для сотрудника
                  return totalHours * rate;
                } catch (error) {
                  console.error(`Error loading work reports for employee ${emp.id} in project ${project.id}:`, error);
                  return 0;
                }
              })
          );
          
          // Суммируем все суммы сотрудников
          const projectTotalSpent = totalSpent.reduce((sum, employeeSpent) => sum + employeeSpent, 0);
          spentMap.set(project.id, projectTotalSpent);
        } catch (error) {
          console.error(`Error loading spent for project ${project.id}:`, error);
          spentMap.set(project.id, 0);
        }
      })
    );
    
    setProjectSpentMap(spentMap);
  };

  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      try {
        const response = await apiService.getProjects(currentPage, itemsPerPage);
        
        // Проверяем разные варианты структуры ответа
        let projectsList: any[] = [];
        if (Array.isArray(response)) {
          projectsList = response;
          setProjects(response);
          // Если массив без мета-данных, используем локальную пагинацию
          setTotalPages(1);
        } else if (response && response.data) {
          if (Array.isArray(response.data)) {
            projectsList = response.data;
            setProjects(response.data);
            // Проверяем наличие информации о пагинации
            // Laravel pagination format
            if (response.last_page) {
              setTotalPages(response.last_page);
            } else if (response.meta) {
              const total = response.meta.total || response.data.length;
              setTotalPages(Math.ceil(total / itemsPerPage));
            } else if (response.pagination) {
              setTotalPages(response.pagination.total_pages || 1);
            } else {
              setTotalPages(1);
            }
          } else {
            setProjects([]);
            setTotalPages(1);
          }
        } else {
          setProjects([]);
          setTotalPages(1);
        }
        
        // Загружаем израсходованные суммы для всех проектов
        if (projectsList.length > 0) {
          loadProjectsSpent(projectsList);
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        setProjects([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [currentPage]);

  // Фильтрация проектов по статусу и поиску (клиентская, пока сервер не поддерживает)
  const filteredProjects = projects.filter((project) => {
    
    // Фильтр по статусу
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'Архив') {
      // Для статуса "Архив" проверяем поле is_archived
      matchesStatus = project.is_archived === 1 || project.is_archived === true;
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
        setIsLoadingProject(true);
        try {
          const response = await apiService.getProjectById(selectedProjectId);
          
          if (response && response.data) {
            setSelectedProject(response.data);
          } else if (response) {
            setSelectedProject(response);
          } else {
            // Если не удалось загрузить с сервера, ищем в локальном списке
            const localProject = projects.find(p => p.id === selectedProjectId);
            setSelectedProject(localProject || null);
          }
        } catch (error) {
          console.error('Error fetching project details:', error);
          // Fallback к локальному списку
          const localProject = projects.find(p => p.id === selectedProjectId);
          setSelectedProject(localProject || null);
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
    } else {
      setIsCreatingProject(false);
      setSelectedProjectId(projectId ?? null);
    }
    
    // Сохраняем selectedProjectId в localStorage
    if (typeof projectId === 'number' && projectId) {
      localStorage.setItem('selectedProjectId', projectId.toString());
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevEntry = navigationHistory[newIndex];

      if (prevEntry === 'new') {
        startProjectCreation();
      } else if (typeof prevEntry === 'number' && prevEntry) {
        setIsCreatingProject(false);
        setSelectedProjectId(prevEntry);
        localStorage.setItem('selectedProjectId', prevEntry.toString());
      } else {
        setIsCreatingProject(false);
        setSelectedProject(null);
        setSelectedProjectId(null);
        localStorage.removeItem('selectedProjectId');
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
      } else if (typeof nextEntry === 'number' && nextEntry) {
        setIsCreatingProject(false);
        setSelectedProjectId(nextEntry);
        localStorage.setItem('selectedProjectId', nextEntry.toString());
      } else {
        setIsCreatingProject(false);
        setSelectedProject(null);
        setSelectedProjectId(null);
        localStorage.removeItem('selectedProjectId');
      }
    }
  };

  const currentUser = apiService.getCurrentUser();

  const createEmptyProjectDraft = () => ({
    id: null,
    name: '',
    status: 'Новый',
    start_date: '',
    end_date: '',
    address: '',
    description: '',
    budget: '',
    project_manager_id: currentUser?.id ?? null,
    employees: [],
    nomenclature: [],
  });

  const startProjectCreation = () => {
    const draftProject = createEmptyProjectDraft();
    setIsCreatingProject(true);
    setSelectedProject(draftProject);
    setSelectedProjectId(null);
    setIsLoadingProject(false);
    localStorage.removeItem('selectedProjectId');
  };

  const handleStartCreateProject = () => {
    const newHistory = navigationHistory.slice(0, historyIndex + 1);
    newHistory.push('new');
    setNavigationHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    startProjectCreation();
  };

  const handleProjectUpdate = (updatedProject: any) => {
    // Обновляем проект в списке
    setProjects(prevProjects => 
      prevProjects.map(p => p.id === updatedProject.id ? updatedProject : p)
    );
    // Обновляем выбранный проект, если это он
    if (selectedProject && selectedProject.id === updatedProject.id) {
      setSelectedProject(updatedProject);
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
      if (archivedProjects.length > 0) {
        // Снимаем с архива - обновляем is_archived через updateProject
        const unarchivePromises = archivedProjects.map(project => {
          // Сохраняем оригинальный статус перед архивированием, если его нет
          const originalStatus = project.status_before_archive || (project.status === 'Архив' ? 'Новый' : project.status) || 'Новый';
          
          return apiService.updateProject(project.id, {
            is_archived: 0,
            status: originalStatus
          });
        });
        
        await Promise.all(unarchivePromises);
        
        // Обновляем список проектов
        const updatedProjects = projects.map(project => {
          if (selectedProjectIds.has(project.id)) {
            // Определяем новый статус (используем сохраненный или "Новый")
            const originalStatus = project.status_before_archive || (project.status === 'Архив' ? 'Новый' : project.status) || 'Новый';
            return { ...project, is_archived: 0, status: originalStatus };
          }
          return project;
        });
        
        setProjects(updatedProjects);
      } else {
        // Архивируем
        const archivePromises = nonArchivedProjects.map(project => 
          apiService.archiveProject(project.id)
        );
        
        await Promise.all(archivePromises);
        
        // Обновляем список проектов
        const updatedProjects = projects.map(project => {
          if (selectedProjectIds.has(project.id)) {
            return { ...project, is_archived: 1, status: 'Архив' };
          }
          return project;
        });
        
        setProjects(updatedProjects);
        
        // Если архивируемый проект открыт, закрываем его
        if (selectedProject && selectedProjectIds.has(selectedProject.id)) {
          setSelectedProjectId(null);
          localStorage.removeItem('selectedProjectId');
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

  return (
    <div className="projects">
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
        onCreate={!selectedProject ? handleStartCreateProject : undefined}
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
            <div className="projects__table-header-col">
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('id');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="projects__table-header-col">
              <span>Наименование</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'name' ? 'projects__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('name');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="projects__table-header-col">
              <span>Статус</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'status' ? 'projects__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('status');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="projects__table-header-col">
              <span>Сроки</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'dates' ? 'projects__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('dates');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="projects__table-header-col">
              <span>Ответ. бригадир</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'foreman' ? 'projects__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('foreman');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="projects__table-header-col">
              <span>Сотрудники</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'employees' ? 'projects__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('employees');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div className="projects__table-header-col">
              <span>Расход ФОТ</span>
              <img 
                src={upDownTableFilter} 
                alt="↑↓" 
                className={`projects__sort-icon ${sortField === 'spent' ? 'projects__sort-icon--active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSort('spent');
                }}
                style={{ cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Строки таблицы */}
          {isLoading ? (
            <div className="projects__loading">Загрузка...</div>
          ) : sortedProjects.length === 0 ? (
            <div className="projects__empty">
              {projects.length === 0 ? 'Нет проектов' : 'Нет проектов с такими параметрами'}
            </div>
          ) : (
            sortedProjects.map((project) => {
              const isArchived = project.is_archived === 1 || project.is_archived === true || project.status === 'Архив';
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
                            <div className="projects__employee-count">
                              <span>+{activeEmployees.length - 3} Сотр.</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="projects__table-row-col">
                  <div className="projects__budget">
                    <div className="projects__budget-remaining">
                      <span className="projects__budget-label">Осталось:</span>
                      <span className="projects__budget-amount">
                        {(() => {
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
                      <span className="projects__budget-label">Потрачено:</span>
                      <span className="projects__budget-amount">
                        {calculateTotalSpent(project).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>
                </div>
                </div>
              );
            })
          )}
        </div>

        {/* Пагинация */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
        </div>
      ) : isLoadingProject ? (
        <div className="projects__content">
          <div className="projects__loading">Загрузка проекта...</div>
        </div>
      ) : selectedProject && !(selectedProject.is_archived === 1 || selectedProject.is_archived === true) ? (
        <ProjectDetail 
          project={selectedProject} 
          onBack={() => {
            setIsCreatingProject(false);
            setSelectedProject(null);
            setSelectedProjectId(null);
            localStorage.removeItem('selectedProjectId');
          }}
          onProjectUpdate={handleProjectUpdate}
          onProjectCreate={(createdProject) => {
            setProjects(prev => [createdProject, ...prev]);
            setIsCreatingProject(false);
            setSelectedProject(createdProject);
            setSelectedProjectId(createdProject.id);
            setIsLoadingProject(false);
            setNavigationHistory(prevHistory => {
              const updated = [...prevHistory];
              if (updated.length === 0) {
                const result = [null, createdProject.id];
                setHistoryIndex(result.length - 1);
                return result;
              }
              const targetIndex = Math.min(historyIndex, updated.length - 1);
              updated[targetIndex] = createdProject.id;
              setHistoryIndex(targetIndex);
              return updated;
            });
            if (createdProject?.id) {
              localStorage.setItem('selectedProjectId', createdProject.id.toString());
            }
          }}
          isNew={isCreatingProject}
        />
      ) : (
        <div className="projects__content">
          <div className="projects__empty">Проект не найден</div>
        </div>
      )}
    </div>
  );
};

