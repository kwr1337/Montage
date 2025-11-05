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
import logoIcon from '../../shared/icons/logoIcon.png';
import AddNomenclatureModal from '../../shared/ui/AddNomenclatureModal/AddNomenclatureModal';
import EditNomenclatureModal from '../../shared/ui/EditNomenclatureModal/EditNomenclatureModal';
import ImportModal from '../../shared/ui/ImportModal/ImportModal';
import AddTrackingModal from '../../shared/ui/AddTrackingModal/AddTrackingModal';
import DeleteTrackingModal from '../../shared/ui/DeleteTrackingModal/DeleteTrackingModal';
import { Pagination } from '../../shared/ui/Pagination/Pagination';

type ProjectDetailProps = {
  project: any;
  onBack: () => void;
  onProjectUpdate?: (updatedProject: any) => void;
};

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ project, onBack, onProjectUpdate }) => {
  const [localProject, setLocalProject] = useState(project);
  // Восстанавливаем activeTab из localStorage при загрузке
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(`activeTab_${project.id}`);
    return saved || 'general';
  });

  // Обновляем activeTab при изменении проекта
  useEffect(() => {
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
  const [isForemanDropdownOpen, setIsForemanDropdownOpen] = useState(false);
  const [isDotsMenuOpen, setIsDotsMenuOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
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
  const startDateInputRef = React.useRef<HTMLInputElement>(null);
  const endDateInputRef = React.useRef<HTMLInputElement>(null);
  const datesContainerRef = React.useRef<HTMLDivElement>(null);
  
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

  // Выбранные элементы для удаления
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isDeleteTrackingModalOpen, setIsDeleteTrackingModalOpen] = useState(false);
  const [employeesToDelete, setEmployeesToDelete] = useState<Array<{ id: number; name: string; status: string }>>([]);

  // Данные для фиксации работ - формируем из реальных сотрудников проекта
  const [trackingItems, setTrackingItems] = useState<any[]>([]);

  // Вспомогательная функция для фильтрации активных (не удаленных) сотрудников
  const getActiveEmployees = (employees: any[]) => {
    if (!employees || !Array.isArray(employees)) return [];
    return employees.filter((emp: any) => {
      // Сотрудник считается активным, если у него нет end_working_date
      return !emp.pivot?.end_working_date;
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
      const formattedEmployees = localProject.employees.map((employee: any) => {
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
          hours: 0, // Пока заглушка, потом рассчитаем из отчетов
          lastHours: 0, // Пока заглушка, потом возьмем из последнего отчета
          rate: employee.pivot?.rate_per_hour || employee.rate_per_hour || 0,
          lastSum: 0, // Пока заглушка, потом рассчитаем
          totalSum: 0 // Пока заглушка, потом рассчитаем
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
          // Сбрасываем пагинацию при изменении данных
          setTrackingCurrentPage(1);
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
            localProject.nomenclature.map(async (item: any) => {
              let lastChange = null;
              
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

              return {
                id: item.id,
                name: item.name,
                status: item.is_deleted ? `Удалён\n${new Date(item.deleted_at).toLocaleDateString('ru-RU')}` : 'Активен',
                unit: item.unit,
                plan: item.pivot?.start_amount || 0,
                changes: lastChange,
                fact: 0 // Пока нет данных из мобильной версии
              };
            })
          );
          
          setSpecificationItems(itemsWithChanges);
        } catch (error) {
          // Ошибка загрузки изменений обработана
        }
      }
    };

    loadNomenclatureWithChanges();
  }, [localProject.id]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      // Получаем текущий список сотрудников проекта (включая всех сотрудников)
      // Бригадиры управляются через вкладку "Фиксация работ", поэтому здесь их не трогаем
      const currentEmployees = localProject.employees || [];
      
      // Формируем массив employee для PATCH запроса согласно документации:
      // { id, start_working_date, end_working_date: null, rate_per_hour }
      // Сохраняем всех существующих сотрудников с их данными
      const employeeObjects = currentEmployees.map((emp: any) => ({
        id: emp.id,
        start_working_date: emp.pivot?.start_working_date || localProject.start_date,
        end_working_date: emp.pivot?.end_working_date || null,
        rate_per_hour: emp.pivot?.rate_per_hour || emp.rate_per_hour || 0
      }));

      const updateData: any = {
        name: localProject.name,
        project_manager_id: localProject.project_manager_id || null,
        start_date: formData.startDate,
        end_date: formData.endDate,
        budget: formData.budget ? parseFloat(formData.budget.toString()) : null,
        address: formData.address,
        description: localProject.description || '',
        status: localProject.status || 'В работе',
        employee: employeeObjects
      };

      // Отправляем запрос на обновление проекта
      await apiService.updateProject(localProject.id, updateData);
      
      // Перезагружаем проект, чтобы получить обновленные данные
      const updatedProjectResponse = await apiService.getProjectById(localProject.id);
      if (updatedProjectResponse && updatedProjectResponse.data) {
        const updatedProject = updatedProjectResponse.data;
        setLocalProject(updatedProject);
        
        // Обновляем проект в родительском компоненте
        if (onProjectUpdate) {
          onProjectUpdate(updatedProject);
        }
      }
      
    } catch (error) {
      // Ошибка обработана без уведомления пользователя
    }
  };

  const handleCancel = () => {
    // Сброс к исходным данным
    // Получаем всех бригадиров из проекта
    let foremenList: any[] = [];
    let foremanName = '';
    
    if (localProject.employees && Array.isArray(localProject.employees)) {
      foremenList = localProject.employees.filter((emp: any) => emp.role === 'Бригадир');
      
      if (foremenList.length > 0) {
        const firstForeman = foremenList[0];
        foremanName = formatUserName(firstForeman);
      }
    }
    
    setForemen(foremenList);
    setSelectedForemanId(foremenList.length > 0 ? foremenList[0].id : null);
    
    setFormData({
      address: localProject.address || '',
      startDate: localProject.start_date || '',
      endDate: localProject.end_date || '',
      foreman: foremanName,
      budget: localProject.budget || ''
    });
  };

  const handleAddNomenclature = async (data: { nomenclatureId: number; nomenclature: string; unit: string; quantity: number }) => {
    if (!localProject.id) return;
    
    try {
      // Отправляем запрос на добавление номенклатуры в проект
      await apiService.addNomenclatureToProject(localProject.id, data.nomenclatureId, data.quantity);
      
      // Добавляем новую номенклатуру в список
      const newItem = {
        id: data.nomenclatureId,
        name: data.nomenclature,
        status: 'Активен',
        unit: data.unit,
        plan: data.quantity,
        changes: null,
        fact: 0
      };
      
      setSpecificationItems(prev => [...prev, newItem]);
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
          const formattedHistory = changesResponse.data.reverse().map((change: any) => ({
            date: new Date(change.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
            quantity: `${change.amount_change} ${item.unit || ''}`,
            changedBy: change.user?.last_name || 'Неизвестно' // TODO: получить данные пользователя из API
          }));
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
          const formattedHistory = changesResponse.data.reverse().map((change: any) => ({
            date: new Date(change.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }),
            quantity: `${change.amount_change} ${editingItem.unit || ''}`,
            changedBy: change.user?.last_name || 'Неизвестно'
          }));
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

  const handleImport = (_file: File) => {
    // TODO: Реализовать импорт файла
    // Здесь можно добавить логику обработки импортированного файла
  };

  const handleAddTracking = async (data: { employeeId: number; employeeName: string; rate: number; startDate: string }) => {
    if (!localProject.id) return;

    try {
      // Получаем текущий список сотрудников проекта
      const currentEmployees = localProject.employees || [];
      
      // Находим информацию о новом сотруднике из списка всех сотрудников
      const newEmployeeData = allEmployees.find((emp: any) => emp.id === data.employeeId);
      
      if (!newEmployeeData) {
        console.error('Employee not found in allEmployees list');
        return;
      }

      // ОПТИМИСТИЧНОЕ ОБНОВЛЕНИЕ: Сначала добавляем сотрудника локально
      const optimisticEmployee = {
        ...newEmployeeData,
        pivot: {
          start_working_date: data.startDate,
          end_working_date: null,
          rate_per_hour: data.rate
        }
      };

      const optimisticEmployees = [...currentEmployees, optimisticEmployee];
      const optimisticProject = {
        ...localProject,
        employees: optimisticEmployees
      };

      // Обновляем localProject оптимистично - таблица обновится сразу
      setLocalProject(optimisticProject);
      
      // Обновляем trackingItems оптимистично
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

      // Отправляем PATCH запрос для обновления проекта на сервере
      await apiService.updateProject(localProject.id, {
        employee: employeeArray
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

      // Отправляем PATCH запрос для обновления проекта на сервере
      await apiService.updateProject(localProject.id, {
        employee: employeeArray
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


  // Функция для форматирования даты в "15 дек 2025"
  const formatDateWithMonth = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = date.getDate();
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Пагинация для спецификации
  const totalPages = Math.ceil(specificationItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = specificationItems.slice(startIndex, endIndex);

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
      // Удаляем все выбранные элементы
      for (const itemId of selectedItems) {
        await apiService.removeNomenclature(localProject.id, itemId);
      }

      // Обновляем список элементов, исключая удаленные
      setSpecificationItems(prev => prev.filter(item => !selectedItems.has(item.id)));

      // Очищаем выбор
      setSelectedItems(new Set());
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

  return (
    <>
      {/* Верхняя часть - отдельный блок */}
      <div className="projects__detail-top">
        <div className="projects__detail-header-row">
          {/* Заголовок, статус и последнее изменение в одной строке */}
          <div className="projects__detail-title-row">
            <h1 className="projects__detail-title">{localProject.name}</h1>
            <div className="projects__detail-status-group">
              <div className="projects__status projects__status--in-progress">
                <div className="projects__status-dot"></div>
                <span>{localProject.status}</span>
              </div>
            </div>
            
            {/* Последнее изменение */}
            <div className="projects__detail-last-update">
              Последнее изменение: {formatDateWithMonth(localProject.updated_at)}
            </div>
          </div>

          {/* Иконки действий */}
          <div className="projects__detail-actions-top">
            <div className="projects__detail-icon-buttons">
              <button className="projects__detail-icon-btn">
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
                    <button className="projects__detail-dots-menu-item projects__detail-dots-menu-item--delete">
                      Удалить
                    </button>
                  </div>
                )}
              </div>
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
                const activeEmployees = getActiveEmployees(localProject.employees);
                return activeEmployees.slice(0, 3).map((emp: any) => (
                  <div key={emp.id} className="projects__detail-employee-card">
                    {emp.avatar_id || emp.avatar_url ? (
                      <img 
                        src={emp.avatar_url || `http://92.53.97.20/api/avatars/${emp.avatar_id}`} 
                        alt={`${emp.last_name} ${emp.first_name}`} 
                        className="projects__detail-employee-avatar" 
                      />
                    ) : (
                      <img src={logoIcon} alt={`${emp.last_name} ${emp.first_name}`} className="projects__detail-employee-avatar" />
                    )}
                    <span>{emp.last_name} {emp.first_name.charAt(0)}. {emp.second_name?.charAt(0)}.</span>
                  </div>
                ));
              })()}
            </div>
            {(() => {
              const activeEmployees = getActiveEmployees(localProject.employees);
              return activeEmployees.length > 3 && (
                <div className="projects__detail-employees-more">
                  <span>+{activeEmployees.length - 3}</span>
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
                if (project.id) {
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
                if (project.id) {
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
                if (project.id) {
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
                <div className="projects__form-field">
                  <label>Адрес проекта</label>
                  <input
                    type="text"
                    className="projects__form-input projects__form-input--editable"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Введите адрес проекта"
                  />
                </div>

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

                <div className="projects__form-field">
                  <label>Бригадир</label>
                  <div className="projects__form-field--dropdown">
                    <div 
                      className="projects__form-input projects__form-input--dropdown projects__form-input--readonly"
                      onClick={() => setIsForemanDropdownOpen(!isForemanDropdownOpen)}
                    >
                      <span>{foremen.length > 0 
                        ? formatUserName(foremen[0])
                        : 'Нет бригадиров в проекте'}
                      </span>
                      <img src={userDropdownIcon} alt="▼" />
                    </div>
                    {isForemanDropdownOpen && foremen.length > 0 && (
                      <div className="projects__form-dropdown">
                        {foremen.map((foreman) => (
                          <div
                            key={foreman.id}
                            className="projects__form-dropdown-item projects__form-dropdown-item--readonly"
                          >
                            {formatUserName(foreman)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Форма - вторая строка */}
              <div className="projects__detail-form-row">
                <div className="projects__form-field projects__form-field--single">
                  <label>Выделено на ФОТ</label>
                  <input
                    type="number"
                    className="projects__form-input projects__form-input--editable"
                    value={formData.budget}
                    onChange={(e) => handleInputChange('budget', e.target.value)}
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
                  <div className="projects__specification-header-group">Факт</div>
                </div>

                {/* Заголовок таблицы */}
                <div className="projects__specification-header">
                  <div className="projects__specification-header-col">
                    <input
                      type="checkbox"
                      className="projects__checkbox"
                      checked={paginatedItems.length > 0 && paginatedItems.every(item => selectedItems.has(item.id))}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>ID</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>Номенклатура</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>Статус</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>Ед. изм.</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>Кол-во</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>Кол-во</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>Действие</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__specification-header-col">
                    <span>Кол-во</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                </div>

                {/* Строки таблицы */}
                {paginatedItems.map((item) => (
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
                      <span>{item.id}</span>
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
                      <span>{item.plan}</span>
                    </div>
                    <div className="projects__specification-col">
                      <span>{item.changes !== null ? item.changes : ''}</span>
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
                      <span>{item.fact}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Кнопки внизу с пагинацией */}
              <div className="projects__specification-bottom-actions">
                {/* Пагинация слева */}
                <div className="projects__specification-pagination">
                  {specificationItems.length > itemsPerPage && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  )}
                </div>
                
                {/* Кнопки справа */}
                <div className="projects__specification-bottom-buttons">
                  <button className="projects__specification-bottom-btn projects__specification-bottom-btn--cancel">
                    Отмена
                  </button>
                  <button className="projects__specification-bottom-btn projects__specification-bottom-btn--save">
                    Сохранить
                  </button>
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
                <div className="projects__tracking-header">
                  <div className="projects__tracking-header-col">
                    <input 
                      type="checkbox" 
                      className="projects__checkbox"
                      checked={trackingItems.length > 0 && selectedItems.size === trackingItems.length}
                      onChange={handleSelectAllEmployees}
                    />
                    <span>ФИО</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__tracking-header-col">
                    <span>Статус</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__tracking-header-col">
                    <span>Начало</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__tracking-header-col">
                    <span>Дней</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__tracking-header-col">
                    <span>Часов</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__tracking-header-col">
                    <span>Часов (посл.)</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__tracking-header-col">
                    <span>Ставка, руб/час</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__tracking-header-col">
                    <span>Сумма (посл.)</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                  <div className="projects__tracking-header-col">
                    <span>Сумма (всего)</span>
                    <img src={upDownTableFilter} alt="↑↓" className="projects__sort-icon" />
                  </div>
                </div>

                {/* Строки таблицы */}
                <div className="projects__tracking-rows-wrapper">
                {(() => {
                  // Пагинация для trackingItems
                  const trackingStartIndex = (trackingCurrentPage - 1) * trackingItemsPerPage;
                  const trackingEndIndex = trackingStartIndex + trackingItemsPerPage;
                  const paginatedTrackingItems = trackingItems.slice(trackingStartIndex, trackingEndIndex);
                  
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
                      <span>{item.startDate}</span>
                    </div>
                    <div className="projects__tracking-col">
                      <span>{item.days}</span>
                    </div>
                    <div className="projects__tracking-col">
                      <span>{item.hours}</span>
                    </div>
                    <div className="projects__tracking-col">
                      <span>{item.lastHours}</span>
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
              <div className="projects__tracking-total">
                <div className="projects__tracking-total-label">Итого</div>
                <div className="projects__tracking-total-value">
                  {trackingItems.reduce((sum, item) => sum + item.totalSum, 0).toLocaleString('ru-RU')} ₽
                </div>
              </div>

              {/* Кнопки внизу с пагинацией */}
              <div className="projects__tracking-bottom-actions">
                {/* Пагинация слева */}
                <div className="projects__tracking-pagination">
                  {(() => {
                    const trackingTotalPages = Math.ceil(trackingItems.length / trackingItemsPerPage);
                    return trackingTotalPages > 1 && (
                      <Pagination
                        currentPage={trackingCurrentPage}
                        totalPages={trackingTotalPages}
                        onPageChange={handleTrackingPageChange}
                      />
                    );
                  })()}
                </div>
                
                {/* Кнопки справа */}
                <div className="projects__tracking-bottom-buttons">
                  <button className="projects__tracking-bottom-btn projects__tracking-bottom-btn--cancel">
                    Отмена
                  </button>
                  <button className="projects__tracking-bottom-btn projects__tracking-bottom-btn--save">
                    Сохранить
                  </button>
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
    </>
  );
};

