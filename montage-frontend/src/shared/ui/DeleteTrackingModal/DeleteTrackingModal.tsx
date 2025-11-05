import React, { useState, useRef } from 'react';
import closeIcon from '../../icons/closeIcon.svg';
import calendarIconGrey from '../../icons/calendarIconGrey.svg';
import userDropdownIcon from '../../icons/user-dropdown-icon.svg';
import './delete-tracking-modal.scss';

interface DeleteTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (data: { employeeId: number; endDate: string }) => Promise<void>;
  employees?: Array<{
    id: number;
    name: string;
    status: string;
  }>;
}

const DeleteTrackingModal: React.FC<DeleteTrackingModalProps> = ({
  isOpen,
  onClose,
  onDelete,
  employees = [],
}) => {
  // Получаем сегодняшнюю дату в формате YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  const [endDate, setEndDate] = useState(today);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Получаем первого сотрудника для отображения (но удалять будем всех выбранных)
  const displayEmployee = employees[0] || null;

  // Устанавливаем дату по умолчанию при открытии модального окна
  React.useEffect(() => {
    if (isOpen && employees.length > 0) {
      setEndDate(today);
    }
  }, [isOpen, employees, today]);

  const handleSubmit = async () => {
    if (employees.length === 0 || !endDate) {
      return;
    }

    try {
      // Удаляем первого сотрудника из списка выбранных
      // (handleDeleteTracking обрабатывает всех выбранных сотрудников из selectedItems)
      await onDelete({
        employeeId: employees[0].id,
        endDate: endDate,
      });
      
      // Закрываем модальное окно только после успешного удаления
      onClose();
      // Сброс формы
      setEndDate(today);
    } catch (error) {
      // Ошибка обработана в handleDeleteTracking
      console.error('Error in handleSubmit:', error);
    }
  };

  const handleCancel = () => {
    onClose();
    // Сброс формы
    setEndDate(today);
  };

  if (!isOpen || employees.length === 0) return null;

  return (
    <div className="delete-tracking-modal-overlay" onClick={onClose}>
      <div className="delete-tracking-modal" onClick={(e) => e.stopPropagation()}>
        <button className="delete-tracking-modal__close" onClick={onClose}>
          <img src={closeIcon} alt="Закрыть" />
        </button>
        
        <h2 className="delete-tracking-modal__title">Удаление сотрудника</h2>
        
        <div className="delete-tracking-modal__form">
          {/* Первая строка - без отступа между полями */}
          <div className="delete-tracking-modal__row delete-tracking-modal__row--no-gap">
            <div className="delete-tracking-modal__field delete-tracking-modal__field--large">
              <label className="delete-tracking-modal__label">Сотрудник</label>
              <div className="delete-tracking-modal__field--dropdown">
                <div
                  className="delete-tracking-modal__input delete-tracking-modal__input--dropdown"
                  onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                >
                  <span>{displayEmployee?.name || 'Выберите сотрудника'}</span>
                  <img src={userDropdownIcon} alt="▼" />
                </div>
                {isEmployeeDropdownOpen && (
                  <div className="delete-tracking-modal__dropdown">
                    {employees.length === 0 ? (
                      <div className="delete-tracking-modal__dropdown-item delete-tracking-modal__dropdown-item--readonly" style={{ color: '#919399' }}>
                        Нет выбранных сотрудников
                      </div>
                    ) : (
                      employees.map((employee) => (
                        <div
                          key={employee.id}
                          className="delete-tracking-modal__dropdown-item delete-tracking-modal__dropdown-item--readonly"
                        >
                          {employee.name}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="delete-tracking-modal__field delete-tracking-modal__field--large">
              <label className="delete-tracking-modal__label">Статус сотрудника</label>
              <div className="delete-tracking-modal__status-badge">
                Уволен
              </div>
            </div>
          </div>

          {/* Вторая строка */}
          <div className="delete-tracking-modal__row">
            <div className="delete-tracking-modal__field delete-tracking-modal__field--small">
              <label className="delete-tracking-modal__label">Дата ухода с проекта</label>
              <div 
                className="delete-tracking-modal__input delete-tracking-modal__input--date-field"
                onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
              >
                <img src={calendarIconGrey} alt="Календарь" className="delete-tracking-modal__date-icon" />
                <span className="delete-tracking-modal__date-display">
                  {new Date(endDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, ' / ')}
                </span>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="delete-tracking-modal__date-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  max={today}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="delete-tracking-modal__actions">
          <button 
            className="delete-tracking-modal__btn delete-tracking-modal__btn--delete"
            onClick={handleSubmit}
          >
            Удалить
          </button>
          <button 
            className="delete-tracking-modal__btn delete-tracking-modal__btn--cancel"
            onClick={handleCancel}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteTrackingModal;

