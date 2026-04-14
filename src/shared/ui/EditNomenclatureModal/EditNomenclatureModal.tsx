import React, { useState, useEffect } from 'react';
import calendarIconGreyRaw from '../../icons/calendarIconGrey.svg?raw';
import upDownTableFilterRaw from '../../icons/upDownTableFilter.svg?raw';
import closeIconRaw from '../../icons/closeIcon.svg?raw';
import { parseSpecQuantityInput } from '../../../utils/specQuantityFormat';
import './edit-nomenclature-modal.scss';

const toDataUrl = (raw: string) => `data:image/svg+xml,${encodeURIComponent(raw)}`;
const calendarIconGrey = toDataUrl(calendarIconGreyRaw);
const upDownTableFilter = toDataUrl(upDownTableFilterRaw);
const closeIcon = toDataUrl(closeIconRaw);

interface EditNomenclatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (data: { nomenclature: string; changeDate: string; quantity: number }) => void;
  initialData?: {
    nomenclature: string;
    changeDate: string;
    quantity: number;
  };
  historyData?: Array<{
    date: string;
    quantity: string;
    changedBy: string;
  }>;
}

const EditNomenclatureModal: React.FC<EditNomenclatureModalProps> = ({
  isOpen,
  onClose,
  onEdit,
  initialData = {
    nomenclature: 'Провод ПВСбм Мастер',
    changeDate: '12/12/2025',
    quantity: 100
  },
  historyData = []
}) => {
  const [formData, setFormData] = useState({
    nomenclature: initialData.nomenclature,
    changeDate: initialData.changeDate,
    quantity: String(initialData.quantity ?? ''),
  });

  // Обновляем formData когда изменяется initialData
  useEffect(() => {
    if (isOpen) {
      setFormData({
        nomenclature: initialData.nomenclature,
        changeDate: initialData.changeDate,
        quantity: String(initialData.quantity ?? ''),
      });
    }
  }, [isOpen, initialData]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    const quantityValue = parseSpecQuantityInput(String(formData.quantity));
    if (quantityValue === null) {
      alert('Введите корректное число (дроби через запятую или точку)');
      return;
    }
    if (quantityValue < 0) {
      alert('Введите количество не менее 0');
      return;
    }
    onEdit({
      nomenclature: formData.nomenclature,
      changeDate: new Date().toISOString().split('T')[0],
      quantity: quantityValue,
    });
    onClose();
  };

  const handleCancel = () => {
    onClose();
    // Сброс к исходным данным
    setFormData({
      nomenclature: initialData.nomenclature,
      changeDate: initialData.changeDate,
      quantity: String(initialData.quantity ?? ''),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="edit-nomenclature-modal-overlay" onClick={onClose}>
      <div className="edit-nomenclature-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-nomenclature-modal__content">
          {/* Левая часть - форма */}
          <div className="edit-nomenclature-modal__form-section">
            <h2 className="edit-nomenclature-modal__title">Изменение номенклатуры</h2>
            
            <div className="edit-nomenclature-modal__form">
              <div className="edit-nomenclature-modal__field">
                <label className="edit-nomenclature-modal__label">Номенклатура</label>
                <div className="edit-nomenclature-modal__input-wrapper">
                  <input
                    type="text"
                    className="edit-nomenclature-modal__input"
                    value={formData.nomenclature}
                    readOnly
                    style={{ cursor: 'default' }}
                  />
                </div>
              </div>

              <div className="edit-nomenclature-modal__date-quantity-row">
                <div className="edit-nomenclature-modal__field">
                  <label className="edit-nomenclature-modal__label">Дата изменения</label>
                  <div className="edit-nomenclature-modal__date-input-wrapper">
                    <img src={calendarIconGrey} alt="📅" className="edit-nomenclature-modal__calendar-icon" />
                    <input
                      type="text"
                      className="edit-nomenclature-modal__input edit-nomenclature-modal__input--date-readonly"
                      value={new Date().toLocaleDateString('ru-RU').replace(/\./g, ' / ')}
                      readOnly
                      style={{ cursor: 'default' }}
                    />
                  </div>
                </div>

                <div className="edit-nomenclature-modal__field">
                  <label className="edit-nomenclature-modal__label edit-nomenclature-modal__label--required">Введите кол-во</label>
                  <input
                    type="text"
                    spellCheck={false}
                    inputMode="decimal"
                    className="edit-nomenclature-modal__input"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    placeholder="100 или 1,25"
                  />
                </div>
              </div>
            </div>

            <div className="edit-nomenclature-modal__actions">
              <button 
                className="edit-nomenclature-modal__btn edit-nomenclature-modal__btn--edit"
                onClick={handleSubmit}
              >
                Изменить
              </button>
              <button 
                className="edit-nomenclature-modal__btn edit-nomenclature-modal__btn--cancel"
                onClick={handleCancel}
              >
                Отмена
              </button>
            </div>
          </div>

          {/* Правая часть - история изменений */}
          <div className="edit-nomenclature-modal__history-section">
            <div className="edit-nomenclature-modal__history-header">
              <h3 className="edit-nomenclature-modal__history-title">История изменения</h3>
              <button className="edit-nomenclature-modal__close" onClick={onClose}>
                <img src={closeIcon} alt="Закрыть" />
              </button>
            </div>

            <div className="edit-nomenclature-modal__history-table">
              <div className="edit-nomenclature-modal__history-body">
                <div className="edit-nomenclature-modal__history-header-row">
                  <div className="edit-nomenclature-modal__history-header-col">
                    <span>Дата изм.</span>
                    <img src={upDownTableFilter} alt="↑↓" className="edit-nomenclature-modal__sort-icon" />
                  </div>
                  <div className="edit-nomenclature-modal__history-header-col">
                    <span>Кол-во</span>
                    <img src={upDownTableFilter} alt="↑↓" className="edit-nomenclature-modal__sort-icon" />
                  </div>
                  <div className="edit-nomenclature-modal__history-header-col">
                    <span>Изменил(а)</span>
                    <img src={upDownTableFilter} alt="↑↓" className="edit-nomenclature-modal__sort-icon" />
                  </div>
                </div>

                {historyData.length > 0 ? (
                  historyData.map((item, index) => (
                    <div key={index} className="edit-nomenclature-modal__history-row">
                      <div className="edit-nomenclature-modal__history-col">
                        <span>{item.date}</span>
                      </div>
                      <div className="edit-nomenclature-modal__history-col">
                        <span>{item.quantity}</span>
                      </div>
                      <div className="edit-nomenclature-modal__history-col">
                        <span>{item.changedBy}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="edit-nomenclature-modal__history-row">
                    <div className="edit-nomenclature-modal__history-col" style={{ textAlign: 'center', gridColumn: '1 / -1' }}>
                      <span style={{ color: '#919399' }}>Нет истории изменений</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditNomenclatureModal;
