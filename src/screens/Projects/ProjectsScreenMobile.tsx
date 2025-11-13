import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/api';
import menuIconGrey from '../../shared/icons/menuIconGrey.svg';
import editMobIcon from '../../shared/icons/editMob.svg';
import exitMobIcon from '../../shared/icons/exitMob.svg';
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

export const ProjectsScreenMobile: React.FC<ProjectsScreenMobileProps> = ({ onLogout }) => {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  });

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

  useEffect(() => {
    let mounted = true;

    const fetchProjects = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiService.getProjects(1, 100);

        let data: ProjectListItem[] = [];

        if (Array.isArray(response)) {
          data = response;
        } else if (response?.data && Array.isArray(response.data)) {
          data = response.data;
        } else if (response?.projects && Array.isArray(response.projects)) {
          data = response.projects;
        }

        // Фильтруем проекты для бригадира
        const currentUser = apiService.getCurrentUser();
        const currentUserId = currentUser?.id;

        const filteredData = data.filter((project) => {
          // Исключаем архивные проекты
          if (project.status === 'Архив' || project.status === 'archived') {
            return false;
          }

          // Проверяем, является ли текущий пользователь участником проекта
          if (!project.employees || !Array.isArray(project.employees)) {
            return false;
          }

          // Проверяем активных сотрудников (без end_working_date)
          const isParticipant = project.employees.some((emp: any) => {
            const isCurrentUser = emp.id === currentUserId;
            const isActive = !emp.pivot?.end_working_date;
            return isCurrentUser && isActive;
          });

          return isParticipant;
        });

        if (mounted) {
          setProjects(filteredData);
        }
      } catch (err) {
        if (mounted) {
          setError('Не удалось загрузить проекты. Попробуйте позже.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchProjects();

    return () => {
      mounted = false;
    };
  }, []);

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

  if (selectedProjectId !== null && selectedProject) {
    return (
      <ProjectDetailMobile
        project={selectedProject}
        onBack={handleCloseProject}
        isLoading={isProjectLoading}
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
            Проекты <span>· {filteredProjects.length}</span>
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
            <p>Ничего не найдено</p>
            <button type="button" onClick={() => setSearch('')}>
              Сбросить фильтр
            </button>
          </div>
        ) : (
          <div className="mobile-projects__table-wrapper">
            <table className="mobile-projects__table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Наименование</th>
                  <th>Сроки</th>
                  <th>Ответственный бригадир</th>
                  <th>Сотрудников в проекте</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => {
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

