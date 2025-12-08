import React, { useState, useRef } from 'react';
import closeIcon from '../../icons/closeIcon.svg';
import calendarIconGrey from '../../icons/calendarIconGrey.svg';
import './add-payment-modal.scss';

type PaymentData = {
  amount: string;
  date: string;
  method: string;
};

type PaymentEditData = {
  id: number;
  employeeId: number;
  employeeName: string;
  employeePosition: string;
  total?: number;
  firstPayment?: {
    amount: number;
    date: string;
    method: string;
  };
  secondPayment?: {
    amount: number;
    date: string;
    method: string;
  };
  thirdPayment?: {
    amount: number;
    date: string;
    method: string;
  };
  comment?: string;
};

type AddPaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    employeeId: number;
    paymentId?: number;
    firstPayment?: PaymentData;
    secondPayment?: PaymentData;
    thirdPayment?: PaymentData;
    comment?: string;
  }) => void;
  employees?: Array<{
    id: number;
    name: string;
    fullName?: string;
    user?: {
      is_dismissed?: boolean;
    };
    is_dismissed?: boolean;
  }>;
  editData?: PaymentEditData | null;
};

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  employees = [],
  editData = null,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [isMethodDropdownOpen1, setIsMethodDropdownOpen1] = useState(false);
  const [isMethodDropdownOpen2, setIsMethodDropdownOpen2] = useState(false);
  const [isMethodDropdownOpen3, setIsMethodDropdownOpen3] = useState(false);
  
  const [firstPayment, setFirstPayment] = useState<PaymentData>({
    amount: '',
    date: '',
    method: 'Карта',
  });
  const [secondPayment, setSecondPayment] = useState<PaymentData>({
    amount: '',
    date: '',
    method: 'Наличные',
  });
  const [thirdPayment, setThirdPayment] = useState<PaymentData>({
    amount: '',
    date: '',
    method: 'Наличные',
  });
  const [comment, setComment] = useState('');

  const employeeDropdownRef = useRef<HTMLDivElement>(null);
  const methodDropdownRef1 = useRef<HTMLDivElement>(null);
  const methodDropdownRef2 = useRef<HTMLDivElement>(null);
  const methodDropdownRef3 = useRef<HTMLDivElement>(null);
  const dateFromRef1 = useRef<HTMLInputElement>(null);
  const dateFromRef2 = useRef<HTMLInputElement>(null);
  const dateFromRef3 = useRef<HTMLInputElement>(null);

  const paymentMethods = ['Карта', 'Наличные'];

  const formatDateDDMMYYYY = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Преобразует дату из формата "11 сен 2025" в YYYY-MM-DD
  const parseDateString = (dateStr: string): string => {
    if (!dateStr) return '';
    // Если дата уже в формате YYYY-MM-DD, возвращаем как есть
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // Пытаемся распарсить дату
    const date = new Date(dateStr);
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Пытаемся распарсить русский формат "11 сен 2025"
    const months: { [key: string]: string } = {
      'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04',
      'май': '05', 'июн': '06', 'июл': '07', 'авг': '08',
      'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12'
    };
    const parts = dateStr.trim().split(/\s+/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = months[parts[1].toLowerCase()] || '01';
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const formatCurrency = (value: string) => {
    const num = value.replace(/\s/g, '').replace(/₽/g, '');
    if (!num) return '';
    return `${parseInt(num, 10).toLocaleString('ru-RU')} ₽`;
  };

  const handleAmountChange = (value: string, setter: (data: PaymentData) => void, current: PaymentData) => {
    const num = value.replace(/\D/g, '');
    setter({ ...current, amount: num });
  };

  const handleSave = () => {
    if (!selectedEmployeeId) return;

    const data = {
      employeeId: selectedEmployeeId,
      paymentId: editData?.id,
      firstPayment: firstPayment.amount && firstPayment.date ? {
        amount: firstPayment.amount,
        date: firstPayment.date,
        method: firstPayment.method,
      } : undefined,
      secondPayment: secondPayment.amount && secondPayment.date ? {
        amount: secondPayment.amount,
        date: secondPayment.date,
        method: secondPayment.method,
      } : undefined,
      // Остаток рассчитываем автоматически
      thirdPayment: (() => {
        if (editData?.total) {
          // Для редактирования рассчитываем остаток автоматически
          const total = editData.total;
          const firstAmount = parseFloat(firstPayment.amount) || 0;
          const secondAmount = parseFloat(secondPayment.amount) || 0;
          const calculatedBalance = Math.max(0, total - firstAmount - secondAmount);
          
          // Если остаток больше 0 и есть дата, создаем третью выплату
          if (calculatedBalance > 0 && thirdPayment.date) {
            return {
              amount: calculatedBalance.toString(),
              date: thirdPayment.date,
              method: thirdPayment.method,
            };
          }
        } else if (thirdPayment.amount && thirdPayment.date) {
          // Для новой выплаты используем значение из формы
          return {
            amount: thirdPayment.amount,
            date: thirdPayment.date,
            method: thirdPayment.method,
          };
        }
        return undefined;
      })(),
      comment: comment || undefined,
    };

    onSave(data);
    handleClose();
  };

  const handleClose = () => {
    setSelectedEmployeeId(null);
    setFirstPayment({ amount: '', date: '', method: 'Карта' });
    setSecondPayment({ amount: '', date: '', method: 'Наличные' });
    setThirdPayment({ amount: '', date: '', method: 'Наличные' });
    setComment('');
    setIsEmployeeDropdownOpen(false);
    setIsMethodDropdownOpen1(false);
    setIsMethodDropdownOpen2(false);
    setIsMethodDropdownOpen3(false);
    onClose();
  };

  // Заполнение формы данными для редактирования
  React.useEffect(() => {
    if (editData && isOpen) {
      setSelectedEmployeeId(editData.employeeId);
      setFirstPayment({
        amount: editData.firstPayment?.amount?.toString() || '',
        date: parseDateString(editData.firstPayment?.date || ''),
        method: editData.firstPayment?.method || 'Карта',
      });
      setSecondPayment({
        amount: editData.secondPayment?.amount?.toString() || '',
        date: parseDateString(editData.secondPayment?.date || ''),
        method: editData.secondPayment?.method || 'Наличные',
      });
      // Рассчитываем остаток автоматически
      const total = editData.total || 0;
      const firstAmount = editData.firstPayment?.amount || 0;
      const secondAmount = editData.secondPayment?.amount || 0;
      const calculatedBalance = Math.max(0, total - firstAmount - secondAmount);
      
      // Если есть третья выплата, используем её, иначе используем рассчитанный остаток
      const thirdAmount = editData.thirdPayment?.amount || calculatedBalance;
      
      setThirdPayment({
        amount: thirdAmount > 0 ? thirdAmount.toString() : '',
        date: parseDateString(editData.thirdPayment?.date || ''),
        method: editData.thirdPayment?.method || 'Наличные',
      });
      setComment(editData.comment || '');
    } else if (!editData && isOpen) {
      // Сброс формы при открытии для создания новой выплаты
      setSelectedEmployeeId(null);
      setFirstPayment({ amount: '', date: '', method: 'Карта' });
      setSecondPayment({ amount: '', date: '', method: 'Наличные' });
      setThirdPayment({ amount: '', date: '', method: 'Наличные' });
      setComment('');
    }
  }, [editData, isOpen]);

  // Автоматический расчет остатка при изменении первой или второй выплаты
  React.useEffect(() => {
    if (editData?.total) {
      const total = editData.total;
      const firstAmount = parseFloat(firstPayment.amount) || 0;
      const secondAmount = parseFloat(secondPayment.amount) || 0;
      const calculatedBalance = Math.max(0, total - firstAmount - secondAmount);
      
      // Обновляем остаток автоматически при изменении первой или второй выплаты
      setThirdPayment(prev => ({
        ...prev,
        amount: calculatedBalance > 0 ? calculatedBalance.toString() : '',
      }));
    }
  }, [firstPayment.amount, secondPayment.amount, editData?.total]);

  // Закрытие dropdown при клике вне
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target as Node)) {
        setIsEmployeeDropdownOpen(false);
      }
      if (methodDropdownRef1.current && !methodDropdownRef1.current.contains(event.target as Node)) {
        setIsMethodDropdownOpen1(false);
      }
      if (methodDropdownRef2.current && !methodDropdownRef2.current.contains(event.target as Node)) {
        setIsMethodDropdownOpen2(false);
      }
      if (methodDropdownRef3.current && !methodDropdownRef3.current.contains(event.target as Node)) {
        setIsMethodDropdownOpen3(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId);

  if (!isOpen) return null;

  return (
    <div className="add-payment-modal-overlay" onClick={handleClose}>
      <div className="add-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-payment-modal__header">
          <h2 className="add-payment-modal__title">
            {editData ? 'Редактировать выплату' : 'Добавить выплату'}
          </h2>
          <button className="add-payment-modal__close" onClick={handleClose}>
            <img src={closeIcon} alt="Закрыть" />
          </button>
        </div>

        <div className="add-payment-modal__content">
          {/* Выбор сотрудника */}
          <div className="add-payment-modal__section">
            <h3 className="add-payment-modal__section-title">Выберите сотрудника</h3>
            <div className="add-payment-modal__field" ref={employeeDropdownRef}>
              <label className="add-payment-modal__label">Сотрудник</label>
              <div
                className={`add-payment-modal__dropdown-trigger ${editData ? 'add-payment-modal__dropdown-trigger--disabled' : ''}`}
                onClick={() => {
                  if (!editData) {
                    setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
                  }
                }}
              >
                <span className={selectedEmployee ? 'add-payment-modal__dropdown-value' : 'add-payment-modal__dropdown-placeholder'}>
                  {selectedEmployee ? (selectedEmployee.fullName || selectedEmployee.name) : 'Выберите сотрудника'}
                </span>
                {!editData && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {isEmployeeDropdownOpen && !editData && (
                <div className="add-payment-modal__dropdown">
                  {employees
                    .filter((emp) => {
                      // Исключаем уволенных сотрудников
                      const isDismissed = emp.user?.is_dismissed === true || emp.is_dismissed === true;
                      return !isDismissed;
                    })
                    .map((emp) => (
                      <div
                        key={emp.id}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setSelectedEmployeeId(emp.id);
                          setIsEmployeeDropdownOpen(false);
                        }}
                      >
                        {emp.fullName || emp.name}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Выплаты */}
          <div className="add-payment-modal__section">
            <h3 className="add-payment-modal__section-title">Выплаты</h3>

            {/* 1-я выплата */}
            <div className="add-payment-modal__payment">
              <div className="add-payment-modal__payment-label">1-я выплата</div>
              <div className="add-payment-modal__payment-row">
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Сумма</label>
                  <input
                    type="text"
                    className="add-payment-modal__input"
                    value={firstPayment.amount ? formatCurrency(firstPayment.amount) : ''}
                    onChange={(e) => handleAmountChange(e.target.value, setFirstPayment, firstPayment)}
                    placeholder="0 ₽"
                  />
                </div>
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Дата выдачи</label>
                  <div
                    className="add-payment-modal__date-input"
                    onClick={() => {
                      if (dateFromRef1.current) {
                        dateFromRef1.current.showPicker?.();
                        dateFromRef1.current.focus();
                      }
                    }}
                  >
                    <img src={calendarIconGrey} alt="Календарь" />
                    {firstPayment.date ? (
                      <span className="add-payment-modal__date-display">
                        {formatDateDDMMYYYY(firstPayment.date)}
                      </span>
                    ) : (
                      <span className="add-payment-modal__date-placeholder">дд / мм / гггг</span>
                    )}
                    <input
                      ref={dateFromRef1}
                      type="date"
                      className="add-payment-modal__date-input-hidden"
                      value={firstPayment.date}
                      onChange={(e) => setFirstPayment({ ...firstPayment, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="add-payment-modal__field" ref={methodDropdownRef1}>
                <label className="add-payment-modal__label">Способ</label>
                <div
                  className="add-payment-modal__dropdown-trigger"
                  onClick={() => setIsMethodDropdownOpen1(!isMethodDropdownOpen1)}
                >
                  <span className="add-payment-modal__dropdown-value">{firstPayment.method}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {isMethodDropdownOpen1 && (
                  <div className="add-payment-modal__dropdown">
                    {paymentMethods.map((method) => (
                      <div
                        key={method}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setFirstPayment({ ...firstPayment, method });
                          setIsMethodDropdownOpen1(false);
                        }}
                      >
                        {method}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2-я выплата */}
            <div className="add-payment-modal__payment">
              <div className="add-payment-modal__payment-label">2-я выплата</div>
              <div className="add-payment-modal__payment-row">
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Сумма</label>
                  <input
                    type="text"
                    className="add-payment-modal__input"
                    value={secondPayment.amount ? formatCurrency(secondPayment.amount) : ''}
                    onChange={(e) => handleAmountChange(e.target.value, setSecondPayment, secondPayment)}
                    placeholder="0 ₽"
                  />
                </div>
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Дата выдачи</label>
                  <div
                    className="add-payment-modal__date-input"
                    onClick={() => {
                      if (dateFromRef2.current) {
                        dateFromRef2.current.showPicker?.();
                        dateFromRef2.current.focus();
                      }
                    }}
                  >
                    <img src={calendarIconGrey} alt="Календарь" />
                    {secondPayment.date ? (
                      <span className="add-payment-modal__date-display">
                        {formatDateDDMMYYYY(secondPayment.date)}
                      </span>
                    ) : (
                      <span className="add-payment-modal__date-placeholder">дд / мм / гггг</span>
                    )}
                    <input
                      ref={dateFromRef2}
                      type="date"
                      className="add-payment-modal__date-input-hidden"
                      value={secondPayment.date}
                      onChange={(e) => setSecondPayment({ ...secondPayment, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="add-payment-modal__field" ref={methodDropdownRef2}>
                <label className="add-payment-modal__label">Способ</label>
                <div
                  className="add-payment-modal__dropdown-trigger"
                  onClick={() => setIsMethodDropdownOpen2(!isMethodDropdownOpen2)}
                >
                  <span className="add-payment-modal__dropdown-value">{secondPayment.method}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {isMethodDropdownOpen2 && (
                  <div className="add-payment-modal__dropdown">
                    {paymentMethods.map((method) => (
                      <div
                        key={method}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setSecondPayment({ ...secondPayment, method });
                          setIsMethodDropdownOpen2(false);
                        }}
                      >
                        {method}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Остаток */}
            <div className="add-payment-modal__payment">
              <div className="add-payment-modal__payment-label">Остаток</div>
              <div className="add-payment-modal__payment-row">
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Сумма</label>
                  <input
                    type="text"
                    className="add-payment-modal__input"
                    readOnly
                    value={(() => {
                      // Рассчитываем остаток автоматически
                      if (editData?.total) {
                        const total = editData.total;
                        const firstAmount = parseFloat(firstPayment.amount) || 0;
                        const secondAmount = parseFloat(secondPayment.amount) || 0;
                        const calculatedBalance = Math.max(0, total - firstAmount - secondAmount);
                        return calculatedBalance > 0 ? formatCurrency(calculatedBalance.toString()) : '';
                      }
                      // Если нет editData (новая выплата), показываем пустое значение
                      return '';
                    })()}
                    placeholder="0 ₽"
                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="add-payment-modal__field">
                  <label className="add-payment-modal__label">Дата выдачи</label>
                  <div
                    className="add-payment-modal__date-input"
                    onClick={() => {
                      if (dateFromRef3.current) {
                        dateFromRef3.current.showPicker?.();
                        dateFromRef3.current.focus();
                      }
                    }}
                  >
                    <img src={calendarIconGrey} alt="Календарь" />
                    {thirdPayment.date ? (
                      <span className="add-payment-modal__date-display">
                        {formatDateDDMMYYYY(thirdPayment.date)}
                      </span>
                    ) : (
                      <span className="add-payment-modal__date-placeholder">дд.мм.гггг</span>
                    )}
                    <input
                      ref={dateFromRef3}
                      type="date"
                      className="add-payment-modal__date-input-hidden"
                      value={thirdPayment.date}
                      onChange={(e) => setThirdPayment({ ...thirdPayment, date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="add-payment-modal__field" ref={methodDropdownRef3}>
                <label className="add-payment-modal__label">Способ</label>
                <div
                  className="add-payment-modal__dropdown-trigger"
                  onClick={() => setIsMethodDropdownOpen3(!isMethodDropdownOpen3)}
                >
                  <span className="add-payment-modal__dropdown-value">{thirdPayment.method}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="#919399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {isMethodDropdownOpen3 && (
                  <div className="add-payment-modal__dropdown">
                    {paymentMethods.map((method) => (
                      <div
                        key={method}
                        className="add-payment-modal__dropdown-option"
                        onClick={() => {
                          setThirdPayment({ ...thirdPayment, method });
                          setIsMethodDropdownOpen3(false);
                        }}
                      >
                        {method}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Доп. информация */}
          <div className="add-payment-modal__section">
            <h3 className="add-payment-modal__section-title">Доп. информация</h3>
            <div className="add-payment-modal__field">
              <label className="add-payment-modal__label">Комментарий</label>
              <textarea
                className="add-payment-modal__textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Введите текст комментария..."
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="add-payment-modal__actions">
          <button className="add-payment-modal__btn add-payment-modal__btn--cancel" onClick={handleClose}>
            Отмена
          </button>
          <button
            className="add-payment-modal__btn add-payment-modal__btn--save"
            onClick={handleSave}
            disabled={!selectedEmployeeId}
          >
            {editData ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
};

