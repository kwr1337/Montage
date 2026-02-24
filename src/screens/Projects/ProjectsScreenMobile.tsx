import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/api';
import { mockData } from '../../mocks/mobile-project-mock';
import menuIconGrey from '../../shared/icons/menuIconGrey.svg';
import editMobIcon from '../../shared/icons/editMob.svg';
import exitMobIcon from '../../shared/icons/exitMob.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import { ProjectDetailMobile } from './ProjectDetailMobile';
import './projects-mobile.scss';

type ProjectsScreenMobileProps = {
  onLogout?: () => void;
};

type ProjectListItem = {
  id: number;
  name?: string;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  employees?: any[];
  address?: string | null;
  budget?: number;
  total_spent?: number;
  remaining_budget?: number;
  is_archived?: boolean | number;
};

const formatDateValue = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('ru-RU', options);
};

const getYearsLabel = (start?: string | null, end?: string | null) => {
  const startYear = formatDateValue(start, { year: 'numeric' });
  const endYear = formatDateValue(end, { year: 'numeric' });

  if (startYear === '—' && endYear === '—') {
    return '—';
  }

  if (startYear !== '—' && endYear !== '—' && startYear !== endYear) {
    return `${startYear} · ${endYear}`;
  }

  return startYear !== '—' ? startYear : endYear;
};

const getPeriodLabel = (start?: string | null, end?: string | null) => {
    const startLabel = formatDateValue(start, { day: '2-digit', month: 'short' });
    const endLabel = formatDateValue(end, { day: '2-digit', month: 'short' });

    if (startLabel === '—' && endLabel === '—') {
      return 'Срок не указан';
    }

    if (startLabel === '—') {
      return `До ${endLabel}`;
    }

    if (endLabel === '—') {
      return `С ${startLabel}`;
    }

    return `${startLabel} — ${endLabel}`;
};

const getForemanName = (project: ProjectListItem) => {
  if (!project.employees || project.employees.length === 0) {
    return 'Не назначен';
  }

  const activeEmployees = project.employees.filter((emp: any) => !emp.pivot?.end_working_date);
  const foreman = activeEmployees.find((emp: any) => emp.role === 'Бригадир');

  if (!foreman) {
    return 'Не назначен';
  }

  const lastName = foreman.last_name || '';
  const firstInitial = foreman.first_name ? `${foreman.first_name.charAt(0)}.` : '';
  const secondInitial = foreman.second_name ? `${foreman.second_name.charAt(0)}.` : '';

  return `${lastName} ${firstInitial}${secondInitial}`.trim() || 'Не назначен';
};

const getActiveEmployeesCount = (project: ProjectListItem) => {
  if (!project.employees || project.employees.length === 0) {
    return 0;
  }
  return project.employees.filter((emp: any) => !emp.pivot?.end_working_date).length;
};

const extractProjectsFromResponse = (response: any): ProjectListItem[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.data?.data)) return response.data.data;
  if (Array.isArray(response.projects)) return response.projects;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.results)) return response.results;
  if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    const d = response.data;
    if (Array.isArray(d.projects)) return d.projects;
    if (Array.isArray(d.items)) return d.items;
  }
  return [];
};

export const ProjectsScreenMobile: React.FC<ProjectsScreenMobileProps> = ({ onLogout }) => {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  });

  const useMockData = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mock') === '1';
  }, []);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const fetchProjects = React.useCallback(async () => {
      setIsLoading(true);
      setError(null);

      try {
        let data: ProjectListItem[] = [];

        const currentUser = apiService.getCurrentUser();
        const userRole = (currentUser?.role || currentUser?.position || '').toString();
        const isBrigadier = userRole === 'Бригадир';
        const managerId = currentUser?.id ? Number(currentUser.id) : null;
        const filterByManagerId = managerId != null ? { filter: { manager_id: [managerId] } } : {};
        const filterByProjectManagers = managerId != null ? { filter: { project_managers: [managerId] } } : {};
        const myOpts = isBrigadier ? { my: true as const } : {};
        const attempts: Array<() => Promise<any>> = [
          // 1) filter[project_managers][]=id
          ...(isBrigadier && managerId != null
            ? [
                () => apiService.getProjects(1, 100, { with: ['employees', 'logs'], ...filterByProjectManagers }),
                () => apiService.getProjects(1, 100, { with: ['logs'], ...filterByProjectManagers }),
            ]
            : []),
          // 2) filter[manager_id]=id (НЕ []= — вызывает 500)
          ...(isBrigadier && managerId != null
            ? [
                () => apiService.getProjects(1, 100, { with: ['employees', 'logs'], ...filterByManagerId }),
                () => apiService.getProjects(1, 100, { with: ['logs'], ...filterByManagerId }),
            ]
            : []),
          // 3) my=1
          ...(isBrigadier
            ? [
                () => apiService.getProjects(1, 100, { with: ['employees', 'logs'], ...myOpts }),
                () => apiService.getProjects(1, 100, { with: ['logs'], ...myOpts }),
                () => apiService.getProjects(1, 100, myOpts),
              ]
            : []),
          // 4) без фильтра (бэкенд может сам фильтровать по JWT)
          () => apiService.getProjects(1, 100, { with: ['employees', 'logs'] }),
          () => apiService.getProjects(1, 100, { with: ['logs'] }),
          () => apiService.getProjects(1, 100),
          () => apiService.getProjects(1, 100, { noPagination: true, with: ['logs'] }),
        ];

        for (const fetchFn of attempts) {
          const response = await fetchFn();
          data = extractProjectsFromResponse(response);
          if (data.length > 0) break;
        }

        if (data.length === 0) {
          try {
            const meResponse = await apiService.getCurrentUserProfile();
            const meData = meResponse?.data ?? meResponse;
            const projectsFromMe = meData?.projects ?? meData?.user?.projects;
            if (Array.isArray(projectsFromMe) && projectsFromMe.length > 0) {
              data = projectsFromMe;
            }
          } catch {
            // /auth/me может не возвращать проекты
          }
        }

        let filteredData = data.filter((project) => {
          if (project.status === 'Архив' || project.status === 'archived') return false;
          if (project.is_archived === 1 || project.is_archived === true) return false;
          return true;
        });

        if (useMockData) {
          filteredData = [mockData.project as ProjectListItem, ...filteredData];
        }

        setProjects(filteredData);
      } catch (err) {
        setError('Не удалось загрузить проекты. Попробуйте позже.');
      } finally {
        setIsLoading(false);
      }
  }, [useMockData]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) {
      return projects;
    }

    const query = search.toLowerCase();

    return projects.filter((project) => {
      const matchesId = project.id?.toString().includes(query);
      const matchesName = project.name?.toLowerCase().includes(query);
      const foremanName = getForemanName(project).toLowerCase();
      const matchesForeman = foremanName.includes(query);

      return matchesId || matchesName || matchesForeman;
    });
  }, [projects, search]);

  // Функция обработки сортировки
  const handleSort = (field: string | null) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Сортировка проектов
  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects];
    if (sortField) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortField) {
          case 'id':
            aValue = a.id || 0;
            bValue = b.id || 0;
            break;
          case 'name':
            aValue = (a.name || '').toLowerCase();
            bValue = (b.name || '').toLowerCase();
            break;
          case 'dates':
            aValue = a.start_date ? new Date(a.start_date).getTime() : 0;
            bValue = b.start_date ? new Date(b.start_date).getTime() : 0;
            break;
          case 'foreman':
            aValue = getForemanName(a).toLowerCase();
            bValue = getForemanName(b).toLowerCase();
            break;
          case 'employees':
            aValue = getActiveEmployeesCount(a);
            bValue = getActiveEmployeesCount(b);
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
  }, [filteredProjects, sortField, sortDirection]);

  const handleOpenProject = async (projectId: number) => {
    setSelectedProjectId(projectId);
    const fallbackProject = projects.find((project) => project.id === projectId) || { id: projectId };
    setSelectedProject(fallbackProject);
    setIsProjectLoading(true);

    try {
      const response = await apiService.getProjectById(projectId);
      const projectData = response?.data ?? response;
      if (projectData) {
        setSelectedProject(projectData);
      }
    } catch {
      setSelectedProject(fallbackProject);
    } finally {
      setIsProjectLoading(false);
    }
  };

  const handleCloseProject = () => {
    setSelectedProjectId(null);
    setSelectedProject(null);
    setIsProjectLoading(false);
  };

  const handleRefreshProject = async () => {
    if (selectedProjectId) {
      try {
        const response = await apiService.getProjectById(selectedProjectId);
        const updatedProject = response?.data ?? response;
        if (updatedProject) {
          setSelectedProject(updatedProject);
          setProjects((prev) =>
            prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
          );
        }
      } catch (e) {
        console.error('Ошибка обновления проекта:', e);
      }
    }
  };

  if (selectedProjectId !== null && selectedProject) {
    const isMockProject = useMockData && selectedProject.id === mockData.project.id;
    return (
      <ProjectDetailMobile
        project={selectedProject}
        onBack={handleCloseProject}
        onRefresh={handleRefreshProject}
        isLoading={isProjectLoading}
        mockApiResponses={isMockProject ? mockData.mockApiResponses : undefined}
      />
    );
  }

  if (isPortrait) {
    return (
      <div className="mobile-projects mobile-projects--portrait">
        <div className="mobile-projects__orientation-message">
          <p>Держите телефон горизонтально</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-projects">
      <div className="mobile-projects__inner">
        <header className="mobile-projects__topbar">
          {/* <div className="mobile-projects__brand">
            <img src={logoIcon} alt="Логотип" className="mobile-projects__brand-logo" />
            <div className="mobile-projects__brand-text">
              <span className="mobile-projects__brand-title">Монтаж</span>
              <span className="mobile-projects__brand-caption">Панель управления</span>
            </div>
          </div> */}
       <section className="mobile-projects__header">
          <h1>
            Проекты <span>· {sortedProjects.length}</span>
          </h1>
        </section>

          {onLogout && (
            <button type="button" className="mobile-projects__logout-btn" onClick={onLogout} aria-label="Выйти">
              <img src={exitMobIcon} alt="" aria-hidden="true" />
            </button>
          )}
        </header>

      

        {/* <div className="mobile-projects__search">
          <img src={searchIcon} alt="" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по ID, названию или бригадиру"
          />
        </div> */}

        {isLoading ? (
          <div className="mobile-projects__state">
            <img src={menuIconGrey} alt="" aria-hidden="true" className="mobile-projects__state-icon" />
            <p>Загружаем проекты…</p>
          </div>
        ) : error ? (
          <div className="mobile-projects__state mobile-projects__state--error">
            <p>{error}</p>
            <button type="button" onClick={() => setSearch('')}>
              Очистить поиск
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="mobile-projects__state">
            <p>Проекты не найдены</p>
            <p className="mobile-projects__state-hint">
              Если вы бригадир, убедитесь, что вас добавили в проект (Фиксация работ).
            </p>
            <button type="button" onClick={() => { setError(''); setIsLoading(true); fetchProjects(); }}>
              Обновить
            </button>
          </div>
        ) : (
          <div className="mobile-projects__table-wrapper">
            <table className="mobile-projects__table">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('id')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>ID</span>
                    <img src={upDownTableFilter} alt="" aria-hidden="true" />
                  </th>
                  <th 
                    onClick={() => handleSort('name')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Наименование</span>
                    <img src={upDownTableFilter} alt="" aria-hidden="true" />
                  </th>
                  <th 
                    onClick={() => handleSort('dates')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Сроки</span>
                    <img src={upDownTableFilter} alt="" aria-hidden="true" />
                  </th>
                  <th 
                    onClick={() => handleSort('foreman')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Ответственный бригадир</span>
                    <img src={upDownTableFilter} alt="" aria-hidden="true" />
                  </th>
                  <th 
                    onClick={() => handleSort('employees')}
                    style={{ cursor: 'pointer' }}
                  >
                    <span>Сотрудников в проекте</span>
                    <img src={upDownTableFilter} alt="" aria-hidden="true" />
                  </th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((project) => {
                  const employeesCount = getActiveEmployeesCount(project);
                  const yearsLabel = getYearsLabel(project.start_date, project.end_date);
                  const periodLabel = getPeriodLabel(project.start_date, project.end_date);

                  return (
                    <tr key={project.id}>
                      <td>
                        <span className="mobile-projects__cell-id">{project.id}</span>
                      </td>
                      <td>
                        <span className="mobile-projects__cell-name">{project.name || 'Без названия'}</span>
                      </td>
                      <td>
                        <div className="mobile-projects__cell-dates">
                          <span className="mobile-projects__cell-years">{yearsLabel}</span>
                          <span className="mobile-projects__cell-period">{periodLabel}</span>
                        </div>
                      </td>
                      <td>
                        <span className="mobile-projects__cell-foreman">{getForemanName(project)}</span>
                      </td>
                      <td>
                        <span className="mobile-projects__cell-employees">
                          {employeesCount > 0 ? `${employeesCount} сотрудников` : 'Не назначены'}
                        </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mobile-projects__row-action"
                        aria-label="Открыть проект"
                        onClick={() => handleOpenProject(project.id)}
                      >
                        <img src={editMobIcon} alt="" aria-hidden="true" />
                      </button>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

