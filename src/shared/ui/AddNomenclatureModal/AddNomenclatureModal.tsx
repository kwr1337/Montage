import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../../../services/api';
import userDropdownIcon from '../../icons/user-dropdown-icon.svg';
import closeIcon from '../../icons/closeIcon.svg';
import './add-nomenclature-modal.scss';

interface AddNomenclatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: { nomenclatureId: number; nomenclature: string; unit: string; quantity: number }) => void;
  projectId: number;
  existingNomenclatureIds?: number[];
}

const AddNomenclatureModal: React.FC<AddNomenclatureModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  projectId: _projectId,
  existingNomenclatureIds = [],
}) => {
  const [nomenclatures, setNomenclatures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    nomenclatureId: 0,
    nomenclature: '',
    unit: '',
    quantity: 100 as number | string,
  });
  const [error, setError] = useState<string>('');

  // Загружаем номенклатуру при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      const fetchNomenclatures = async () => {
        setIsLoading(true);
        try {
          const response = await apiService.getNomenclature();
          if (response && response.data) {
            const nomenclaturesData = Array.isArray(response.data) ? response.data : [response.data];
            setNomenclatures(nomenclaturesData);
          }
        } catch (error) {
          console.error('Ошибка загрузки номенклатуры:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchNomenclatures();
    }
  }, [isOpen]);

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleNomenclatureSelect = (nomenclature: any) => {
    setFormData({
      ...formData,
      nomenclatureId: nomenclature.id,
      nomenclature: nomenclature.name,
      unit: nomenclature.unit,
    });
    setIsDropdownOpen(false);
    setError(''); // Очищаем ошибку при выборе номенклатуры
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    // Валидация
    if (!formData.nomenclatureId || formData.nomenclatureId === 0) {
      setError('Необходимо выбрать номенклатуру');
      return;
    }
    const quantityValue = typeof formData.quantity === 'string' ? parseFloat(formData.quantity) : formData.quantity;
    if (!quantityValue || quantityValue <= 0 || isNaN(quantityValue)) {
      setError('Необходимо ввести количество больше нуля');
      return;
    }
    
    // Очищаем ошибку при успешной валидации
    setError('');
    onAdd({
      ...formData,
      quantity: quantityValue,
    });
    onClose();
    // Сброс формы
    setFormData({
      nomenclatureId: 0,
      nomenclature: '',
      unit: '',
      quantity: 100,
    });
  };

  const handleCancel = () => {
    setError('');
    onClose();
    // Сброс формы
    setFormData({
      nomenclatureId: 0,
      nomenclature: '',
      unit: '',
      quantity: 100,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="add-nomenclature-modal-overlay" onClick={onClose}>
      <div className="add-nomenclature-modal" onClick={(e) => e.stopPropagation()}>
        <button className="add-nomenclature-modal__close" onClick={onClose}>
          <img src={closeIcon} alt="Закрыть" />
        </button>
        
        <h2 className="add-nomenclature-modal__title">Добавить номенклатуру</h2>
        
        <div className="add-nomenclature-modal__form">
          <div className="add-nomenclature-modal__row">
            <div className="add-nomenclature-modal__field" ref={dropdownRef}>
              <label className="add-nomenclature-modal__label">Номенклатура</label>
              <div className="add-nomenclature-modal__input-wrapper">
                <div 
                  className="add-nomenclature-modal__dropdown-trigger"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <input
                    type="text"
                    className="add-nomenclature-modal__input add-nomenclature-modal__input--nomenclature"
                    value={formData.nomenclature}
                    readOnly
                    placeholder="Выберите номенклатуру"
                  />
                  <img src={userDropdownIcon} alt="▼" className="add-nomenclature-modal__dropdown-arrow" />
                </div>
                {isDropdownOpen && (
                  <div className="add-nomenclature-modal__dropdown-menu">
                    {isLoading ? (
                      <div className="add-nomenclature-modal__dropdown-option">Загрузка...</div>
                    ) : (() => {
                      // Фильтруем номенклатуру, исключая уже добавленные в проект
                      const availableNomenclatures = nomenclatures.filter(
                        (nomenclature) => !existingNomenclatureIds.includes(nomenclature.id)
                      );
                      return availableNomenclatures.length > 0 ? (
                        availableNomenclatures.map((nomenclature) => (
                          <div
                            key={nomenclature.id}
                            className={`add-nomenclature-modal__dropdown-option ${formData.nomenclatureId === nomenclature.id ? 'add-nomenclature-modal__dropdown-option--selected' : ''}`}
                            onClick={() => handleNomenclatureSelect(nomenclature)}
                          >
                            {nomenclature.name}
                          </div>
                        ))
                      ) : (
                        <div className="add-nomenclature-modal__dropdown-option">Номенклатура не найдена</div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="add-nomenclature-modal__field">
              <label className="add-nomenclature-modal__label">Ед. изм.</label>
              <div className="add-nomenclature-modal__input-wrapper">
                <input
                  type="text"
                  className="add-nomenclature-modal__input add-nomenclature-modal__input--unit"
                  value={formData.unit}
                  readOnly
                  placeholder="Выберите номенклатуру"
                />
              </div>
            </div>
          </div>

          <div className="add-nomenclature-modal__field">
            <label className="add-nomenclature-modal__label">Введите кол-во</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="add-nomenclature-modal__input add-nomenclature-modal__input--quantity"
              value={formData.quantity}
              onChange={(e) => {
                const value = e.target.value;
                // Разрешаем пустую строку и любые числовые значения (включая дробные)
                if (value === '' || !isNaN(Number(value))) {
                  handleInputChange('quantity', value === '' ? '' : parseFloat(value) || 0);
                  setError(''); // Очищаем ошибку при изменении поля
                }
              }}
              placeholder="100"
            />
          </div>
          {error && (
            <div className="add-nomenclature-modal__error">
              {error}
            </div>
          )}
        </div>

        <div className="add-nomenclature-modal__actions">
          <button 
            className="add-nomenclature-modal__btn add-nomenclature-modal__btn--add"
            onClick={handleSubmit}
          >
            Добавить
          </button>
          <button 
            className="add-nomenclature-modal__btn add-nomenclature-modal__btn--cancel"
            onClick={handleCancel}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddNomenclatureModal;
