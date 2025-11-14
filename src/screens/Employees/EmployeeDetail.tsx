import React, { useState, useEffect, useRef } from 'react';
import { TextInput } from '../../shared/ui/TextInput';
import { Button } from '../../shared/ui/Button';
import { Pagination } from '../../shared/ui/Pagination/Pagination';
import dotsIcon from '../../shared/icons/dotsIcon.svg';
import userDropdownIcon from '../../shared/icons/user-dropdown-icon.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import calendarIconGrey from '../../shared/icons/calendarIconGrey.svg';
import { apiService } from '../../services/api';
import './employee-detail.scss';

type EmployeeDetailProps = {
  employee: any;
  onBack: () => void;
  onSave?: (updatedEmployee: any) => void;
  onCreate?: (createdEmployee: any) => void;
  isNew?: boolean;
};
export const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employee, onBack, onSave, onCreate, isNew = false }) => {
  const mapWorkSchedule = (value?: string) => {
    if (!value) {
      return '5/2 будни';
    }
    return value === '5/2' ? '5/2 будни' : value;
  };

  const [formData, setFormData] = useState(() => ({
    first_name: employee.first_name || '',
    last_name: employee.last_name || '',
    second_name: employee.second_name || '',
    phone: employee.phone || '',
    email: employee.email || '',
    position: employee.role || 'Управляющий',
    work_schedule: mapWorkSchedule(employee.work_schedule),
    status: employee.is_dismissed || employee.dismissal_date ? 'Уволен' : 'Работает',
    rate_per_hour: employee.rate_per_hour ? String(employee.rate_per_hour) : '',
    password: isNew ? '' : '*************',
    birth_date: employee.birth_date || '',
    gender: employee.gender || 'male',
    employment_date: employee.employment_date || '',
    dateFrom: '',
    dateTo: '',
  }));

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isDotsMenuOpen, setIsDotsMenuOpen] = useState(false);
  const [isPositionDropdownOpen, setIsPositionDropdownOpen] = useState(false);
  const [isScheduleDropdownOpen, setIsScheduleDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isGenderDropdownOpen, setIsGenderDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dotsMenuRef = React.useRef<HTMLDivElement>(null);
  const positionDropdownRef = React.useRef<HTMLDivElement>(null);
  const scheduleDropdownRef = React.useRef<HTMLDivElement>(null);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);
  const genderDropdownRef = React.useRef<HTMLDivElement>(null);
  const dateFromRef = React.useRef<HTMLInputElement>(null);
  const dateToRef = React.useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  // Опции для выпадающих списков
  const positionOptions = ['Управляющий', 'Менеджер', 'Монтажник', 'Инженер', 'Бухгалтер', 'Сметчик', 'Бригадир'];
  const scheduleOptions = ['5/2 будни', '2/2'];
  const statusOptions = ['Работает', 'Уволен'];
  const genderOptions = [
    { value: 'male', label: 'Мужской' },
    { value: 'female', label: 'Женский' },
  ];

  // Закрытие дропдаунов при клике вне их
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dotsMenuRef.current && !dotsMenuRef.current.contains(event.target as Node)) {
        setIsDotsMenuOpen(false);
      }
      if (positionDropdownRef.current && !positionDropdownRef.current.contains(event.target as Node)) {
        setIsPositionDropdownOpen(false);
      }
      if (scheduleDropdownRef.current && !scheduleDropdownRef.current.contains(event.target as Node)) {
        setIsScheduleDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target as Node)) {
        setIsGenderDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isNew) {
      return;
    }

    setFormData({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      second_name: employee.second_name || '',
      phone: employee.phone || '',
      email: employee.email || '',
      position: employee.role || 'Управляющий',
      work_schedule: mapWorkSchedule(employee.work_schedule),
      status: employee.is_dismissed || employee.dismissal_date ? 'Уволен' : 'Работает',
      rate_per_hour: employee.rate_per_hour ? String(employee.rate_per_hour) : '',
      password: '*************',
      birth_date: employee.birth_date || '',
      gender: employee.gender || 'male',
      employment_date: employee.employment_date || '',
      dateFrom: '',
      dateTo: '',
    });
  }, [employee, isNew]);

  // Форматирование даты в формате дд.мм.гггг
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return null;
    }
  };

  // Моковые данные для истории выплат ЗП
  const salaryHistory = [
    { month: 'Сентрябрь', year: '2025', hours: 50, rate: 300, total: 15000, firstPayout: { amount: 5000, date: '11 сен 2025', method: 'Карта' }, secondPayout: { amount: 8000, date: '20 сен 2025', method: 'Наличные' }, balance: { amount: 2000, date: '30 сен 2025', method: 'Наличные' } },
    { month: 'Октябрь', year: '2025', hours: 50, rate: 300, total: 15000, firstPayout: { amount: 5000, date: '11 сен 2025', method: 'Карта' }, secondPayout: { amount: 8000, date: '20 сен 2025', method: 'Наличные' }, balance: { amount: 2000, date: '30 сен 2025', method: 'Наличные' } },
    { month: 'Ноябрь', year: '2025', hours: 50, rate: 300, total: 15000, firstPayout: { amount: 5000, date: '11 сен 2025', method: 'Карта' }, secondPayout: { amount: 8000, date: '20 сен 2025', method: 'Наличные' }, balance: { amount: 2000, date: '30 сен 2025', method: 'Наличные' } },
    { month: 'Декабрь', year: '2025', hours: 50, rate: 300, total: 15000, firstPayout: { amount: 5000, date: '11 сен 2025', method: 'Карта' }, secondPayout: { amount: 8000, date: '20 сен 2025', method: 'Наличные' }, balance: { amount: 2000, date: '30 сен 2025', method: 'Наличные' } },
    { month: 'Январь', year: '2026', hours: 50, rate: 300, total: 15000, firstPayout: { amount: 5000, date: '11 сен 2025', method: 'Карта' }, secondPayout: { amount: 8000, date: '20 сен 2025', method: 'Наличные' }, balance: { amount: 2000, date: '30 сен 2025', method: 'Наличные' } },
  ];

  const totalPages = Math.ceil(salaryHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHistory = salaryHistory.slice(startIndex, endIndex);
  const paginationRef = useRef<HTMLDivElement>(null);

  // Убираем паддинги у компонента Pagination через useEffect
  useEffect(() => {
    if (paginationRef.current) {
      const paginationElement = paginationRef.current.querySelector('.pagination') as HTMLElement;
      if (paginationElement) {
        paginationElement.style.padding = '0';
        paginationElement.style.margin = '0';
      }
    }
  }, [currentPage]);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    const trimmedFirstName = formData.first_name.trim();
    const trimmedLastName = formData.last_name.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();

    if (!trimmedLastName || !trimmedFirstName) {
      alert('Заполните фамилию и имя сотрудника');
      return;
    }

    if (!trimmedEmail) {
      alert('Укажите электронную почту');
      return;
    }

    if (!trimmedPhone) {
      alert('Укажите номер телефона');
      return;
    }

    if (isNew) {
      if (!formData.password.trim()) {
        alert('Введите пароль для сотрудника');
        return;
      }

      if (!formData.birth_date) {
        alert('Укажите дату рождения');
        return;
      }

      const employmentDateValue = formData.employment_date || new Date().toISOString().split('T')[0];
      const rateValue = formData.rate_per_hour ? Number(formData.rate_per_hour) : 0;

      setIsSaving(true);
      try {
        const payload = {
          first_name: trimmedFirstName,
          second_name: formData.second_name.trim(),
          last_name: trimmedLastName,
          birth_date: formData.birth_date,
          gender: formData.gender,
          email: trimmedEmail,
          phone: trimmedPhone,
          password: formData.password,
          role: formData.position,
          is_employee: true,
          is_system_admin: false,
          employment_date: employmentDateValue,
          position: formData.position,
          employee_status: formData.status === 'Работает' ? 'active' : 'dismissed',
          rate_per_hour: Number.isFinite(rateValue) ? rateValue : 0,
          work_schedule: formData.work_schedule === '5/2 будни' ? '5/2' : formData.work_schedule,
        };

        const response = await apiService.registerEmployee(payload);
        const createdEmployee = response?.data ?? response;

        if (!createdEmployee) {
          throw new Error('Пустой ответ сервера');
        }

        setFormData({
          first_name: createdEmployee.first_name || '',
          last_name: createdEmployee.last_name || '',
          second_name: createdEmployee.second_name || '',
          phone: createdEmployee.phone || '',
          email: createdEmployee.email || '',
          position: createdEmployee.role || createdEmployee.position || formData.position,
          work_schedule: mapWorkSchedule(createdEmployee.work_schedule),
          status: createdEmployee.employee_status === 'dismissed' || createdEmployee.is_dismissed ? 'Уволен' : 'Работает',
          rate_per_hour: createdEmployee.rate_per_hour ? String(createdEmployee.rate_per_hour) : '',
          password: '',
          birth_date: createdEmployee.birth_date || formData.birth_date,
          gender: createdEmployee.gender || formData.gender,
          employment_date: createdEmployee.employment_date || employmentDateValue,
          dateFrom: '',
          dateTo: '',
        });
        setIsPasswordVisible(false);
        setIsStatusDropdownOpen(false);
        setIsGenderDropdownOpen(false);
        setIsScheduleDropdownOpen(false);
        setIsPositionDropdownOpen(false);
        setIsDotsMenuOpen(false);
        onCreate?.(createdEmployee);
        return;
      } catch (error) {
        console.error('Error creating employee:', error);
        alert('Не удалось создать сотрудника. Проверьте данные и попробуйте ещё раз.');
      } finally {
        setIsSaving(false);
      }

      return;
    }

    const rateValue = formData.rate_per_hour ? Number(formData.rate_per_hour) : 0;

    const updatedEmployee = {
      ...employee,
      first_name: trimmedFirstName,
      last_name: trimmedLastName,
      second_name: formData.second_name.trim(),
      phone: trimmedPhone,
      email: trimmedEmail,
      role: formData.position,
      work_schedule: formData.work_schedule,
      employee_status: formData.status === 'Работает' ? 'active' : 'dismissed',
      is_dismissed: formData.status !== 'Работает',
      rate_per_hour: Number.isFinite(rateValue) ? rateValue : 0,
      birth_date: formData.birth_date || employee.birth_date,
      gender: formData.gender || employee.gender,
      employment_date: formData.employment_date || employee.employment_date,
    };

    if (onSave) {
      onSave(updatedEmployee);
    }
    onBack();
  };

  const handleCancel = () => {
    onBack();
  };

  const formatEmployeeName = () => {
    const firstName = formData.first_name || '';
    const lastName = formData.last_name || '';
    const secondName = formData.second_name || '';
    const fullName = `${lastName} ${firstName} ${secondName}`.trim();
    return fullName || 'Новый сотрудник';
  };

  // Функция для получения инициалов (Иван Иванов -> ИИ)
  const getInitials = () => {
    const firstInitial = formData.first_name ? formData.first_name.charAt(0).toUpperCase() : '';
    const lastInitial = formData.last_name ? formData.last_name.charAt(0).toUpperCase() : '';
    return (lastInitial + firstInitial) || 'Н';
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

  const dismissalDateDisplay = employee.dismissal_date ? formatDate(employee.dismissal_date) : '-';
  const employmentDateDisplay = formData.employment_date
    ? formatDate(formData.employment_date)
    : (employee.employment_date ? formatDate(employee.employment_date) : '-') || '-';

  return (
    <div className="employee-detail">
      <div className="employee-detail__content">
        {/* Верхняя часть - детали сотрудника */}
        <div className="employee-detail__card employee-detail__card--top">
          <div className="employee-detail__header">
            <div className="employee-detail__header-left">
              <div className="employee-detail__avatar">
                {employee.avatar_id || employee.avatar_url ? (
                  <img 
                    src={employee.avatar_url || `http://92.53.97.20/api/avatars/${employee.avatar_id}`} 
                    alt={formatEmployeeName()} 
                  />
                ) : (
                  <div 
                    className="employee-detail__avatar-initials"
                    style={{ backgroundColor: getAvatarColor(formatEmployeeName()) }}
                  >
                    {getInitials()}
                  </div>
                )}
              </div>
              <div className="employee-detail__info">
                <div className="employee-detail__name-row">
                  <h2 className="employee-detail__name">{formatEmployeeName()}</h2>
                  <div className="employee-detail__dates">
                    <p className="employee-detail__date">
                      Дата увольнения: {dismissalDateDisplay}
                    </p>
                    <p className="employee-detail__date">
                      Дата трудоустройства: {employmentDateDisplay}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {!isNew && (
              <div className="employee-detail__header-right">
                <div className="employee-detail__dots-menu-wrapper" ref={dotsMenuRef}>
                  <button 
                    className="employee-detail__icon-btn employee-detail__icon-btn--dots"
                    onClick={() => setIsDotsMenuOpen(!isDotsMenuOpen)}
                  >
                    <img src={dotsIcon} alt="Меню" />
                  </button>
                  {isDotsMenuOpen && (
                    <div className="employee-detail__dots-menu">
                      <button 
                        className="employee-detail__dots-menu-item"
                        onClick={() => {
                          setIsDotsMenuOpen(false);
                        }}
                      >
                        Уволить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="employee-detail__fields">
            <div className="employee-detail__fields-row">
              <TextInput
                label="Имя"
                value={formData.first_name}
                onChange={(v) => setFormData({ ...formData, first_name: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
              <TextInput
                label="Фамилия"
                value={formData.last_name}
                onChange={(v) => setFormData({ ...formData, last_name: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
              <TextInput
                label="Отчество"
                value={formData.second_name}
                onChange={(v) => setFormData({ ...formData, second_name: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
              <TextInput
                label="Номер телефона"
                value={formData.phone}
                onChange={(v) => setFormData({ ...formData, phone: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
              <TextInput
                label="Электронная почта"
                value={formData.email}
                onChange={(v) => setFormData({ ...formData, email: v })}
                className="employee-detail__field"
                fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
              />
            </div>

            <div className="employee-detail__fields-row">
              <div className="employee-detail__dropdown-field" ref={positionDropdownRef}>
                <label className="employee-detail__field-label">Должность</label>
                <div 
                  className="employee-detail__dropdown"
                  onClick={() => setIsPositionDropdownOpen(!isPositionDropdownOpen)}
                >
                  <span>{formData.position || 'Управляющий'}</span>
                  <img src={userDropdownIcon} alt="▼" />
                </div>
                {isPositionDropdownOpen && (
                  <div className="employee-detail__dropdown-menu">
                    {positionOptions.map((option) => (
                      <div
                        key={option}
                        className={`employee-detail__dropdown-option ${formData.position === option ? 'employee-detail__dropdown-option--selected' : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, position: option });
                          setIsPositionDropdownOpen(false);
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="employee-detail__dropdown-field" ref={scheduleDropdownRef}>
                <label className="employee-detail__field-label">График работы</label>
                <div 
                  className="employee-detail__dropdown"
                  onClick={() => setIsScheduleDropdownOpen(!isScheduleDropdownOpen)}
                >
                  <span>{formData.work_schedule || '5/2 будни'}</span>
                  <img src={userDropdownIcon} alt="▼" />
                </div>
                {isScheduleDropdownOpen && (
                  <div className="employee-detail__dropdown-menu">
                    {scheduleOptions.map((option) => (
                      <div
                        key={option}
                        className={`employee-detail__dropdown-option ${formData.work_schedule === option ? 'employee-detail__dropdown-option--selected' : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, work_schedule: option });
                          setIsScheduleDropdownOpen(false);
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="employee-detail__dropdown-field" ref={statusDropdownRef}>
                <label className="employee-detail__field-label">Статус</label>
                <div 
                  className="employee-detail__dropdown"
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                >
                  <span>{formData.status}</span>
                  <img src={userDropdownIcon} alt="▼" />
                </div>
                {isStatusDropdownOpen && (
                  <div className="employee-detail__dropdown-menu">
                    {statusOptions.map((option) => (
                      <div
                        key={option}
                        className={`employee-detail__dropdown-option ${formData.status === option ? 'employee-detail__dropdown-option--selected' : ''}`}
                        onClick={() => {
                          setFormData({ ...formData, status: option });
                          setIsStatusDropdownOpen(false);
                        }}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="employee-detail__password-field">
                <label className="employee-detail__field-label">Пароль</label>
                <TextInput
                  value={formData.password}
                  onChange={(v) => setFormData({ ...formData, password: v })}
                  type={isPasswordVisible ? 'text' : 'password'}
                  showPasswordToggle={true}
                  isPasswordVisible={isPasswordVisible}
                  onTogglePassword={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="employee-detail__password-input"
                  fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
                />
              </div>
            </div>

            {isNew && (
              <div className="employee-detail__fields-row">
                <div className="employee-detail__date-field">
                  <label className="employee-detail__field-label">Дата рождения</label>
                  <input
                    type="date"
                    className="employee-detail__date-field-input"
                    value={formData.birth_date || ''}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  />
                </div>
                <div className="employee-detail__dropdown-field employee-detail__dropdown-field--third" ref={genderDropdownRef}>
                  <label className="employee-detail__field-label">Пол</label>
                  <div
                    className="employee-detail__dropdown"
                    onClick={() => setIsGenderDropdownOpen(!isGenderDropdownOpen)}
                  >
                    <span>{genderOptions.find((option) => option.value === formData.gender)?.label || 'Мужской'}</span>
                    <img src={userDropdownIcon} alt="▼" />
                  </div>
                  {isGenderDropdownOpen && (
                    <div className="employee-detail__dropdown-menu">
                      {genderOptions.map((option) => (
                        <div
                          key={option.value}
                          className={`employee-detail__dropdown-option ${formData.gender === option.value ? 'employee-detail__dropdown-option--selected' : ''}`}
                          onClick={() => {
                            setFormData({ ...formData, gender: option.value });
                            setIsGenderDropdownOpen(false);
                          }}
                        >
                          {option.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="employee-detail__finances">
            <h3 className="employee-detail__finances-title">Финансы</h3>
            <TextInput
              label="Ставка, руб/час"
              value={formData.rate_per_hour}
              onChange={(v) => setFormData({ ...formData, rate_per_hour: v })}
              className="employee-detail__rate-input"
              fieldStyle={{ height: '32px', minHeight: '32px', maxHeight: '32px', padding: '6px 12px', lineHeight: '20px', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center' }}
            />
          </div>

          <div className="employee-detail__actions">
            <Button
              text="Отмена"
              className="employee-detail__cancel-btn"
              onClick={handleCancel}
            />
            <Button
              text={isSaving ? 'Сохранение...' : isNew ? 'Создать' : 'Сохранить'}
              className="employee-detail__save-btn"
              disabled={isSaving}
              onClick={() => {
                void handleSave();
              }}
            />
          </div>
        </div>

        {/* Нижняя часть - история выплат ЗП */}
        <div className="employee-detail__card employee-detail__card--bottom">
          <div className="employee-detail__salary-header">
            <h3 className="employee-detail__salary-title">Выдача ЗП</h3>
            <div className="employee-detail__date-range">
              <div className="employee-detail__date-range-left">
                <img src={calendarIconGrey} alt="Календарь" />
                <div 
                  className="employee-detail__date-input-wrapper"
                  onClick={() => {
                    if (dateFromRef.current) {
                      dateFromRef.current.showPicker?.();
                      dateFromRef.current.focus();
                    }
                  }}
                >
                  <input
                    ref={dateFromRef}
                    type="date"
                    className="employee-detail__date-input"
                    value={formData.dateFrom || ''}
                    onChange={(e) => setFormData({ ...formData, dateFrom: e.target.value })}
                  />
                  {!formData.dateFrom && <span className="employee-detail__date-placeholder">С ...</span>}
                </div>
              </div>
              <div className="employee-detail__date-range-divider"></div>
              <div className="employee-detail__date-range-right">
                <div 
                  className="employee-detail__date-input-wrapper"
                  onClick={() => {
                    if (dateToRef.current) {
                      dateToRef.current.showPicker?.();
                      dateToRef.current.focus();
                    }
                  }}
                >
                  <input
                    ref={dateToRef}
                    type="date"
                    className="employee-detail__date-input"
                    value={formData.dateTo || ''}
                    onChange={(e) => setFormData({ ...formData, dateTo: e.target.value })}
                  />
                  {!formData.dateTo && <span className="employee-detail__date-placeholder">По ...</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="employee-detail__salary-table">
            <div className="employee-detail__salary-table-header">
              <div className="employee-detail__salary-table-header-col">
                <input type="checkbox" />
                <span>Месяц</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Кол-во часов</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Ставка, ₽/час</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Всего</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>1-я выплата</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Способ</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>2-я выплата</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Способ</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Остаток</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
              <div className="employee-detail__salary-table-header-col">
                <span>Способ</span>
                <img src={upDownTableFilter} alt="↑↓" />
              </div>
            </div>

            <div className="employee-detail__salary-table-body">
              {paginatedHistory.map((item, index) => (
                <div key={index} className="employee-detail__salary-table-row">
                  <div className="employee-detail__salary-table-col">
                    <input type="checkbox" />
                    <div className="employee-detail__month">
                      <span className="employee-detail__month-name">{item.month}</span>
                      <span className="employee-detail__month-year">{item.year}</span>
                    </div>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <span>{item.hours}</span>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <span>{item.rate} ₽</span>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <span>{item.total.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <div className="employee-detail__payout">
                      <span className="employee-detail__payout-amount">{item.firstPayout.amount.toLocaleString('ru-RU')} ₽</span>
                      <span className="employee-detail__payout-date">{item.firstPayout.date}</span>
                    </div>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <span>{item.firstPayout.method}</span>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <div className="employee-detail__payout">
                      <span className="employee-detail__payout-amount">{item.secondPayout.amount.toLocaleString('ru-RU')} ₽</span>
                      <span className="employee-detail__payout-date">{item.secondPayout.date}</span>
                    </div>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <span>{item.secondPayout.method}</span>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <div className="employee-detail__payout">
                      <span className="employee-detail__payout-amount">{item.balance.amount.toLocaleString('ru-RU')} ₽</span>
                      <span className="employee-detail__payout-date">{item.balance.date}</span>
                    </div>
                  </div>
                  <div className="employee-detail__salary-table-col">
                    <span>{item.balance.method}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="employee-detail__salary-pagination">
              <div className="employee-detail__pagination-override" ref={paginationRef}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

