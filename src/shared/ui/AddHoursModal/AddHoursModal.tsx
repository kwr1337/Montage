import React, { useState, useEffect } from 'react';
import closeIcon from '../../icons/closeIcon.svg';
import calendarIconGrey from '../../icons/calendarIconGrey.svg';
import { apiService } from '../../../services/api';
import './add-hours-modal.scss';

type AddHoursModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (hours: number, date: string, isAbsent: boolean, reason?: string) => void;
  projectId: number;
  employee: {
    id: number;
    name: string;
    hourlyRate: number;
  };
  trackedDates?: string[]; // Массив дат в формате YYYY-MM-DD, за которые уже есть фиксация
  onSuccess?: () => void; // Callback после успешного сохранения
};

export const AddHoursModal: React.FC<AddHoursModalProps> = ({
  isOpen,
  onClose,
  onSave,
  projectId,
  employee,
  trackedDates = [],
  onSuccess,
}) => {
  const [hours, setHours] = useState<number>(8);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAbsent, setIsAbsent] = useState(false);
  const [reason, setReason] = useState('');
  const [savedDates, setSavedDates] = useState<string[]>(trackedDates);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Обновляем savedDates при изменении trackedDates
  useEffect(() => {
    setSavedDates(trackedDates);
  }, [trackedDates]);

  // Всегда используем сегодняшнюю дату при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setSelectedDate(today);
    }
  }, [isOpen]);

  // Функция для форматирования даты в YYYY-MM-DD (используем локальное время, чтобы избежать проблем с часовыми поясами)
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Проверка, есть ли фиксация для даты
  const hasTracking = (date: Date): boolean => {
    const dateStr = formatDateString(date);
    return savedDates.includes(dateStr);
  };

  // Показывать "!" только если есть прошлые фиксации и выбранная дата без фиксации
  const needsWarning = (): boolean => {
    return trackedDates.length > 0 && !hasTracking(selectedDate);
  };

  const handleIncrement = () => {
    if (hours < 24 && !isAbsent) {
      setHours((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (!isAbsent) {
      setHours((prev) => Math.max(0, prev - 1));
    }
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAbsent) return;
    const value = e.target.value;
    // Разрешаем только целые числа
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = value === '' ? 0 : parseInt(value, 10);
      if (numValue >= 0 && numValue <= 24) {
        setHours(numValue);
      }
    }
  };

  const handleHoursBlur = () => {
    // Если поле пустое, устанавливаем 8 часов по умолчанию
    if (hours === 0 && !isAbsent) {
      setHours(8);
    }
  };

  // Показывать поле "Причина" если часы != 8 и сотрудник не отсутствовал
  const shouldShowReason = (): boolean => {
    return !isAbsent && hours !== 8;
  };

  const handleSave = async () => {
    // Проверяем, что выбранная дата не в будущем
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateNormalized = new Date(selectedDate);
    selectedDateNormalized.setHours(0, 0, 0, 0);
    
    if (selectedDateNormalized > today) {
      setError('Нельзя фиксировать часы за будущие даты');
      return;
    }
    
    // Проверяем, что если часы не равны 8, то должна быть указана причина
    if (!isAbsent && hours !== 8 && !reason.trim()) {
      setError('Необходимо указать причину, если количество часов отличается от 8');
      return;
    }
    
    // Проверяем, что если сотрудник отсутствовал, то должна быть указана причина
    if (isAbsent && !reason.trim()) {
      setError('Необходимо указать причину отсутствия');
      return;
    }
    
    const dateString = formatDateString(selectedDate);
    setIsSaving(true);
    setError(null);

    try {
      const data = {
        report_date: dateString,
        hours_worked: isAbsent ? 0 : hours,
        absent: isAbsent,
        notes: reason || undefined,
      };

      await apiService.createWorkReport(projectId, employee.id, data);

      // Добавляем дату в savedDates, если её там еще нет
      if (!savedDates.includes(dateString)) {
        setSavedDates([...savedDates, dateString]);
      }

      // Вызываем callback, если передан
      if (onSave) {
        onSave(isAbsent ? 0 : hours, dateString, isAbsent, reason || undefined);
      }

      // Вызываем onSuccess для обновления данных в родительском компоненте
      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving work report:', err);
      setError(err.message || 'Не удалось сохранить данные. Попробуйте позже.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      <div className="add-hours-modal-overlay" onClick={handleOverlayClick} />
      <div className="add-hours-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-hours-modal__header">
          <h2 className="add-hours-modal__title">Фиксация часов</h2>
          <button
            type="button"
            className="add-hours-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <img src={closeIcon} alt="" aria-hidden="true" />
          </button>
        </div>

        <div className="add-hours-modal__content">
          <div className="add-hours-modal__info">
            <div className="add-hours-modal__row">
              <span className="add-hours-modal__label">Фио сотрудника</span>
              <span className="add-hours-modal__value">{employee.name}</span>
            </div>

            <div className="add-hours-modal__row">
              <span className="add-hours-modal__label">Ставка в час</span>
              <span className="add-hours-modal__value">
                {employee.hourlyRate.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          <div className="add-hours-modal__date-wrapper">
            <div className="add-hours-modal__date-picker add-hours-modal__date-picker--disabled">
              <img src={calendarIconGrey} alt="" className="add-hours-modal__date-icon" />
              <span className="add-hours-modal__date-display">{formatDate(selectedDate)}</span>
              {needsWarning() && (
                <span className="add-hours-modal__date-warning" aria-label="Требуется фиксация">
                  !
                </span>
              )}
            </div>
          </div>

          {!isAbsent && (
            <div className="add-hours-modal__quantity">
              <span className="add-hours-modal__quantity-label">введите кол-во часов</span>
              <div className="add-hours-modal__counter">
                <button
                  type="button"
                  className="add-hours-modal__counter-btn"
                  onClick={handleDecrement}
                  aria-label="Уменьшить"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M6 12H18" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <input
                  type="text"
                  className="add-hours-modal__counter-value"
                  value={hours}
                  onChange={handleHoursChange}
                  onBlur={handleHoursBlur}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <button
                  type="button"
                  className="add-hours-modal__counter-btn"
                  onClick={handleIncrement}
                  aria-label="Увеличить"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 6V18M6 12H18" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="add-hours-modal__absent">
            <label className="add-hours-modal__absent-label">
              <input
                type="checkbox"
                checked={isAbsent}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsAbsent(checked);
                  if (checked) {
                    setHours(0);
                    setReason('');
                  } else {
                    setHours(8);
                    setReason('');
                  }
                }}
                className="add-hours-modal__absent-checkbox"
              />
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="add-hours-modal__absent-icon">
                <rect width="16" height="16" rx="4" fill={isAbsent ? '#2787F5' : 'transparent'} stroke="#919399" strokeWidth="1.5"/>
                {isAbsent && (
                  <path d="M4 8L7 11L12 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                )}
              </svg>
              <span className="add-hours-modal__absent-text">Отсутствовал</span>
            </label>
          </div>

          {isAbsent && (
            <div className="add-hours-modal__reason">
              <span className="add-hours-modal__reason-label">Причина отсутствия</span>
              <textarea
                placeholder="Укажите причину отсутствия"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="add-hours-modal__reason-textarea"
              />
            </div>
          )}

          {shouldShowReason() && (
            <div className="add-hours-modal__reason">
              <span className="add-hours-modal__reason-label">Причина</span>
              <textarea
                placeholder="Укажите причину отклонения от стандартных 8 часов"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="add-hours-modal__reason-textarea"
              />
            </div>
          )}

          {error && (
            <div className="add-hours-modal__error">
              {error}
            </div>
          )}
        </div>

        <div className="add-hours-modal__actions">
          <button
            type="button"
            className="add-hours-modal__btn add-hours-modal__btn--cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Отмена
          </button>
          <button
            type="button"
            className="add-hours-modal__btn add-hours-modal__btn--save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
};

