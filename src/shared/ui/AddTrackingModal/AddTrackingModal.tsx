import React, { useState, useRef } from 'react';
import closeIcon from '../../icons/closeIcon.svg';
import userDropdownIcon from '../../icons/user-dropdown-icon.svg';
import calendarIconGrey from '../../icons/calendarIconGrey.svg';
import './add-tracking-modal.scss';

interface AddTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { employeeId: number; employeeName: string; rate: number; startDate: string }) => Promise<void>;
  employees?: any[];
  projectEmployees?: any[]; // Сотрудники, которые уже в проекте (для фильтрации)
}

const AddTrackingModal: React.FC<AddTrackingModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  employees = [],
  projectEmployees = [],
}) => {
  // Получаем сегодняшнюю дату в формате YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    employeeId: 0,
    employeeName: '',
    status: 'Работает',
    rate: '',
    startDate: today, // Автоматически устанавливаем сегодняшнюю дату
  });
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');

  // Функция для форматирования имени пользователя (должна быть определена до использования)
  const formatUserName = (user: any) => {
    if (!user) return '';
    const { first_name, second_name, last_name } = user;
    const firstNameInitial = first_name ? first_name.charAt(0).toUpperCase() : '';
    const secondNameInitial = second_name ? second_name.charAt(0).toUpperCase() : '';
    return `${last_name} ${firstNameInitial}.${secondNameInitial ? ` ${secondNameInitial}.` : ''}`;
  };

  // Фильтруем сотрудников - показываем только тех, кто еще не в проекте ИЛИ удален из проекта
  // Удаленные сотрудники (с end_working_date) должны снова появляться в списке
  // НО уволенные сотрудники (is_dismissed === true) не должны отображаться
  const availableEmployees = employees.filter((employee: any) => {
    // Исключаем уволенных сотрудников
    if (employee.is_dismissed === true) {
      return false;
    }
    
    const projectEmployee = projectEmployees.find((pe: any) => pe.id === employee.id);
    
    // Если сотрудника нет в проекте - показываем
    if (!projectEmployee) {
      return true;
    }
    
    // Если сотрудник есть в проекте, но удален (есть end_working_date) - показываем
    if (projectEmployee.pivot?.end_working_date) {
      return true;
    }
    
    // Если сотрудник активен в проекте (нет end_working_date) - скрываем
    return false;
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEmployeeSelect = (employee: any) => {
    const employeeName = formatUserName(employee);
    const ratePerHour = employee.rate_per_hour || '';
    
    handleInputChange('employeeId', employee.id);
    handleInputChange('employeeName', employeeName);
    handleInputChange('rate', ratePerHour.toString());
    setIsEmployeeDropdownOpen(false);
    setError(''); // Очищаем ошибку при выборе сотрудника
  };

  const handleSubmit = async () => {
    // Валидация
    if (!formData.employeeId || formData.employeeId === 0) {
      setError('Необходимо выбрать сотрудника');
      return;
    }
    if (!formData.rate || formData.rate.trim() === '') {
      setError('Необходимо ввести ставку в час');
      return;
    }
    const rateValue = parseFloat(formData.rate.replace(/\s/g, '').replace('₽', ''));
    if (isNaN(rateValue) || rateValue <= 0) {
      setError('Ставка должна быть числом больше нуля');
      return;
    }
    if (!formData.startDate) {
      setError('Необходимо выбрать дату входа в проект');
      return;
    }

    // Очищаем ошибку при успешной валидации
    setError('');

    try {
      await onAdd({
        employeeId: formData.employeeId,
        employeeName: formData.employeeName,
        rate: rateValue,
        startDate: formData.startDate,
      });
      
      // Закрываем модальное окно только после успешного добавления
      onClose();
      // Сброс формы
      setFormData({
        employeeId: 0,
        employeeName: '',
        status: 'Работает',
        rate: '',
        startDate: today,
      });
    } catch (error) {
      // Ошибка обработана в handleAddTracking
      console.error('Error in handleSubmit:', error);
    }
  };

  const handleCancel = () => {
    setError('');
    onClose();
    // Сброс формы
    setFormData({
      employeeId: 0,
      employeeName: '',
      status: 'Работает',
      rate: '',
      startDate: today,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="add-tracking-modal-overlay" onClick={onClose}>
      <div className="add-tracking-modal" onClick={(e) => e.stopPropagation()}>
        <button className="add-tracking-modal__close" onClick={onClose}>
          <img src={closeIcon} alt="Закрыть" />
        </button>
        
        <h2 className="add-tracking-modal__title">Добавить сотрудника</h2>
        
        <div className="add-tracking-modal__form">
          {/* Первая строка - без отступа между полями */}
          <div className="add-tracking-modal__row add-tracking-modal__row--no-gap">
            <div className="add-tracking-modal__field add-tracking-modal__field--large">
              <label className="add-tracking-modal__label">Выберите сотрудника</label>
              <div className="add-tracking-modal__field--dropdown">
                <div
                  className="add-tracking-modal__input add-tracking-modal__input--dropdown"
                  onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                >
                  <span>{formData.employeeName || 'Выберите сотрудника'}</span>
                  <img src={userDropdownIcon} alt="▼" />
                </div>
                {isEmployeeDropdownOpen && (
                  <div className="add-tracking-modal__dropdown">
                    {availableEmployees.length === 0 ? (
                      <div className="add-tracking-modal__dropdown-item" style={{ color: '#919399' }}>
                        Нет доступных сотрудников
                      </div>
                    ) : (
                      availableEmployees.map((employee) => (
                        <div
                          key={employee.id}
                          className="add-tracking-modal__dropdown-item"
                          onClick={() => handleEmployeeSelect(employee)}
                        >
                          {formatUserName(employee)}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="add-tracking-modal__field add-tracking-modal__field--large">
              <label className="add-tracking-modal__label">Статус сотрудника</label>
              <div className="add-tracking-modal__status-badge">
                {formData.status}
              </div>
            </div>
          </div>

          {/* Вторая строка */}
          <div className="add-tracking-modal__row">
            <div className="add-tracking-modal__field add-tracking-modal__field--small">
              <label className="add-tracking-modal__label">Дата входа в проект</label>
              <div 
                className="add-tracking-modal__input add-tracking-modal__input--date-field"
                onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
              >
                <img src={calendarIconGrey} alt="Календарь" className="add-tracking-modal__date-icon" />
                <span className="add-tracking-modal__date-display">
                  {new Date(formData.startDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, ' / ')}
                </span>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="add-tracking-modal__date-input"
                  value={formData.startDate}
                  onChange={(e) => {
                    handleInputChange('startDate', e.target.value);
                    setError(''); // Очищаем ошибку при изменении даты
                  }}
                  min={today}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="add-tracking-modal__field add-tracking-modal__field--small">
              <label className="add-tracking-modal__label">Введите ставку в час</label>
              <div className="add-tracking-modal__currency-input">
                <input
                  type="text"
                  className="add-tracking-modal__input add-tracking-modal__input--rate"
                  value={formData.rate ? (parseFloat(String(formData.rate).replace(/\s/g, '').replace(',', '.')) || 0).toLocaleString('ru-RU') : ''}
                  onChange={(e) => {
                    let val = e.target.value.replace(/\s/g, '').replace(',', '.');
                    val = val.replace(/[^\d.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    handleInputChange('rate', val);
                    setError('');
                  }}
                  placeholder="950"
                />
                <span className="add-tracking-modal__currency-suffix">₽</span>
              </div>
            </div>
          </div>
          {error && (
            <div className="add-tracking-modal__error">
              {error}
            </div>
          )}
        </div>

        <div className="add-tracking-modal__actions">
          <button 
            className="add-tracking-modal__btn add-tracking-modal__btn--add"
            onClick={handleSubmit}
          >
            Добавить
          </button>
          <button 
            className="add-tracking-modal__btn add-tracking-modal__btn--cancel"
            onClick={handleCancel}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTrackingModal;

