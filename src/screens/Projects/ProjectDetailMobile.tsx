import React, { useEffect, useMemo, useRef, useState } from 'react';
import paginationIconActiveLeft from '../../shared/icons/paginationIconActiveLeft.svg';
import calendarIconGrey from '../../shared/icons/calendarIconGrey.svg';
import userDropdownIcon from '../../shared/icons/user-dropdown-icon.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import commentMobIcon from '../../shared/icons/commentMob.svg';
import { apiService } from '../../services/api';
import { AddFactModal } from '../../shared/ui/AddFactModal/AddFactModal';
import { AddHoursModal } from '../../shared/ui/AddHoursModal/AddHoursModal';
import { CommentModal } from '../../shared/ui/CommentModal/CommentModal';
import '../../shared/ui/AddFactModal/add-fact-modal.scss';
import '../../shared/ui/AddHoursModal/add-hours-modal.scss';
import '../../shared/ui/CommentModal/comment-modal.scss';
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

  // Если дата в формате YYYY-MM-DD, парсим её правильно
  let date: Date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Формат YYYY-MM-DD без времени
    date = new Date(value + 'T00:00:00');
  } else {
    date = new Date(value);
  }
  
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
};

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

const getInitials = (emp: any) => {
  const firstInitial = emp.first_name ? emp.first_name.charAt(0).toUpperCase() : '';
  const lastInitial = emp.last_name ? emp.last_name.charAt(0).toUpperCase() : '';
  return (lastInitial + firstInitial) || 'Н';
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
  const [specificationSortField, setSpecificationSortField] = useState<string | null>(null);
  const [specificationSortDirection, setSpecificationSortDirection] = useState<'asc' | 'desc'>('asc');

  // Отладочная информация (можно удалить после проверки)
  useEffect(() => {
    if (project) {
      console.log('ProjectDetailMobile: project loaded', {
        id: project.id,
        name: project.name,
        hasNomenclature: Array.isArray(project.nomenclature),
        nomenclatureLength: project.nomenclature?.length || 0,
        isLoading,
      });
    }
  }, [project, isLoading]);
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight > window.innerWidth;
    }
    return false;
  });
  const [isFactModalOpen, setIsFactModalOpen] = useState(false);
  const [selectedNomenclature, setSelectedNomenclature] = useState<SpecificationItem | null>(null);
  const [existingFact, setExistingFact] = useState<{ id: number; amount: number; fact_date: string } | null>(null);
  const [trackingItems, setTrackingItems] = useState<any[]>([]);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [trackingSortField, setTrackingSortField] = useState<string | null>(null);
  const [trackingSortDirection, setTrackingSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [trackedDates, setTrackedDates] = useState<string[]>([]);
  const [calculatedSpent, setCalculatedSpent] = useState<number | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<{ comment: string; employeeName: string; date: string } | null>(null);

  const summary = useMemo(() => {
    const allocated = Number(project?.budget) || 0;

    // Используем рассчитанную сумму из work_reports, если она есть
    let spentValue = 0;
    if (calculatedSpent !== null) {
      spentValue = calculatedSpent;
    } else {
      // Иначе используем данные из проекта
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

      spentValue = Number(spent) || 0;
    }

    const remainingCandidate = project?.remaining_budget ?? project?.budget_remaining ?? (allocated - spentValue);
    const remaining = Number.isFinite(Number(remainingCandidate))
      ? Number(remainingCandidate)
      : Math.max(allocated - spentValue, 0);

    return {
      allocated,
      spent: Math.max(0, spentValue),
      remaining: Math.max(0, remaining),
      startDate: project?.start_date || '',
      endDate: project?.end_date || '',
      foreman: getForemanFullName(project),
    };
  }, [project, calculatedSpent]);

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

    const loadSpec = async () => {
      // Проверяем, что проект загружен и имеет номенклатуру
      if (!project?.id) {
        if (!isCancelled) {
          setSpecificationItems([]);
          setIsSpecificationLoading(false);
        }
        return;
      }

      // Если номенклатуры нет или она пустая, просто очищаем список
      if (!Array.isArray(project?.nomenclature) || project.nomenclature.length === 0) {
        if (!isCancelled) {
          setSpecificationItems([]);
          setIsSpecificationLoading(false);
        }
        return;
      }

      if (!isCancelled) {
        setIsSpecificationLoading(true);
      }

      try {
        const itemsWithMeta = await Promise.all(
          project.nomenclature.map(async (item: any) => {
            if (!item?.id) return null;

            let lastChange: number | null = null;
            let factValue: number = 0;

            try {
              // Загружаем изменения
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
              // Игнорируем ошибки загрузки изменений
            }

            try {
              // Загружаем факты и суммируем их
              const factsResponse = await apiService.getNomenclatureFacts(project.id, item.id, {
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
            } catch {
              // Игнорируем ошибки загрузки фактов, используем значение из pivot
              factValue = Number(item?.pivot?.current_amount ?? item?.fact ?? 0);
            }

            const statusMeta = getSpecificationStatusMeta(item);
            const planValue = Number(item?.pivot?.start_amount ?? item?.plan ?? 0);

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

        // Фильтруем null значения
        const validItems = itemsWithMeta.filter((item): item is SpecificationItem => item !== null);

        if (!isCancelled) {
          setSpecificationItems(validItems);
        }
      } catch (error) {
        console.error('Error loading specification:', error);
        if (!isCancelled) {
          setSpecificationItems([]);
        }
      } finally {
        if (!isCancelled) {
          setIsSpecificationLoading(false);
        }
      }
    };

    loadSpec();

    return () => {
      isCancelled = true;
    };
  }, [project?.id, project?.nomenclature]);

  // Загружаем и рассчитываем потраченную сумму из work_reports
  useEffect(() => {
    if (!project?.id) return;

    let isCancelled = false;

    const loadSpent = async () => {
      try {
        const employees = project?.employees || [];
        const activeEmployees = employees.filter((emp: any) => !emp.pivot?.end_working_date);

        // Загружаем work_reports для всех активных сотрудников и суммируем
        const totalSpent = await Promise.all(
          activeEmployees.map(async (emp: any) => {
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
              console.error(`Error loading work reports for employee ${emp.id}:`, error);
              return 0;
            }
          })
        );
        
        // Суммируем все суммы сотрудников
        const projectTotalSpent = totalSpent.reduce((sum, employeeSpent) => sum + employeeSpent, 0);
        
        if (!isCancelled) {
          setCalculatedSpent(projectTotalSpent);
        }
      } catch (error) {
        console.error('Error loading spent:', error);
        if (!isCancelled) {
          setCalculatedSpent(0);
        }
      }
    };

    loadSpent();

    return () => {
      isCancelled = true;
    };
  }, [project?.id, project?.employees]);

  // Функция для загрузки trackingItems (вынесена отдельно для переиспользования)
  const loadTrackingItems = React.useCallback(async () => {
    if (!project?.id) return;
    
    try {
      const employees = project?.employees || [];
      const activeEmployees = employees.filter((emp: any) => !emp.pivot?.end_working_date);

      // Получаем текущую дату для проверки невыставленных часов
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Загружаем work_reports для всех активных сотрудников
      const trackingData = await Promise.all(
        activeEmployees.map(async (emp: any) => {
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
            
            // Сортируем отчеты по дате (от новых к старым)
            reports.sort((a, b) => {
              // Парсим дату в формате YYYY-MM-DD
              const dateA = new Date(a.report_date + 'T00:00:00').getTime();
              const dateB = new Date(b.report_date + 'T00:00:00').getTime();
              return dateB - dateA; // От новых к старым
            });
            
            // Берем последний отчет по дате (самый новый)
            const lastReport = reports.length > 0 ? reports[0] : null;
            
            const hourlyRate = emp.pivot?.rate_per_hour || emp.rate_per_hour || emp.pivot?.hourly_rate || 0;
            const employeeName = `${emp.last_name || ''} ${emp.first_name ? `${emp.first_name.charAt(0)}.` : ''}${emp.second_name ? `${emp.second_name.charAt(0)}.` : ''}`.trim();
            
            // Данные за последний отчет (последняя дата)
            let lastDate = null;
            let lastHours = 0;
            let lastSum = 0;
            
            if (lastReport) {
              lastDate = lastReport.report_date;
              const hoursWorked = Number(lastReport.hours_worked) || 0;
              const isAbsent = lastReport.absent === true || lastReport.absent === 1 || lastReport.absent === '1';
              lastHours = isAbsent ? 0 : hoursWorked;
              lastSum = lastHours * hourlyRate;
            }
            
            // Проверяем, есть ли данные за сегодня или вчера
            let missingDaysWarning = null;
            if (reports.length > 0 && lastReport) {
              const lastReportDate = new Date(lastReport.report_date + 'T00:00:00');
              lastReportDate.setHours(0, 0, 0, 0);
              
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              yesterday.setHours(0, 0, 0, 0);
              
              // Если последний отчет был не сегодня и не вчера
              if (lastReportDate.getTime() < yesterday.getTime()) {
                const daysDiff = Math.floor((today.getTime() - lastReportDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDiff === 1) {
                  // Один день пропущен - показываем дату последнего дня
                  const day = String(lastReportDate.getDate()).padStart(2, '0');
                  const month = String(lastReportDate.getMonth() + 1).padStart(2, '0');
                  const year = lastReportDate.getFullYear();
                  missingDaysWarning = `Не выставлены часы: ${day}.${month}.${year}`;
                } else if (daysDiff > 1) {
                  // Несколько дней пропущено - показываем количество дней
                  missingDaysWarning = `Не выставлены часы: ${daysDiff} дня`;
                }
              } else if (lastReportDate.getTime() === yesterday.getTime()) {
                // Данные только за вчера - проверяем, есть ли данные за сегодня
                const hasTodayReport = reports.some((report: any) => {
                  const reportDate = new Date(report.report_date + 'T00:00:00');
                  reportDate.setHours(0, 0, 0, 0);
                  return reportDate.getTime() === today.getTime();
                });
                
                if (!hasTodayReport) {
                  // Нет данных за сегодня
                  missingDaysWarning = 'Не выставлены часы';
                }
              }
            } else if (reports.length === 0) {
              // Нет отчетов вообще
              missingDaysWarning = 'Не выставлены часы';
            }
            
            return {
              id: emp.id,
              employeeId: emp.id,
              employeeName: employeeName,
              fullName: `${emp.last_name || ''} ${emp.first_name || ''} ${emp.second_name || ''}`.trim(),
              employee: emp, // Сохраняем полный объект сотрудника для аватара
              date: lastDate, // Дата последнего отчета в формате YYYY-MM-DD
              hours: lastHours, // Часы за последний отчет
              hourlyRate: hourlyRate,
              totalSum: lastSum, // Сумма за последний отчет
              reports: reports, // Все отчеты (отсортированные от новых к старым)
              lastReport: lastReport, // Сохраняем последний отчет для проверки комментария
              missingDaysWarning: missingDaysWarning,
            };
          } catch (error) {
            console.error(`Error loading work reports for employee ${emp.id}:`, error);
            const hourlyRate = emp.pivot?.rate_per_hour || emp.rate_per_hour || emp.pivot?.hourly_rate || 0;
            const employeeName = `${emp.last_name || ''} ${emp.first_name ? `${emp.first_name.charAt(0)}.` : ''}${emp.second_name ? `${emp.second_name.charAt(0)}.` : ''}`.trim();
            return {
              id: emp.id,
              employeeId: emp.id,
              employeeName: employeeName,
              fullName: `${emp.last_name || ''} ${emp.first_name || ''} ${emp.second_name || ''}`.trim(),
              employee: emp,
              date: null,
              hours: 0,
              hourlyRate: hourlyRate,
              totalSum: 0,
              reports: [],
              lastReport: null,
              missingDaysWarning: 'Не выставлены часы',
            };
          }
        })
      );

      setTrackingItems(trackingData);
    } catch (error) {
      console.error('Error loading tracking items:', error);
    }
  }, [project?.id, project?.employees]);

  useEffect(() => {
    if (activeTab !== 'tracking' || !project?.id) {
      setIsTrackingLoading(false);
      return;
    }

    let isCancelled = false;
    setIsTrackingLoading(true);

    const loadTracking = async () => {
      try {
        await loadTrackingItems();
      } catch (error) {
        console.error('Error loading tracking:', error);
      } finally {
        if (!isCancelled) {
          setIsTrackingLoading(false);
        }
      }
    };

    loadTracking();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, project?.id, project?.employees, loadTrackingItems]);

  const handleOpenFactModal = async (item: SpecificationItem) => {
    setSelectedNomenclature(item);
    setIsFactModalOpen(true);
    setExistingFact(null);

    // Загружаем существующие факты для этой номенклатуры
    if (project?.id && item.id) {
      try {
        const factsResponse = await apiService.getNomenclatureFacts(project.id, item.id, {
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

        // Фильтруем удаленные факты
        const activeFacts = factsData.filter((fact: any) => !fact.is_deleted);
        
        // Если есть факты, берем последний (самый новый по дате)
        if (activeFacts.length > 0) {
          // Сортируем по дате (от новых к старым)
          activeFacts.sort((a: any, b: any) => {
            const dateA = new Date(a.fact_date).getTime();
            const dateB = new Date(b.fact_date).getTime();
            return dateB - dateA;
          });
          
          const latestFact = activeFacts[0];
          setExistingFact({
            id: latestFact.id,
            amount: Number(latestFact.amount) || 0,
            fact_date: latestFact.fact_date,
          });
        }
      } catch (error) {
        console.error('Error loading existing facts:', error);
        // Продолжаем работу, даже если не удалось загрузить факты
      }
    }
  };

  const handleCloseFactModal = () => {
    setIsFactModalOpen(false);
    setSelectedNomenclature(null);
    setExistingFact(null);
  };

  const handleSaveFact = async (quantity: number, date: string) => {
    if (!selectedNomenclature || !project?.id) return;

    try {
      // Если есть существующий факт для этой даты, обновляем его
      if (existingFact && existingFact.fact_date === date) {
        await apiService.updateNomenclatureFact(
          project.id,
          selectedNomenclature.id,
          existingFact.id,
          quantity,
          date
        );
      } else {
        // Проверяем, есть ли факт для выбранной даты
        try {
          const factsResponse = await apiService.getNomenclatureFacts(project.id, selectedNomenclature.id, {
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

          // Ищем факт для выбранной даты
          const factForDate = factsData.find((fact: any) => 
            !fact.is_deleted && fact.fact_date === date
          );

          if (factForDate) {
            // Обновляем существующий факт
            await apiService.updateNomenclatureFact(
              project.id,
              selectedNomenclature.id,
              factForDate.id,
              quantity,
              date
            );
          } else {
            // Создаем новый факт
            await apiService.createNomenclatureFact(
              project.id,
              selectedNomenclature.id,
              quantity,
              date
            );
          }
        } catch (error) {
          // Если не удалось проверить, создаем новый факт
          await apiService.createNomenclatureFact(
            project.id,
            selectedNomenclature.id,
            quantity,
            date
          );
        }
      }
      
      // Обновляем список спецификации после сохранения
      await loadSpecification();
      
      // Закрываем модальное окно
      handleCloseFactModal();
    } catch (error) {
      console.error('Error saving fact:', error);
      // Можно добавить уведомление об ошибке
    }
  };

  // Функция для загрузки спецификации (вынесена отдельно для переиспользования)
  const loadSpecification = React.useCallback(async () => {
    if (!project?.id || !Array.isArray(project?.nomenclature) || project.nomenclature.length === 0) {
      setSpecificationItems([]);
      setIsSpecificationLoading(false);
      return;
    }

    setIsSpecificationLoading(true);

    try {
      const itemsWithMeta = await Promise.all(
        project.nomenclature.map(async (item: any) => {
          let lastChange: number | null = null;
          let factValue: number = 0;

          try {
            // Загружаем изменения
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
            // Игнорируем ошибки загрузки изменений
          }

          try {
            // Загружаем факты и суммируем их
            const factsResponse = await apiService.getNomenclatureFacts(project.id, item.id, {
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
          } catch {
            // Игнорируем ошибки загрузки фактов, используем значение из pivot
            factValue = Number(item?.pivot?.current_amount ?? item?.fact ?? 0);
          }

          const statusMeta = getSpecificationStatusMeta(item);
          const planValue = Number(item?.pivot?.start_amount ?? item?.plan ?? 0);

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

      setSpecificationItems(itemsWithMeta);
    } catch (error) {
      console.error('Error loading specification:', error);
      setSpecificationItems([]);
    } finally {
      setIsSpecificationLoading(false);
    }
  }, [project?.id, project?.nomenclature]);

  const handleOpenHoursModal = async (item: any) => {
    // Создаем объект employee для модального окна
    const employee = {
      id: item.employeeId,
      employeeName: item.employeeName,
      fullName: item.fullName,
      hourlyRate: item.hourlyRate,
    };
    
    setSelectedEmployee(employee);
    setIsHoursModalOpen(true);
    
    // Используем reports из item (уже загружены при формировании trackingItems)
    // Извлекаем даты из reports
    const dates = (item.reports || []).map((report: any) => report.report_date);
    setTrackedDates(dates);
  };

  const handleCloseHoursModal = () => {
    setIsHoursModalOpen(false);
    setSelectedEmployee(null);
  };

  // Функция для получения комментария из последнего отчета (последняя дата)
  const getLastComment = (item: any): { comment: string; date: string } | null => {
    // Используем lastReport из item, если он есть, иначе берем первый из отсортированных reports
    const lastReport = item.lastReport || (item.reports && item.reports.length > 0 ? item.reports[0] : null);
    
    if (!lastReport) return null;
    
    // Проверяем, есть ли комментарий в последнем отчете
    if (lastReport.notes && lastReport.notes.trim() !== '') {
      return {
        comment: lastReport.notes,
        date: lastReport.report_date,
      };
    }
    
    return null;
  };

  const handleOpenCommentModal = (item: any) => {
    const lastComment = getLastComment(item);
    if (lastComment) {
      setSelectedComment({
        comment: lastComment.comment,
        employeeName: item.employeeName,
        date: lastComment.date,
      });
      setIsCommentModalOpen(true);
    }
  };

  const handleCloseCommentModal = () => {
    setIsCommentModalOpen(false);
    setSelectedComment(null);
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
  const sortedSpecificationItems = useMemo(() => {
    const sorted = [...specificationItems];
    if (specificationSortField) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (specificationSortField) {
          case 'id':
            aValue = a.id || 0;
            bValue = b.id || 0;
            break;
          case 'name':
            aValue = (a.name || '').toLowerCase();
            bValue = (b.name || '').toLowerCase();
            break;
          case 'status':
            aValue = (a.statusLabel || '').toLowerCase();
            bValue = (b.statusLabel || '').toLowerCase();
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
          case 'fact':
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
  const sortedTrackingItems = useMemo(() => {
    const sorted = [...trackingItems];
    if (trackingSortField) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (trackingSortField) {
          case 'id':
            aValue = a.id || 0;
            bValue = b.id || 0;
            break;
          case 'name':
            aValue = (a.employeeName || '').toLowerCase();
            bValue = (b.employeeName || '').toLowerCase();
            break;
          case 'date':
            aValue = a.date ? new Date(a.date + 'T00:00:00').getTime() : 0;
            bValue = b.date ? new Date(b.date + 'T00:00:00').getTime() : 0;
            break;
          case 'hours':
            aValue = Number(a.hours) || 0;
            bValue = Number(b.hours) || 0;
            break;
          case 'rate':
            aValue = Number(a.hourlyRate) || 0;
            bValue = Number(b.hourlyRate) || 0;
            break;
          case 'sum':
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

  const handleSaveHours = async (_hours: number, _date: string, _isAbsent: boolean, _reason?: string) => {
    // API вызов теперь выполняется в AddHoursModal
    // Этот callback оставлен для совместимости
  };

  const handleHoursSaveSuccess = async () => {
    // Обновляем trackedDates после успешного сохранения
    if (selectedEmployee) {
      try {
        const response = await apiService.getWorkReports(project.id, selectedEmployee.id, {
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
        const dates = reports.map((report: any) => report.report_date);
        
        setTrackedDates(dates);
      } catch (error) {
        console.error('Error refreshing tracked dates:', error);
      }
    }
    
    // Пересчитываем потраченную сумму
    if (project?.id) {
      try {
        const employees = project?.employees || [];
        const activeEmployees = employees.filter((emp: any) => !emp.pivot?.end_working_date);

        const totalSpent = await Promise.all(
          activeEmployees.map(async (emp: any) => {
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
              
              const totalHours = reports.reduce((sum, report) => {
                const hoursWorked = Number(report.hours_worked) || 0;
                const isAbsent = report.absent === true || report.absent === 1 || report.absent === '1';
                return sum + (isAbsent ? 0 : hoursWorked);
              }, 0);
              
              const rate = emp.pivot?.rate_per_hour || emp.rate_per_hour || emp.pivot?.hourly_rate || 0;
              return totalHours * rate;
            } catch (error) {
              console.error(`Error loading work reports for employee ${emp.id}:`, error);
              return 0;
            }
          })
        );
        
        const projectTotalSpent = totalSpent.reduce((sum, employeeSpent) => sum + employeeSpent, 0);
        setCalculatedSpent(projectTotalSpent);
      } catch (error) {
        console.error('Error refreshing spent:', error);
      }
    }
    
    // Перезагружаем trackingItems после сохранения часов
    if (activeTab === 'tracking') {
      await loadTrackingItems();
    }
  };

  if (isPortrait) {
    return (
      <div className="mobile-project-detail mobile-project-detail--portrait">
        <div className="mobile-project-detail__orientation-message">
          <p>Держите телефон горизонтально</p>
        </div>
      </div>
    );
  }

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
                    </div>

                    <div className="mobile-project-detail__specification-header">
                      {/* <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--checkbox">
                        <input type="checkbox" disabled />
                      </div> */}
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--id"
                        onClick={() => handleSpecificationSort('id')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>ID</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--name"
                        onClick={() => handleSpecificationSort('name')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Номенклатура</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col"
                        onClick={() => handleSpecificationSort('status')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Статус</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col"
                        onClick={() => handleSpecificationSort('unit')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Ед. изм.</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number"
                        onClick={() => handleSpecificationSort('plan')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Кол-во</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number"
                        onClick={() => handleSpecificationSort('changes')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Кол-во</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number"
                        onClick={() => handleSpecificationSort('fact')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Кол-во</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--action">
                        <span>Действие</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                    </div>

                    <div className="mobile-project-detail__specification-body">
                      {sortedSpecificationItems.map((item) => (
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
                            <button
                              type="button"
                              className="mobile-project-detail__specification-action"
                              onClick={() => handleOpenFactModal(item)}
                            >
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
            <section className="mobile-project-detail__tracking">
              {isTrackingLoading ? (
                <div className="mobile-project-detail__state">Загружаем фиксацию работ…</div>
              ) : trackingItems.length === 0 ? (
                <div className="mobile-project-detail__tracking-empty">
                  <p>Нет данных о фиксации работ.</p>
                </div>
              ) : (
                <div className="mobile-project-detail__tracking-table-wrapper">
                  <div className="mobile-project-detail__tracking-table">
                    <div className="mobile-project-detail__tracking-header">
                      <div 
                        className="mobile-project-detail__tracking-header-col"
                        onClick={() => handleTrackingSort('id')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>ID</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__tracking-header-col"
                        onClick={() => handleTrackingSort('name')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>ФИО сотрудника</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__tracking-header-col"
                        onClick={() => handleTrackingSort('date')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Дата</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__tracking-header-col"
                        onClick={() => handleTrackingSort('hours')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Кол-во часов</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__tracking-header-col"
                        onClick={() => handleTrackingSort('rate')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Ставка в час</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__tracking-header-col"
                        onClick={() => handleTrackingSort('sum')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>Сумма</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__tracking-header-col">
                        <span>Действие</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                    </div>

                    <div className="mobile-project-detail__tracking-body">
                      {sortedTrackingItems.map((item) => (
                        <div key={item.id} className="mobile-project-detail__tracking-row">
                          <div className="mobile-project-detail__tracking-col">
                            <span>{item.id}</span>
                          </div>
                          <div className="mobile-project-detail__tracking-col mobile-project-detail__tracking-col--employee">
                            <div className="mobile-project-detail__tracking-employee">
                              {item.employee?.avatar_id || item.employee?.avatar_url ? (
                                <img 
                                  src={item.employee.avatar_url || `http://92.53.97.20/api/avatars/${item.employee.avatar_id}`} 
                                  alt={item.employeeName} 
                                  className="mobile-project-detail__tracking-avatar" 
                                />
                              ) : (
                                <div 
                                  className="mobile-project-detail__tracking-avatar mobile-project-detail__tracking-avatar--initials"
                                  style={{ backgroundColor: getAvatarColor(item.fullName || item.employeeName) }}
                                >
                                  {getInitials(item.employee || {})}
                                </div>
                              )}
                              <div className="mobile-project-detail__tracking-employee-info">
                                <span className="mobile-project-detail__tracking-employee-name">{item.employeeName}</span>
                                {item.missingDaysWarning && (
                                  <span className="mobile-project-detail__tracking-warning">{item.missingDaysWarning}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="mobile-project-detail__tracking-col">
                            <span>{item.date ? formatDate(item.date) : '—'}</span>
                          </div>
                          <div className="mobile-project-detail__tracking-col mobile-project-detail__tracking-col--number">
                            <div className="mobile-project-detail__tracking-hours-wrapper">
                              <span>{Math.round(Number(item.hours) || 0)}</span>
                              {(() => {
                                const lastComment = getLastComment(item);
                                if (lastComment) {
                                  return (
                                    <button
                                      type="button"
                                      className="mobile-project-detail__tracking-comment-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCommentModal(item);
                                      }}
                                      aria-label="Показать комментарий"
                                    >
                                      <img src={commentMobIcon} alt="Комментарий" />
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                          <div className="mobile-project-detail__tracking-col mobile-project-detail__tracking-col--number">
                            <span>{formatCurrency(item.hourlyRate)}</span>
                          </div>
                          <div className="mobile-project-detail__tracking-col mobile-project-detail__tracking-col--number">
                            <span>{formatCurrency(item.totalSum)}</span>
                          </div>
                          <div className="mobile-project-detail__tracking-col mobile-project-detail__tracking-col--action">
                            <button
                              type="button"
                              className="mobile-project-detail__tracking-action"
                              onClick={() => handleOpenHoursModal(item)}
                            >
                              Ввести часы
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
        </div>
      )}

      {selectedNomenclature && (
        <AddFactModal
          isOpen={isFactModalOpen}
          onClose={handleCloseFactModal}
          onSave={handleSaveFact}
          nomenclature={{
            id: selectedNomenclature.id,
            name: selectedNomenclature.name,
            unit: selectedNomenclature.unit,
            previousValue: selectedNomenclature.fact || undefined,
          }}
          existingFact={existingFact}
        />
      )}

      {selectedEmployee && (
        <AddHoursModal
          isOpen={isHoursModalOpen}
          onClose={handleCloseHoursModal}
          onSave={handleSaveHours}
          projectId={project.id}
          employee={{
            id: selectedEmployee.id,
            name: selectedEmployee.employeeName,
            hourlyRate: selectedEmployee.hourlyRate,
          }}
          trackedDates={trackedDates}
          onSuccess={handleHoursSaveSuccess}
        />
      )}

      {selectedComment && (
        <CommentModal
          isOpen={isCommentModalOpen}
          onClose={handleCloseCommentModal}
          comment={selectedComment.comment}
          employeeName={selectedComment.employeeName}
          date={selectedComment.date ? (() => {
            const date = new Date(selectedComment.date);
            if (Number.isNaN(date.getTime())) return undefined;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}.${month}.${year}`;
          })() : undefined}
        />
      )}
    </div>
  );
};
