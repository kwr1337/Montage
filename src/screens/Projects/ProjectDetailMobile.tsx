import React, { useEffect, useMemo, useState } from 'react';
import paginationIconActiveLeft from '../../shared/icons/paginationIconActiveLeft.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import commentMobIcon from '../../shared/icons/commentMob.svg';
import { apiService } from '../../services/api';
import { AddFactModal } from '../../shared/ui/AddFactModal/AddFactModal';
import { AddHoursModal } from '../../shared/ui/AddHoursModal/AddHoursModal';
import { CommentModal } from '../../shared/ui/CommentModal/CommentModal';
import { AddEmployeesModal, type WorkerWithBusy } from '../../shared/ui/AddEmployeesModal/AddEmployeesModal';
import { RemoveEmployeeConfirmModal } from '../../shared/ui/RemoveEmployeeConfirmModal/RemoveEmployeeConfirmModal';
import '../../shared/ui/AddFactModal/add-fact-modal.scss';
import '../../shared/ui/AddHoursModal/add-hours-modal.scss';
import '../../shared/ui/CommentModal/comment-modal.scss';
import '../../shared/ui/AddEmployeesModal/add-employees-modal.scss';
import '../../shared/ui/RemoveEmployeeConfirmModal/remove-employee-confirm-modal.scss';
import './project-detail-mobile.scss';

type ProjectDetailMobileProps = {
  project: any;
  onBack: () => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
  /** Тестовые данные для просмотра без бэкенда */
  mockApiResponses?: {
    getNomenclatureChanges?: Record<string, { data: any[] }>;
    getNomenclatureFacts?: Record<string, { data: any[] }>;
    getAssignments?: { data: any[] };
    getAssignmentsWorkers?: { data: any[] };
  };
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

  return Math.floor(numeric).toLocaleString('ru-RU');
};

/** Локальная дата YYYY-MM-DD (для сравнения с fact_date) */
const getTodayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Нормализует fact_date к YYYY-MM-DD (API может вернуть с временем) */
const normalizeFactDate = (d: string | undefined | null) =>
  (d || '').slice(0, 10);

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
  npp?: number;
  name: string;
  unit: string;
  plan: number;
  changes: number | null;
  fact: number | null;
  /** Сумма фактов по бригадирам за день (user_id -> sum) */
  factByForeman?: Record<number, number>;
  statusLabel: string;
  statusVariant: 'active' | 'deleted';
};

export const ProjectDetailMobile: React.FC<ProjectDetailMobileProps> = ({ project, onBack, onRefresh, isLoading = false, mockApiResponses }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'specification' | 'tracking'>('general');
  const [specificationItems, setSpecificationItems] = useState<SpecificationItem[]>([]);
  const [isSpecificationLoading, setIsSpecificationLoading] = useState(false);
  const [specificationSortField, setSpecificationSortField] = useState<string | null>('npp');
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

  // Назначения рабочих на день (для вкладки СОТРУДНИКИ)
  const [dayAssignedWorkers, setDayAssignedWorkers] = useState<any[]>([]);
  const [workersWithBusy, setWorkersWithBusy] = useState<WorkerWithBusy[]>([]);
  const [isAddEmployeesModalOpen, setIsAddEmployeesModalOpen] = useState(false);
  const [removeConfirmEmployee, setRemoveConfirmEmployee] = useState<{ id: number; assignment_id?: number; name: string } | null>(null);

  const assignmentDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const foremen = useMemo(() => {
    const employees = project?.employees || [];
    const active = employees.filter((emp: any) => !emp.pivot?.end_working_date);
    return active.filter((emp: any) => emp.role === 'Бригадир');
  }, [project?.employees]);

  // Текущий бригадир (вошедший пользователь) — в колонке Факт показываем только его данные
  const currentForeman = useMemo(() => {
    const currentUser = apiService.getCurrentUser();
    if (!currentUser?.id) return null;
    return foremen.find(
      (f: any) => f.user_id === currentUser.id || f.id === currentUser.id
    ) ?? null;
  }, [foremen]);

  // Колонка Факт: только данные текущего бригадира за день. API использует project_manager_id = id текущего пользователя
  const getMyFactValue = (item: SpecificationItem): number => {
    const currentUser = apiService.getCurrentUser();
    const isBrigadier = (currentUser?.role || currentUser?.position) === 'Бригадир';
    if (isBrigadier && item.factByForeman && currentUser?.id != null) {
      const key = Number(currentUser.id);
      const val = item.factByForeman[key] ?? item.factByForeman[currentUser.id];
      return Number(val) || 0;
    }
    return 0;
  };

  // Колонка Итого: сумма затрат материалов всех бригадиров за всё время
  const getTotalFactValue = (item: SpecificationItem): number => {
    return Number(item.fact) || 0;
  };

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

    // Остаток = Выделено - Израсходовали (рассчитываем локально по work_reports)
    const remaining = Math.max(0, allocated - spentValue);

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

  // Загрузка назначений рабочих на день (вкладка СОТРУДНИКИ и для фильтрации Фиксации работ)
  useEffect(() => {
    if (activeTab !== 'general' && activeTab !== 'tracking') return;
    let isCancelled = false;
    const currentUser = apiService.getCurrentUser();
    const myBrigadierId = currentUser?.id ?? null;

    const loadAssignments = async () => {
      try {
        let assignRes: any;
        let workersRes: any;

        if (mockApiResponses?.getAssignments && mockApiResponses?.getAssignmentsWorkers) {
          assignRes = mockApiResponses.getAssignments;
          workersRes = mockApiResponses.getAssignmentsWorkers;
        } else {
          [assignRes, workersRes] = await Promise.all([
            apiService.getAssignments(assignmentDate, { all: true }),
            apiService.getAssignmentsWorkers(assignmentDate),
          ]);
        }

        if (isCancelled) return;

        // Нормализация назначений: { data: [...] }
        let assigned: any[] = [];
        const assignData = assignRes?.data ?? assignRes;
        if (Array.isArray(assignData)) {
          assigned = assignData;
        } else if (assignData?.data && Array.isArray(assignData.data)) {
          assigned = assignData.data;
        } else if (assignData?.assignments && Array.isArray(assignData.assignments)) {
          assigned = assignData.assignments;
        }

        // Рабочие, занятые другими бригадирами (не текущим) — по данным assignments
        const busyByOther = new Map<number, string>();
        assigned.forEach((a: any) => {
          const brigId = a.brigadier_id ?? a.brigadier?.id;
          const workerId = a.worker_id ?? a.worker?.id;
          if (workerId != null && brigId != null && Number(brigId) !== Number(myBrigadierId)) {
            const brig = a.brigadier;
            const foremanName = brig?.last_name
              ? `${brig.last_name} ${(brig.first_name || '').charAt(0)}. ${(brig.second_name || '').charAt(0)}.`.trim()
              : 'др. бригадиром';
            busyByOther.set(workerId, foremanName);
          }
        });

        // Нормализация workers с busy
        // API /assignments/workers возвращает: assigned, brigadier_id, brigadier (при занятости другим)
        let workers: WorkerWithBusy[] = [];
        const workersData = workersRes?.data ?? workersRes;
        const formatBrigadierName = (b: any) => {
          if (!b) return 'др. бригадиром';
          const ln = b.last_name || '';
          const fi = b.first_name ? `${b.first_name.charAt(0)}.` : '';
          const si = b.second_name ? `${b.second_name.charAt(0)}.` : '';
          return [ln, fi, si].filter(Boolean).join(' ') || 'др. бригадиром';
        };
        const parseWorker = (w: any) => {
          const wid = w.id ?? w.user_id;
          let apiBusy: { foreman_name: string } | undefined;
          if (w.assigned === true && w.brigadier_id != null && Number(w.brigadier_id) !== Number(myBrigadierId)) {
            apiBusy = { foreman_name: formatBrigadierName(w.brigadier) };
          } else if (w.busy) {
            apiBusy = { foreman_name: w.busy?.foreman_name ?? w.busy?.brigadier_name ?? (typeof w.busy === 'string' ? w.busy : 'др. бригадиром') };
          } else if (w.assigned_by) {
            apiBusy = { foreman_name: typeof w.assigned_by === 'string' ? w.assigned_by : w.assigned_by?.foreman_name ?? 'др. бригадиром' };
          } else if (w.assigned_to_brigadier || w.brigadier_name) {
            apiBusy = { foreman_name: w.brigadier_name ?? w.assigned_to_brigadier ?? 'др. бригадиром' };
          }
          const ourBusy = busyByOther.has(wid) ? { foreman_name: busyByOther.get(wid)! } : undefined;
          return {
            id: wid,
            first_name: w.first_name,
            second_name: w.second_name,
            last_name: w.last_name,
            busy: apiBusy ?? ourBusy,
          };
        };
        if (Array.isArray(workersData)) {
          workers = workersData.map(parseWorker);
        } else if (workersData?.workers && Array.isArray(workersData.workers)) {
          workers = workersData.workers.map(parseWorker);
        } else {
          // Fallback: используем users если assignments/workers не вернул данные
          const usersRes = await apiService.getUsers();
          const usersData = usersRes?.data ?? usersRes;
          const arr = Array.isArray(usersData)
            ? usersData
            : Array.isArray(usersData?.data)
            ? usersData.data
            : [];
          workers = arr
            .filter((u: any) => u.is_employee !== false && u.employee_status !== 'dismissed')
            .map((u: any) => {
              const ourBusy = busyByOther.has(u.id) ? { foreman_name: busyByOther.get(u.id)! } : undefined;
              return {
                id: u.id,
                first_name: u.first_name,
                second_name: u.second_name,
                last_name: u.last_name,
                busy: ourBusy,
              };
            });
        }

        // В мобильной версии — только рабочие, добавленные в проект
        const projectEmployeeIds = new Set<number>();
        if (project?.employees && Array.isArray(project.employees)) {
          project.employees
            .filter((emp: any) => !emp.pivot?.end_working_date)
            .forEach((emp: any) => {
              const eid = emp.id ?? emp.user_id;
              if (eid != null) projectEmployeeIds.add(Number(eid));
            });
        }
        const filteredWorkers = workers.filter((w) => projectEmployeeIds.has(w.id));

        if (!isCancelled) setWorkersWithBusy(filteredWorkers);

        // Обогащаем именами: workers + getUsers (assignments/workers может не включать уже назначенных)
        const workersById = new Map(workers.map((w) => [w.id, w]));
        try {
          const usersRes = await apiService.getUsers();
          const usersData = usersRes?.data ?? usersRes;
          const usersArr = Array.isArray(usersData)
            ? usersData
            : Array.isArray(usersData?.data)
            ? usersData.data
            : [];
          usersArr.forEach((u: any) => {
            if (u?.id != null && !workersById.has(u.id)) {
              workersById.set(u.id, {
                id: u.id,
                first_name: u.first_name,
                second_name: u.second_name,
                last_name: u.last_name,
              });
            }
          });
        } catch {
          // игнорируем ошибку getUsers
        }

        // API возвращает { id, worker_id, worker, brigadier_id }. Только свои назначения в день.
        const myAssigned = assigned.filter((a: any) => {
          const brigId = a.brigadier_id ?? a.brigadier?.id;
          return brigId == null || Number(brigId) === Number(myBrigadierId);
        });
        const workersList = myAssigned.map((a: any) => {
          const worker = a.worker ?? a.user ?? {};
          const workerId = a.worker_id ?? worker.id ?? a.user_id ?? a.id;
          const w = workersById.get(workerId);
          return {
            id: workerId,
            assignment_id: a.id,
            first_name: worker.first_name ?? w?.first_name ?? '',
            last_name: worker.last_name ?? w?.last_name ?? '',
            second_name: worker.second_name ?? w?.second_name ?? '',
          };
        });
        setDayAssignedWorkers(workersList);
      } catch (e) {
        console.error('Error loading assignments:', e);
        if (!isCancelled) {
          setDayAssignedWorkers([]);
          setWorkersWithBusy([]);
        }
      }
    };

    loadAssignments();
    return () => { isCancelled = true; };
  }, [activeTab, assignmentDate, isAddEmployeesModalOpen, mockApiResponses, project?.employees]);

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
        const getNomenclatureId = (item: any) =>
          item?.id ?? item?.nomenclature_id ?? item?.pivot?.nomenclature_id;

        const itemsWithMeta = await Promise.all(
          project.nomenclature.map(async (item: any, index: number) => {
            const nomId = getNomenclatureId(item);
            if (!nomId) return null;

            let lastChange: number | null = null;
            let factValue: number = 0;

            try {
              let response: any;
              if (mockApiResponses?.getNomenclatureChanges?.[String(nomId)]) {
                response = mockApiResponses.getNomenclatureChanges[String(nomId)];
              } else {
                response = await apiService.getNomenclatureChanges(project.id, nomId);
              }
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

            let factByForeman: Record<number, number> = {};

            try {
              let factsResponse: any;
              if (mockApiResponses?.getNomenclatureFacts?.[String(nomId)]) {
                factsResponse = mockApiResponses.getNomenclatureFacts[String(nomId)];
              } else {
                factsResponse = await apiService.getNomenclatureFacts(project.id, nomId, {
                  per_page: 1000,
                });
              }

              let factsData: any[] = [];
              if (factsResponse?.data?.data && Array.isArray(factsResponse.data.data)) {
                factsData = factsResponse.data.data;
              } else if (factsResponse?.data && Array.isArray(factsResponse.data)) {
                factsData = factsResponse.data;
              } else if (Array.isArray(factsResponse)) {
                factsData = factsResponse;
              } else if (factsResponse?.data?.facts && Array.isArray(factsResponse.data.facts)) {
                factsData = factsResponse.data.facts;
              }

              const today = getTodayLocal();
              const activeFacts = factsData.filter((fact: any) => !fact.is_deleted);

              // Сумма всех фактов (общая)
              factValue = activeFacts.reduce((sum: number, fact: any) => {
                const amount = Number(fact.amount) || 0;
                return sum + amount;
              }, 0);

              // Сумма за день по бригадирам (project_manager_id -> sum). API: project_manager_id, не user_id
              activeFacts
                .filter((fact: any) => normalizeFactDate(fact.fact_date) === today)
                .forEach((fact: any) => {
                  const uid = fact.project_manager_id ?? fact.user_id ?? fact.user?.id;
                  if (uid != null) {
                    const key = Number(uid);
                    factByForeman[key] = (factByForeman[key] || 0) + (Number(fact.amount) || 0);
                  }
                });
            } catch {
              // Игнорируем ошибки загрузки фактов, используем значение из pivot
              factValue = Number(item?.pivot?.current_amount ?? item?.fact ?? 0);
            }

            const statusMeta = getSpecificationStatusMeta(item);
            const planValue = Number(item?.pivot?.start_amount ?? item?.plan ?? 0);

            return {
              id: nomId,
              npp: item.index_number ?? item.npp ?? item.pivot?.npp ?? index + 1,
              name: item.name || '—',
              unit: item.unit || '—',
              plan: Number.isFinite(planValue) ? planValue : 0,
              changes: lastChange,
              fact: Number.isFinite(factValue) ? factValue : 0,
              factByForeman: Object.keys(factByForeman).length > 0 ? factByForeman : undefined,
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
  }, [project?.id, project?.nomenclature, mockApiResponses]);

  const isGIP = (emp: any) => {
    const role = (emp?.role || emp?.position || '').toLowerCase();
    return role.includes('гип') || role === 'главный инженер проекта';
  };

  // Загружаем и рассчитываем потраченную сумму из work_reports (за всё время, включая удалённых)
  useEffect(() => {
    if (!project?.id) return;

    let isCancelled = false;

    const loadSpent = async () => {
      try {
        const employees = project?.employees || [];
        const employeesForSpent = employees.filter((emp: any) => !isGIP(emp));

        // Загружаем work_reports для ВСЕХ сотрудников (включая удалённых) — за всё время
        const totalSpent = await Promise.all(
          employeesForSpent.map(async (emp: any) => {
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

        const activeFacts = factsData.filter((fact: any) => !fact.is_deleted);
        const currentUser = apiService.getCurrentUser();
        const myId = currentUser?.id;

        // Ищем факт текущего бригадира за сегодня — для предзаполнения и режима редактирования
        const todayStr = getTodayLocal();
        const myFactToday = myId != null
          ? activeFacts.find(
              (f: any) =>
                normalizeFactDate(f.fact_date) === todayStr &&
                (f.project_manager_id ?? f.user_id) === myId
            )
          : null;

        if (myFactToday) {
          setExistingFact({
            id: myFactToday.id,
            amount: Number(myFactToday.amount) || 0,
            fact_date: myFactToday.fact_date,
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
      // Если есть существующий факт для этой даты (от текущего бригадира), обновляем его
      if (existingFact && normalizeFactDate(existingFact.fact_date) === normalizeFactDate(date)) {
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

          // Ищем факт текущего бригадира для выбранной даты — если есть, редактируем
          const currentUser = apiService.getCurrentUser();
          const factForDate = currentUser?.id != null
            ? factsData.find(
                (fact: any) =>
                  !fact.is_deleted &&
                  normalizeFactDate(fact.fact_date) === normalizeFactDate(date) &&
                  (fact.project_manager_id ?? fact.user_id) === currentUser.id
              )
            : null;

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
      
      await loadSpecification();
      await onRefresh?.();
      // Модалка закроется через onClose() после успешного возврата из onSave
      handleCloseFactModal();
    } catch (error) {
      console.error('Error saving fact:', error);
      const msg = error instanceof Error ? error.message : 'Не удалось сохранить факт. Попробуйте позже.';
      throw new Error(msg);
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
      const getNomenclatureIdFromItem = (item: any) =>
        item?.id ?? item?.nomenclature_id ?? item?.pivot?.nomenclature_id;

      const itemsWithMeta = await Promise.all(
        project.nomenclature.map(async (item: any, index: number) => {
          const nomId = getNomenclatureIdFromItem(item);
          if (!nomId) return null;

          let lastChange: number | null = null;
          let factValue: number = 0;

          try {
            let response: any;
            if (mockApiResponses?.getNomenclatureChanges?.[String(nomId)]) {
              response = mockApiResponses.getNomenclatureChanges[String(nomId)];
            } else {
              response = await apiService.getNomenclatureChanges(project.id, nomId);
            }
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

          let factByForeman: Record<number, number> = {};

          try {
            let factsResponse: any;
            if (mockApiResponses?.getNomenclatureFacts?.[String(nomId)]) {
              factsResponse = mockApiResponses.getNomenclatureFacts[String(nomId)];
            } else {
              factsResponse = await apiService.getNomenclatureFacts(project.id, nomId, {
                per_page: 1000,
              });
            }

            let factsData: any[] = [];
            if (factsResponse?.data?.data && Array.isArray(factsResponse.data.data)) {
              factsData = factsResponse.data.data;
            } else if (factsResponse?.data && Array.isArray(factsResponse.data)) {
              factsData = factsResponse.data;
            } else if (Array.isArray(factsResponse)) {
              factsData = factsResponse;
            } else if (factsResponse?.data?.facts && Array.isArray(factsResponse.data.facts)) {
              factsData = factsResponse.data.facts;
            }

            const today = getTodayLocal();
            const activeFacts = factsData.filter((fact: any) => !fact.is_deleted);

            factValue = activeFacts.reduce((sum: number, fact: any) => {
              const amount = Number(fact.amount) || 0;
              return sum + amount;
            }, 0);

            // API: project_manager_id (бригадир), не user_id
            activeFacts
              .filter((fact: any) => normalizeFactDate(fact.fact_date) === today)
              .forEach((fact: any) => {
                const uid = fact.project_manager_id ?? fact.user_id ?? fact.user?.id;
                if (uid != null) {
                  const key = Number(uid);
                  factByForeman[key] = (factByForeman[key] || 0) + (Number(fact.amount) || 0);
                }
              });
          } catch {
            factValue = Number(item?.pivot?.current_amount ?? item?.fact ?? 0);
          }

          const statusMeta = getSpecificationStatusMeta(item);
          const planValue = Number(item?.pivot?.start_amount ?? item?.plan ?? 0);

          return {
            id: nomId,
            npp: item.index_number ?? item.npp ?? item.pivot?.npp ?? index + 1,
            name: item.name || '—',
            unit: item.unit || '—',
            plan: Number.isFinite(planValue) ? planValue : 0,
            changes: lastChange,
            fact: Number.isFinite(factValue) ? factValue : 0,
            factByForeman: Object.keys(factByForeman).length > 0 ? factByForeman : undefined,
            statusLabel: statusMeta.label,
            statusVariant: statusMeta.variant,
          } as SpecificationItem;
        })
      );

      const validItems = itemsWithMeta.filter((it): it is SpecificationItem => it !== null);
      setSpecificationItems(validItems);
    } catch (error) {
      console.error('Error loading specification:', error);
      setSpecificationItems([]);
    } finally {
      setIsSpecificationLoading(false);
    }
  }, [project?.id, project?.nomenclature, mockApiResponses]);

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

  const formatWorkerNameShort = (emp: any) => {
    if (!emp) return '—';
    const ln = emp.last_name || '';
    const fi = emp.first_name ? `${emp.first_name.charAt(0)}.` : '';
    const si = emp.second_name ? `${emp.second_name.charAt(0)}.` : '';
    const name = `${ln} ${fi}${si}`.trim();
    return name || (emp.id ? `Рабочий #${emp.id}` : '—');
  };

  const handleAddEmployees = async (workerIds: number[]) => {
    const toAdd = workersWithBusy
      .filter((w) => workerIds.includes(w.id))
      .map((w) => ({
        id: w.id,
        first_name: w.first_name,
        second_name: w.second_name,
        last_name: w.last_name,
      }));
    if (!mockApiResponses) {
      for (const id of workerIds) {
        const res = await apiService.addAssignment(id, assignmentDate);
        const created = res?.data ?? res;
        const assignmentId = created?.id ?? created?.data?.id;
        const added = toAdd.find((w) => w.id === id);
        if (added && assignmentId != null) {
          (added as any).assignment_id = assignmentId;
        }
      }
    }
    setDayAssignedWorkers((prev) => {
      const existingIds = new Set(prev.map((p: any) => p.id));
      const newOnes = toAdd.filter((w) => !existingIds.has(w.id));
      return [...prev, ...newOnes];
    });
    await onRefresh?.();
  };

  const handleRemoveEmployee = async () => {
    if (!removeConfirmEmployee) return;
    if (!mockApiResponses) {
      // Бэкенд ожидает worker_id в URL (по аналогии с add), не assignment_id
      const deleteId = removeConfirmEmployee.id;
      await apiService.deleteAssignment(deleteId, assignmentDate);
    }
    setDayAssignedWorkers((prev) =>
      prev.filter((p: any) =>
        (removeConfirmEmployee.assignment_id != null
          ? p.assignment_id !== removeConfirmEmployee.assignment_id
          : p.id !== removeConfirmEmployee.id)
      )
    );
    setRemoveConfirmEmployee(null);
    await onRefresh?.();
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
          case 'npp':
            aValue = a.npp ?? 0;
            bValue = b.npp ?? 0;
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
            aValue = getMyFactValue(a);
            bValue = getMyFactValue(b);
            break;
          case 'total':
            aValue = getTotalFactValue(a);
            bValue = getTotalFactValue(b);
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
  }, [specificationItems, specificationSortField, specificationSortDirection, foremen, currentForeman]);

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
  // Бригадир видит только своих назначенных на сегодня + себя для ввода часов
  const sortedTrackingItems = useMemo(() => {
    const currentUser = apiService.getCurrentUser();
    const isBrigadier = (currentUser?.role || currentUser?.position) === 'Бригадир';
    let items = [...trackingItems];
    if (isBrigadier && currentUser?.id != null) {
      const myAssignedIds = new Set(dayAssignedWorkers.map((w: any) => w.id));
      myAssignedIds.add(currentUser.id); // бригадир может вносить часы и себе
      items = items.filter((item) => myAssignedIds.has(item.employeeId ?? item.id));
    }
    const sorted = items;
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
  }, [trackingItems, trackingSortField, trackingSortDirection, dayAssignedWorkers]);

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
    
    // Пересчитываем потраченную сумму (за всё время, включая удалённых)
    if (project?.id) {
      try {
        const employees = project?.employees || [];
        const employeesForSpent = employees.filter((emp: any) => !isGIP(emp));

        const totalSpent = await Promise.all(
          employeesForSpent.map(async (emp: any) => {
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
    
    if (activeTab === 'tracking') {
      await loadTrackingItems();
    }
    await onRefresh?.();
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
              Общая
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
              Фиксация
            </button>
          </div>
        </div>


      </div>

      {isLoading ? (
        <div className="mobile-project-detail__state">Загружаем проект…</div>
      ) : (
        <div className="mobile-project-detail__content">
          {activeTab === 'general' && (
            <div className="mobile-project-detail__general-scroll">
              <section className="mobile-project-detail__budget">
                <div className="mobile-project-detail__budget-header">
                  <span className="mobile-project-detail__section-label">ФОТ</span>
                  <div className="mobile-project-detail__budget-pills">
                    <div className="mobile-project-detail__budget-pill mobile-project-detail__budget-pill--allocated">
                      <span className="mobile-project-detail__budget-pill-label">Выделено</span>
                      <span className="mobile-project-detail__budget-pill-value">{formatCurrency(summary.allocated)}</span>
                    </div>
                    <div className="mobile-project-detail__budget-pill mobile-project-detail__budget-pill--spent">
                      <span className="mobile-project-detail__budget-pill-label">Израсходовали</span>
                      <span className="mobile-project-detail__budget-pill-value">{formatCurrency(summary.spent)}</span>
                    </div>
                    <div className="mobile-project-detail__budget-pill mobile-project-detail__budget-pill--remaining">
                      <span className="mobile-project-detail__budget-pill-label">Остаток</span>
                      <span className="mobile-project-detail__budget-pill-value">{formatCurrency(summary.remaining)}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mobile-project-detail__employees">
                <div className="mobile-project-detail__employees-header">
                  <span className="mobile-project-detail__section-label">СОТРУДНИКИ</span>
                  <button
                    type="button"
                    className="mobile-project-detail__employees-add"
                    onClick={() => setIsAddEmployeesModalOpen(true)}
                  >
                    + Добавить
                  </button>
                </div>
                <div className="mobile-project-detail__employees-chips">
                  {dayAssignedWorkers.map((emp: any) => (
                    <div key={emp.assignment_id ?? emp.id} className="mobile-project-detail__employees-chip">
                      <span>{formatWorkerNameShort(emp)}</span>
                      <button
                        type="button"
                        className="mobile-project-detail__employees-chip-remove"
                        onClick={() => setRemoveConfirmEmployee({
                          id: emp.id,
                          assignment_id: emp.assignment_id,
                          name: formatWorkerNameShort(emp),
                        })}
                        aria-label="Удалить"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {dayAssignedWorkers.length === 0 && (
                  <div className="mobile-project-detail__employees-empty">
                    Нет сотрудников на сегодня
                  </div>
                )}
              </section>
            </div>
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
                      <div className="mobile-project-detail__specification-header-group">ПЛАН</div>
                      <div className="mobile-project-detail__specification-header-group">ИЗМ.</div>
                      <div className="mobile-project-detail__specification-header-group">ФАКТ</div>
                      <div className="mobile-project-detail__specification-header-group">ИТОГО</div>
                      <div className="mobile-project-detail__specification-header-group" />
                    </div>

                    <div className="mobile-project-detail__specification-header">
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--npp"
                        onClick={() => handleSpecificationSort('npp')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>№</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--name"
                        onClick={() => handleSpecificationSort('name')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>НОМЕНКЛАТУРА</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col"
                        onClick={() => handleSpecificationSort('unit')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>ЕД. ИЗМ.</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number"
                        onClick={() => handleSpecificationSort('plan')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>КОЛ-ВО</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number"
                        onClick={() => handleSpecificationSort('changes')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>КОЛ-ВО</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number"
                        onClick={() => handleSpecificationSort('fact')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>КОЛ-ВО</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div 
                        className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--number"
                        onClick={() => handleSpecificationSort('total')}
                        style={{ cursor: 'pointer' }}
                      >
                        <span>КОЛ-ВО</span>
                        <img src={upDownTableFilter} alt="" aria-hidden="true" />
                      </div>
                      <div className="mobile-project-detail__specification-header-col mobile-project-detail__specification-header-col--action">
                        <span>Действие</span>
                      </div>
                    </div>

                    <div className="mobile-project-detail__specification-body">
                      {sortedSpecificationItems.map((item, index) => {
                        const myFact = getMyFactValue(item);
                        const totalFact = getTotalFactValue(item);
                        return (
                        <div key={item.id} className="mobile-project-detail__specification-row">
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--npp">
                            <span>{item.npp ?? index + 1}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--name">
                            <span>{item.name}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--unit">
                            <span>{item.unit || '—'}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--number">
                            <span>{formatNumber(item.plan, '0')}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--number">
                            <span>{formatNumber(item.changes, '0')}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--number mobile-project-detail__specification-col--fact">
                            <span>{formatNumber(myFact, '0')}</span>
                          </div>
                          <div className="mobile-project-detail__specification-col mobile-project-detail__specification-col--number">
                            <span>{formatNumber(totalFact, '0')}</span>
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
                        );
                      })}
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

      <AddEmployeesModal
        isOpen={isAddEmployeesModalOpen}
        onClose={() => setIsAddEmployeesModalOpen(false)}
        onAdd={handleAddEmployees}
        workers={workersWithBusy}
        myAssignedIds={dayAssignedWorkers.map((w: any) => w.id)}
      />

      <RemoveEmployeeConfirmModal
        isOpen={!!removeConfirmEmployee}
        onClose={() => setRemoveConfirmEmployee(null)}
        onConfirm={handleRemoveEmployee}
        employeeName={removeConfirmEmployee?.name ?? ''}
      />
    </div>
  );
};
