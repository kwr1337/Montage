import React, { useState } from 'react';
import closeIcon from '../../icons/closeIcon.svg';
import calendarIconGrey from '../../icons/calendarIconGrey.svg';
import './add-fact-modal.scss';

type AddFactModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (quantity: number, date: string) => void;
  nomenclature: {
    id: number;
    name: string;
    unit: string;
    previousValue?: number;
  };
};

export const AddFactModal: React.FC<AddFactModalProps> = ({
  isOpen,
  onClose,
  onSave,
  nomenclature,
}) => {
  const [quantity, setQuantity] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handleIncrement = () => {
    setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    setQuantity((prev) => Math.max(0, prev - 1));
  };

  const handleSave = () => {
    onSave(quantity, date);
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="add-fact-modal-overlay" onClick={onClose} />
      <div className="add-fact-modal">
        <div className="add-fact-modal__header">
          <h2 className="add-fact-modal__title">Фиксация ФАКТА</h2>
          <button
            type="button"
            className="add-fact-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <img src={closeIcon} alt="" aria-hidden="true" />
          </button>
        </div>

        <div className="add-fact-modal__content">
          <div className="add-fact-modal__info">
            <div className="add-fact-modal__field">
              <span className="add-fact-modal__label">Номенклатура</span>
              <p className="add-fact-modal__value">{nomenclature.name}</p>
            </div>

            <div className="add-fact-modal__row">
              <span className="add-fact-modal__label">единица измерения</span>
              <span className="add-fact-modal__value">{nomenclature.unit}</span>
            </div>

            {nomenclature.previousValue !== undefined && (
              <div className="add-fact-modal__row">
                <span className="add-fact-modal__label">Введенное ранее значение</span>
                <span className="add-fact-modal__value">{nomenclature.previousValue}</span>
              </div>
            )}
          </div>

          <div className="add-fact-modal__inputs">
            <div className="add-fact-modal__date-picker">
              <img src={calendarIconGrey} alt="" className="add-fact-modal__date-icon" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="add-fact-modal__date-input"
              />
              <span className="add-fact-modal__date-display">{formatDate(date)}</span>
            </div>

            <div className="add-fact-modal__quantity">
              <span className="add-fact-modal__quantity-label">введите кол-во номенклатуры</span>
              <div className="add-fact-modal__counter">
                <button
                  type="button"
                  className="add-fact-modal__counter-btn"
                  onClick={handleDecrement}
                  aria-label="Уменьшить"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M6 12H18" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <div className="add-fact-modal__counter-value">
                  <span>{quantity}</span>
                </div>
                <button
                  type="button"
                  className="add-fact-modal__counter-btn"
                  onClick={handleIncrement}
                  aria-label="Увеличить"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 6V18M6 12H18" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="add-fact-modal__actions">
          <button
            type="button"
            className="add-fact-modal__btn add-fact-modal__btn--cancel"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="add-fact-modal__btn add-fact-modal__btn--save"
            onClick={handleSave}
          >
            сохранить
          </button>
        </div>
      </div>
    </>
  );
};

