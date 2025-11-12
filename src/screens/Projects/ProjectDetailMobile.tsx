import React, { useEffect, useMemo, useRef, useState } from 'react';
import paginationIconActiveLeft from '../../shared/icons/paginationIconActiveLeft.svg';
import calendarIconGrey from '../../shared/icons/calendarIconGrey.svg';
import userDropdownIcon from '../../shared/icons/user-dropdown-icon.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import { apiService } from '../../services/api';
import './project-detail-mobile.scss';

type ProjectDetailMobileProps = {
  project: any;
  onBack: () => void;
  isLoading?: boolean;
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined) {
    return '0 ₽';
  }

  const numeric = typeof value === 'string' ? Number(value) : value;

  if (!Number.isFinite(numeric)) {
    return '0 ₽';
  }

  return `${Math.max(0, numeric).toLocaleString('ru-RU')} ₽`;
};

const formatNumber = (value?: number | string | null, fallback: string = '—') => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return numeric.toLocaleString('ru-RU');
};

const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day} / ${month} / ${year}`;
};

const getForemanFullName = (project?: any) => {
  if (!project?.employees || !Array.isArray(project.employees)) {
    return 'Не назначен';
  }

  const activeEmployees = project.employees.filter((emp: any) => !emp.pivot?.end_working_date);
  const foreman = activeEmployees.find((emp: any) => emp.role === 'Бригадир');

  if (!foreman) {
    return 'Не назначен';
  }

  const { last_name, first_name, second_name } = foreman;
  return [last_name, first_name, second_name].filter(Boolean).join(' ') || 'Не назначен';
};

const formatForemanName = (employee: any) => {
  if (!employee) {
    return 'Не назначен';
  }

  const { last_name, first_name, second_name } = employee;
  return [last_name, first_name, second_name].filter(Boolean).join(' ') || 'Не назначен';
};

const getSpecificationStatusMeta = (item: any) => {
  if (item?.is_deleted) {
    const date = item?.deleted_at ? new Date(item.deleted_at).toLocaleDateString('ru-RU') : null;
    return {
      label: date ? `Удалён · ${date}` : 'Удалён',
      variant: 'deleted' as const,
    };
  }

  return {
    label: 'Активен',
    variant: 'active' as const,
  };
};

type SpecificationItem = {
  id: number;
  name: string;
  unit: string;
  plan: number;
  changes: number | null;
  fact: number | null;
  statusLabel: string;
  statusVariant: 'active' | 'deleted';
};

export const ProjectDetailMobile: React.FC<ProjectDetailMobileProps> = ({ project, onBack, isLoading = false }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'specification' | 'tracking'>('general');
  const [isForemanDropdownOpen, setIsForemanDropdownOpen] = useState(false);
  const foremanDropdownRef = useRef<HTMLDivElement | null>(null);
  const [specificationItems, setSpecificationItems] = useState<SpecificationItem[]>([]);
  const [isSpecificationLoading, setIsSpecificationLoading] = useState(false);

  const summary = useMemo(() => {
    const allocated = Number(project?.budget) || 0;

    const spentCandidates = [
      project?.total_spent,
      project?.spent,
      project?.budget_spent,
      project?.tracking_totals?.total_sum,
      project?.tracking?.total_sum,
    ];

    let spent = spentCandidates.find((value) => Number.isFinite(Number(value)));

    if (!Number.isFinite(Number(spent)) && Array.isArray(project?.tracking_items)) {
      spent = project.tracking_items.reduce((acc: number, item: any) => acc + (Number(item?.total_sum) || 0), 0);
    }

    if (!Number.isFinite(Number(spent)) && Array.isArray(project?.employees)) {
      spent = project.employees.reduce((acc: number, employee: any) => {
        return acc + (Number(employee?.pivot?.total_sum) || Number(employee?.totalSum) || 0);
      }, 0);
    }

    const spentValue = Number(spent) || 0;
    const remainingCandidate = project?.remaining_budget ?? project?.budget_remaining ?? (allocated - spentValue);
    const remaining = Number.isFinite(Number(remainingCandidate))
      ? Number(remainingCandidate)
      : Math.max(allocated - spentValue, 0);

    return {
      allocated,
      spent: Math.max(0, spentValue),
      remaining: remaining < 0 ? 0 : remaining,
      startDate: project?.start_date || '',
      endDate: project?.end_date || '',
      foreman: getForemanFullName(project),
    };
  }, [project]);

  const title = useMemo(() => {
    const idPart = project?.id ? `№${project.id}` : '';
    const namePart = project?.name ? ` · ${project.name}` : '';
    return `Проект ${idPart}${namePart}`.trim();
  }, [project?.id, project?.name]);

  const foremen = useMemo(() => {
    if (!Array.isArray(project?.employees)) {
      return [];
    }

    return project.employees.filter((emp: any) => emp.role === 'Бригадир' && !emp.pivot?.end_working_date);
  }, [project?.employees]);

  useEffect(() => {
    if (foremen.length === 0 && isForemanDropdownOpen) {
      setIsForemanDropdownOpen(false);
    }
  }, [foremen.length, isForemanDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (foremanDropdownRef.current && !foremanDropdownRef.current.contains(event.target as Node)) {
        setIsForemanDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadSpecification = async () => {
      if (!project?.id || !Array.isArray(project?.nomenclature) || project.nomenclature.length === 0) {
        if (!isCancelled) {
          setSpecificationItems([]);
          setIsSpecificationLoading(false);
        }
        return;
      }

      setIsSpecificationLoading(true);

      try {
        const itemsWithMeta = await Promise.all(
          project.nomenclature.map(async (item: any) => {
            let lastChange: number | null = null;

            try {
              const response = await apiService.getNomenclatureChanges(project.id, item.id);
              const changesData = Array.isArray(response?.data)
                ? response.data
                : Array.isArray(response)
                ? response
                : [];

              if (changesData.length > 0) {
                const latestChange = changesData[changesData.length - 1];
                const numericChange = Number(latestChange?.amount_change);
                if (Number.isFinite(numericChange)) {
                  lastChange = numericChange;
                }
              }
            } catch {
              // Игнорируем ошибки загрузки изменений для конкретной позиции
            }

            const statusMeta = getSpecificationStatusMeta(item);
            const planValue = Number(item?.pivot?.start_amount ?? item?.plan ?? 0);
            const factValue = Number(item?.pivot?.current_amount ?? item?.fact ?? 0);

            return {
              id: item.id,
              name: item.name || '—',
              unit: item.unit || '—',
              plan: Number.isFinite(planValue) ? planValue : 0,
              changes: lastChange,
              fact: Number.isFinite(factValue) ? factValue : 0,
              statusLabel: statusMeta.label,
              statusVariant: statusMeta.variant,
            } as SpecificationItem;
          })
        );

        if (!isCancelled) {
          setSpecificationItems(itemsWithMeta);
        }
      } finally {
        if (!isCancelled) {
          setIsSpecificationLoading(false);
        }
      }
    };

    loadSpecification();

    return () => {
      isCancelled = true;
    };
  }, [project?.id, project?.nomenclature]);

  return (
    <div className="mobile-project-detail">
      <div className="mobile-project-detail__top-card">
        <div className="mobile-project-detail__header">
          <button type="button" className="mobile-project-detail__back" onClick={onBack} aria-label="Назад к списку проектов">
            <img src={paginationIconActiveLeft} alt="" aria-hidden="true" />
          </button>

          <h1 className="mobile-project-detail__title">{title}</h1>

          <div className="mobile-project-detail__tabs">
            <button
              type="button"
              className={`mobile-project-detail__tab ${activeTab === 'general' ? 'mobile-project-detail__tab--active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              Общая информация
            </button>
            <button
              type="button"
              className={`mobile-project-detail__tab ${activeTab === 'specification' ? 'mobile-project-detail__tab--active' : ''}`}
              onClick={() => setActiveTab('specification')}
            >
              Спецификация
            </button>
            <button
              type="button"
              className={`mobile-project-detail__tab ${activeTab === 'tracking' ? 'mobile-project-detail__tab--active' : ''}`}
              onClick={() => setActiveTab('tracking')}
            >
              Фиксация работ
            </button>
          </div>
        </div>


      </div>

      {isLoading ? (
        <div className="mobile-project-detail__state">Загружаем проект…</div>
      ) : (
        <div className="mobile-project-detail__content">
          {activeTab === 'general' && (
            <>
              <section className="mobile-project-detail__budget">
                <span className="mobile-project-detail__section-label">ФОТ</span>
                <div className="mobile-project-detail__budget-cards">
                  <div className="mobile-project-detail__budget-card mobile-project-detail__budget-card--allocated">
                    <span className="mobile-project-detail__budget-label">Выделено</span>
                    <div className="mobile-project-detail__budget-value">{formatCurrency(summary.allocated)}</div>
                  </div>
                  <div className="mobile-project-detail__budget-card mobile-project-detail__budget-card--spent">
                    <span className="mobile-project-detail__budget-label">Потрачено</span>
                    <div className="mobile-project-detail__budget-value">{formatCurrency(summary.spent)}</div>
                  </div>
                  <div className="mobile-project-detail__budget-card mobile-project-detail__budget-card--remaining">
                    <span className="mobile-project-detail__budget-label">Остаток</span>
                    <div className="mobile-project-detail__budget-value">{formatCurrency(summary.remaining)}</div>
                  </div>
                </div>
              </section>

              <section className="mobile-project-detail__summary">
                <span className="mobile-project-detail__section-label">Сводка по проекту</span>

                <div className="mobile-project-detail__summary-grid">
                  <div className="mobile-project-detail__summary-card">
                    <span className="mobile-project-detail__summary-meta">Сроки</span>
                    <div className="mobile-project-detail__summary-date-picker" aria-hidden="true">
                      <div className="mobile-project-detail__summary-date-picker-inner">
                        <img src={calendarIconGrey} alt="" className="mobile-project-detail__summary-date-picker-icon" />
                        <div className="mobile-project-detail__summary-date-display mobile-project-detail__summary-date-display--start">
                          {formatDate(summary.startDate)}
                        </div>
                        <div className="mobile-project-detail__summary-date-display mobile-project-detail__summary-date-display--end">
                          {formatDate(summary.endDate)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-project-detail__summary-card">
                    <span className="mobile-project-detail__summary-meta">Бригадир</span>
                    <div
                      className={`mobile-project-detail__summary-foreman ${isForemanDropdownOpen ? 'mobile-project-detail__summary-foreman--open' : ''}`}
                      ref={foremanDropdownRef}
                    >
                      <button
                        type="button"
                        className="mobile-project-detail__summary-foreman-inner"
                        onClick={() => {
                          if (foremen.length > 0) {
                            setIsForemanDropdownOpen((prev) => !prev);
                          }
                        }}
                        disabled={foremen.length === 0}
                        aria-expanded={isForemanDropdownOpen}
                        aria-haspopup="listbox"
                      >
                        <span>{summary.foreman}</span>
                        <img src={userDropdownIcon} alt="" className="mobile-project-detail__summary-foreman-icon" aria-hidden="true" />
                      </button>

                      {isForemanDropdownOpen && foremen.length > 0 && (
                        <div className="mobile-project-detail__summary-foreman-dropdown" role="listbox">
                          {foremen.map((foreman: any) => (
                            <div key={foreman.id} className="mobile-project-detail__summary-foreman-item" role="option" aria-selected="false">
                              {formatForemanName(foreman)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'specification' && (
            <section className="mobile-project-detail__specification">
              {isSpecificationLoading ? (
                <div className="mobile-project-detail__state">Загружаем спецификацию…</div>
              ) : specificationItems.length === 0 ? (
                <div className="mobile-project-detail__specification-empty">
                  <p>В спецификации пока нет материалов.</p>
                </div>
              ) : (
                <div className="mobile-project-detail__specification-table-wrapper">
                  <div className="mobile-project-detail__specification-table">
                    <div className="mobile-project-detail__specification-header-groups">
                      <div className="mobile-project-detail__specification-header-group" />
                      <div className="mobile-project-detail__specification-header-group" />
                      <div className="mobile-project-detail__specification-header-group" />
                      <div className="mobile-project-detail__specification-header-group" />
                      <div className="mobile-project-detail__specification-header-group">План</div>
                      <div className="mobile-project-detail__specification-header-group">Изм</div>
                      <div className="mobile-project-detail__specification-header-group">Факт</div>
                      <div className="mobile-project-detail__specification-header-group" />
                      <div className="mobile-project-detail__specification-header-group"></div>
                    </div>

                    <div className="mobile-project-detail__specification-header">
                      {/* <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--checkbox">
                        <input type="checkbox" disabled />
                      </div> */}
                      <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--id">
                        <span>ID</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--name">
                        <span>Номенклатура</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col">
                        <span>Статус</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col">
                        <span>Ед. изм.</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number">
                        <span>Кол-во</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number">
                        <span>Кол-во</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number">
                        <span>Кол-во</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--action">
                        <span>Действие</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                    </div>

                    <div className="mobile-project-detail__specification-body">
                      {specificationItems.map((item) => (
                        <div key={item.id} className="mobile-project-detail__specification-row">
                          {/* <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--checkbox">
                            <input type="checkbox" disabled />
                          </div> */}
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--id">
                            <span>{item.id}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--name">
                            <span>{item.name}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--status">
                            <span className={`mobile-project-detail__specification-status mobile-project-detail__specification-status--${item.statusVariant}`}>
                              {item.statusLabel}
                            </span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--unit">
                            <span>{item.unit || '—'}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--number">
                            <span>{formatNumber(item.plan, '0')}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--number">
                            <span>{formatNumber(item.changes, '—')}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--number">
                            <span>{formatNumber(item.fact, '0')}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--action">
                            <button type="button" className="mobile-project-detail__specification-action">
                              Ввести факт
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === 'tracking' && (
            <div className="mobile-project-detail__placeholder">
              <p>Фиксация работ появится в будущих обновлениях.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

