import React from 'react';
import './remove-employee-confirm-modal.scss';

interface RemoveEmployeeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  employeeName: string;
}

export const RemoveEmployeeConfirmModal: React.FC<RemoveEmployeeConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  employeeName,
}) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="remove-employee-confirm-overlay" onClick={onClose}>
      <div className="remove-employee-confirm-wrapper">
        <h3 className="remove-employee-confirm__title">Подтверждение удаления сотрудника</h3>
        <div className="remove-employee-confirm" onClick={(e) => e.stopPropagation()}>
          <p className="remove-employee-confirm__question">
            Удалить сотрудника {employeeName} из проекта ?
          </p>
          <p className="remove-employee-confirm__hint">
            Сотрудник будет удален из бригады на этом объекте.
          </p>
          <div className="remove-employee-confirm__actions">
            <button
              type="button"
              className="remove-employee-confirm__btn remove-employee-confirm__btn--cancel"
              onClick={onClose}
            >
              ОТМЕНА
            </button>
            <button
              type="button"
              className="remove-employee-confirm__btn remove-employee-confirm__btn--delete"
              onClick={handleConfirm}
              disabled={isSubmitting}
            >
              УДАЛИТЬ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
