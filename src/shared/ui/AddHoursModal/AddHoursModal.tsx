import React, { useState, useEffect, useMemo } from 'react';
import closeIconRaw from '../../icons/closeIcon.svg?raw';
import calendarIconGreyRaw from '../../icons/calendarIconGrey.svg?raw';
import { apiService } from '../../../services/api';
import { extractWorkReportsArray } from '../../../utils/projectWorkReports';
import './add-hours-modal.scss';

const toDataUrl = (raw: string) => `data:image/svg+xml,${encodeURIComponent(raw)}`;
const closeIcon = toDataUrl(closeIconRaw);
const calendarIconGrey = toDataUrl(calendarIconGreyRaw);

/** Контролируемое состояние формы (родитель не размонтируется при повороте экрана) */
export type AddHoursFormState = {
  hours: number;
  reason: string;
  isAbsent: boolean;
  /** Локальная дата YYYY-MM-DD */
  selectedDateStr: string;
};

export type ExistingWorkReportForEdit = {
  id: number;
  report_date: string;
  hours_worked?: number;
  absent?: boolean;
  notes?: string;
};

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
  /** В мобильной версии: корректировка часов возможна только с 6:00 до 21:00 */
  enforceTimeRestriction?: boolean;
  /** Если заданы оба — поля формы контролируются родителем (сохраняются при remount) */
  externalForm?: AddHoursFormState;
  onExternalFormChange?: (next: AddHoursFormState) => void;
  /** Если за эту дату уже есть отчёт — PATCH вместо POST (редактирование в тот же день) */
  existingReport?: ExistingWorkReportForEdit | null;
};

export const AddHoursModal: React.FC<AddHoursModalProps> = ({
  isOpen,
  onClose,
  onSave,
  projectId,
  employee,
  trackedDates = [],
  onSuccess,
  enforceTimeRestriction = false,
  externalForm,
  onExternalFormChange,
  existingReport = null,
}) => {
  const isControlled = Boolean(externalForm && onExternalFormChange);

  const [internalHours, setInternalHours] = useState<number>(8);
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date>(new Date());
  const [internalAbsent, setInternalAbsent] = useState(false);
  const [internalReason, setInternalReason] = useState('');
  const [savedDates, setSavedDates] = useState<string[]>(trackedDates);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hours = isControlled ? externalForm!.hours : internalHours;
  const isAbsent = isControlled ? externalForm!.isAbsent : internalAbsent;
  const reason = isControlled ? externalForm!.reason : internalReason;

  const selectedDate = useMemo(() => {
    if (isControlled) {
      const parts = externalForm!.selectedDateStr.split('-').map(Number);
      const y = parts[0];
      const m = parts[1];
      const d = parts[2];
      if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
        return new Date();
      }
      return new Date(y, m - 1, d);
    }
    return internalSelectedDate;
  }, [isControlled, externalForm, internalSelectedDate]);

  const patchForm = (patch: Partial<AddHoursFormState>) => {
    if (!isControlled || !externalForm || !onExternalFormChange) return;
    onExternalFormChange({ ...externalForm, ...patch });
  };

  // YYYY-MM-DD в локальном времени (нужна до эффектов и handleSave)
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Обновляем savedDates при изменении trackedDates
  useEffect(() => {
    setSavedDates(trackedDates);
  }, [trackedDates]);

  // При открытии: сегодня (неконтролируемый режим); при необходимости — подстановка из existingReport
  useEffect(() => {
    if (!isOpen || isControlled) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setInternalSelectedDate(today);
    setError(null);
    const todayStr = formatDateString(today);
    const exDate = existingReport?.report_date ? String(existingReport.report_date).slice(0, 10) : '';
    if (existingReport?.id != null && exDate === todayStr) {
      const a = existingReport.absent as unknown;
      const abs = a === true || a === 1 || a === '1';
      setInternalAbsent(abs);
      const hw = Number(existingReport.hours_worked);
      setInternalHours(abs ? 0 : Number.isFinite(hw) && hw >= 0 ? Math.min(24, hw) : 8);
      setInternalReason(existingReport.notes?.trim() ? String(existingReport.notes).trim() : '');
    } else {
      setInternalHours(8);
      setInternalAbsent(false);
      setInternalReason('');
    }
  }, [isOpen, isControlled, existingReport?.id, existingReport?.report_date]);

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
      if (isControlled) {
        patchForm({ hours: hours + 1 });
      } else {
        setInternalHours((prev) => prev + 1);
      }
    }
  };

  const handleDecrement = () => {
    if (!isAbsent) {
      const next = Math.max(0, hours - 1);
      if (isControlled) {
        patchForm({ hours: next });
      } else {
        setInternalHours(next);
      }
    }
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAbsent) return;
    const value = e.target.value;
    // Разрешаем только целые числа
    if (value === '' || /^\d+$/.test(value)) {
      const numValue = value === '' ? 0 : parseInt(value, 10);
      if (numValue >= 0 && numValue <= 24) {
        if (isControlled) {
          patchForm({ hours: numValue });
        } else {
          setInternalHours(numValue);
        }
      }
    }
  };

  const handleHoursBlur = () => {
    // Если поле пустое, устанавливаем 8 часов по умолчанию
    if (hours === 0 && !isAbsent) {
      if (isControlled) {
        patchForm({ hours: 8 });
      } else {
        setInternalHours(8);
      }
    }
  };

  // Показывать поле "Причина" если часы != 8 и сотрудник не отсутствовал
  const shouldShowReason = (): boolean => {
    return !isAbsent && hours !== 8;
  };

  // В мобильной версии: корректировка возможна только с 6:00 до 21:00
  const canEditByTime = (): boolean => {
    // Временно убираем проверку времени для тестирования.
    // enforceTimeRestriction оставляем, чтобы поведение можно было быстро вернуть.
    if (enforceTimeRestriction) {
      return true;
    }
    return true;
  };

  // Только текущий день; вчера редактировать нельзя
  const isToday = (d: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dNorm = new Date(d);
    dNorm.setHours(0, 0, 0, 0);
    return dNorm.getTime() === today.getTime();
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

    if (!isToday(selectedDate)) {
      setError('Редактирование возможно только за текущий день. Вчерашний день редактировать нельзя.');
      return;
    }

    if (!canEditByTime()) {
      setError('Корректировка часов возможна только с 6:00 до 21:00');
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
      const payload = {
        hours_worked: isAbsent ? 0 : hours,
        absent: isAbsent,
        notes: reason || undefined,
      };

      const exDate = existingReport?.report_date ? String(existingReport.report_date).slice(0, 10) : '';
      const isUpdateToday =
        existingReport != null &&
        existingReport.id != null &&
        exDate === dateString;

      if (isUpdateToday) {
        await apiService.updateWorkReport(projectId, employee.id, existingReport.id, payload);
      } else {
        try {
          await apiService.createWorkReport(projectId, employee.id, {
            report_date: dateString,
            ...payload,
          });
        } catch (createErr: any) {
          const st = (createErr as any)?.status;
          const msg = String(createErr?.message ?? '');
          const looksLikeDuplicate =
            st === 400 ||
            (msg.includes('400') &&
              (msg.includes('уже существует') || /already exists/i.test(msg)));
          if (looksLikeDuplicate) {
            const wr = await apiService.getWorkReports(projectId, employee.id, {
              per_page: 50,
              filter: { date_from: dateString, date_to: dateString },
            });
            const list = extractWorkReportsArray(wr);
            const match = list.find(
              (r: any) => String(r?.report_date ?? '').slice(0, 10) === dateString
            );
            if (match?.id != null) {
              await apiService.updateWorkReport(projectId, employee.id, Number(match.id), payload);
            } else {
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      }

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
              <span className="add-hours-modal__value">{employee?.name ?? ''}</span>
            </div>

            <div className="add-hours-modal__row">
              <span className="add-hours-modal__label">Ставка в час</span>
              <span className="add-hours-modal__value">
                {(Number(employee?.hourlyRate) || 0).toLocaleString('ru-RU')} ₽
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
              <span className="add-hours-modal__quantity-label add-hours-modal__quantity-label--required">введите кол-во часов</span>
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
                  if (isControlled) {
                    patchForm({
                      isAbsent: checked,
                      hours: checked ? 0 : 8,
                      reason: '',
                    });
                  } else {
                    setInternalAbsent(checked);
                    if (checked) {
                      setInternalHours(0);
                      setInternalReason('');
                    } else {
                      setInternalHours(8);
                      setInternalReason('');
                    }
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
              <span className="add-hours-modal__reason-label add-hours-modal__reason-label--required">Причина отсутствия</span>
              <textarea
                placeholder="Укажите причину отсутствия"
                value={reason}
                onChange={(e) => {
                  if (isControlled) patchForm({ reason: e.target.value });
                  else setInternalReason(e.target.value);
                }}
                className="add-hours-modal__reason-textarea"
              />
            </div>
          )}

          {shouldShowReason() && (
            <div className="add-hours-modal__reason">
              <span className="add-hours-modal__reason-label add-hours-modal__reason-label--required">Причина</span>
              <textarea
                placeholder="Укажите причину отклонения от стандартных 8 часов"
                value={reason}
                onChange={(e) => {
                  if (isControlled) patchForm({ reason: e.target.value });
                  else setInternalReason(e.target.value);
                }}
                className="add-hours-modal__reason-textarea"
              />
            </div>
          )}

          {!canEditByTime() && (
            <div className="add-hours-modal__error add-hours-modal__error--info">
              Корректировка возможна только с 6:00 до 21:00
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
            disabled={isSaving || !canEditByTime()}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </>
  );
};

