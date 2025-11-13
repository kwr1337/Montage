import React, { useState, useRef, useEffect } from 'react';
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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [savedDates, setSavedDates] = useState<string[]>(trackedDates);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Обновляем savedDates при изменении trackedDates
  useEffect(() => {
    setSavedDates(trackedDates);
  }, [trackedDates]);

  // Устанавливаем последнюю дату из trackedDates при открытии модального окна
  useEffect(() => {
    if (isOpen && trackedDates.length > 0) {
      // Находим последнюю (самую позднюю) дату
      const sortedDates = [...trackedDates].sort((a, b) => {
        const dateA = new Date(a).getTime();
        const dateB = new Date(b).getTime();
        return dateB - dateA; // Сортируем от новых к старым
      });
      
      const lastDate = new Date(sortedDates[0]);
      if (!isNaN(lastDate.getTime())) {
        setSelectedDate(lastDate);
        setCurrentMonth(lastDate);
      }
    } else if (isOpen && trackedDates.length === 0) {
      // Если нет записей, устанавливаем текущую дату
      const today = new Date();
      setSelectedDate(today);
      setCurrentMonth(today);
    }
  }, [isOpen, trackedDates]);

  // Функция для форматирования даты в YYYY-MM-DD
  const formatDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Проверка, есть ли фиксация для даты
  const hasTracking = (date: Date): boolean => {
    const dateStr = formatDateString(date);
    return savedDates.includes(dateStr);
  };

  // Проверка, нужно ли показывать красный "!" для выбранной даты
  const needsWarning = (): boolean => {
    return !hasTracking(selectedDate);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Синхронизируем currentMonth с selectedDate при открытии календаря
      setCurrentMonth(selectedDate);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen, selectedDate]);

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

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Понедельник = 0

    const days: (number | null)[] = [];
    
    // Добавляем пустые ячейки для дней предыдущего месяца
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Добавляем дни текущего месяца
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
    setCurrentMonth(newDate);
    setIsCalendarOpen(false);
  };

  const isDateSelected = (day: number | null) => {
    if (!day) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Проверка, является ли день днем без фиксации (красный)
  const isMissingTracking = (day: number | null): boolean => {
    if (!day) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    // Показываем красным только прошедшие дни без фиксации
    if (date > today) return false;
    return !hasTracking(date);
  };

  if (!isOpen) return null;

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (isCalendarOpen) {
        setIsCalendarOpen(false);
      } else {
        onClose();
      }
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

          <div className="add-hours-modal__date-wrapper" ref={calendarRef}>
            <div
              className="add-hours-modal__date-picker"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            >
              <img src={calendarIconGrey} alt="" className="add-hours-modal__date-icon" />
              <span className="add-hours-modal__date-display">{formatDate(selectedDate)}</span>
              {needsWarning() && (
                <span className="add-hours-modal__date-warning" aria-label="Требуется фиксация">
                  !
                </span>
              )}
            </div>

            {isCalendarOpen && (
              <div className="add-hours-modal__calendar">
                <div className="add-hours-modal__calendar-header">
                  <button
                    type="button"
                    className="add-hours-modal__calendar-nav"
                    onClick={handlePrevMonth}
                    aria-label="Предыдущий месяц"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M12 15L7 10L12 5" stroke="#2787F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <span className="add-hours-modal__calendar-month">
                    {formatMonthYear(currentMonth)}
                  </span>
                  <button
                    type="button"
                    className="add-hours-modal__calendar-nav"
                    onClick={handleNextMonth}
                    aria-label="Следующий месяц"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M8 5L13 10L8 15" stroke="#2787F5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                <div className="add-hours-modal__calendar-weekdays">
                  {weekDays.map((day) => (
                    <div key={day} className="add-hours-modal__calendar-weekday">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="add-hours-modal__calendar-days">
                  {days.map((day, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`add-hours-modal__calendar-day ${
                        !day ? 'add-hours-modal__calendar-day--empty' : ''
                      } ${
                        isDateSelected(day) ? 'add-hours-modal__calendar-day--selected' : ''
                      } ${
                        isToday(day) ? 'add-hours-modal__calendar-day--today' : ''
                      } ${
                        isMissingTracking(day) ? 'add-hours-modal__calendar-day--missing' : ''
                      }`}
                      onClick={() => day && handleDateClick(day)}
                      disabled={!day}
                    >
                      {day || ''}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
            {isSaving ? 'Сохранение...' : 'сохранить'}
          </button>
        </div>
      </div>
    </>
  );
};

