import React, { useState } from 'react';
import closeIcon from '../../icons/closeIcon.svg';
import './add-employees-modal.scss';

export type WorkerWithBusy = {
  id: number;
  first_name?: string;
  second_name?: string;
  last_name?: string;
  /** Занят другим бригадиром: { foreman_name: string } */
  busy?: { foreman_name?: string } | null;
};

interface AddEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (workerIds: number[]) => Promise<void>;
  workers: WorkerWithBusy[];
  myAssignedIds: number[];
}

const formatWorkerName = (w: WorkerWithBusy) => {
  const { last_name, first_name, second_name } = w;
  const ln = last_name || '';
  const fi = first_name ? `${first_name.charAt(0)}.` : '';
  const si = second_name ? `${second_name.charAt(0)}.` : '';
  return `${ln} ${fi}${si}`.trim() || '—';
};

export const AddEmployeesModal: React.FC<AddEmployeesModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  workers,
  myAssignedIds,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSelect = (id: number, busy?: { foreman_name?: string } | null) => {
    if (busy) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeFromSelection = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAdd = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsSubmitting(true);
    try {
      await onAdd(ids);
      setSelectedIds(new Set());
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    onClose();
  };

  if (!isOpen) return null;

  const selectedWorkers = workers.filter((w) => selectedIds.has(w.id));
  const canAdd = selectedIds.size > 0 && !isSubmitting;

  return (
    <div className="add-employees-modal-overlay">
      <div className="add-employees-modal">
        <div className="add-employees-modal__header">
          <h2 className="add-employees-modal__title">Добавьте сотрудников</h2>
          <button type="button" className="add-employees-modal__close" onClick={handleClose} aria-label="Закрыть">
            <img src={closeIcon} alt="" />
          </button>
        </div>

        {selectedWorkers.length > 0 && (
          <div className="add-employees-modal__chips">
            {selectedWorkers.map((w) => (
              <div key={w.id} className="add-employees-modal__chip">
                <span>{formatWorkerName(w)}</span>
                <button
                  type="button"
                  className="add-employees-modal__chip-remove"
                  onClick={() => removeFromSelection(w.id)}
                  aria-label="Убрать"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="add-employees-modal__list">
          {workers.map((w) => {
            const isBusy = !!w.busy;
            const foremanName = w.busy?.foreman_name || '';
            const isAlreadyMine = myAssignedIds.includes(w.id);
            const isChecked = selectedIds.has(w.id) || isAlreadyMine;
            const isDisabled = isBusy || isAlreadyMine;

            return (
              <div
                key={w.id}
                className={`add-employees-modal__row ${isDisabled ? 'add-employees-modal__row--disabled' : ''}`}
              >
                <label className="add-employees-modal__row-inner">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={() => toggleSelect(w.id, isBusy ? w.busy : undefined)}
                  />
                  <span className="add-employees-modal__row-name">{formatWorkerName(w)}</span>
                </label>
                {isBusy && (
                  <span className="add-employees-modal__row-busy">
                    Занят {foremanName ? `(бр. ${foremanName})` : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="add-employees-modal__actions">
        <button
          type="button"
          className={`add-employees-modal__btn add-employees-modal__btn--add ${!canAdd ? 'add-employees-modal__btn--disabled' : ''}`}
          onClick={handleAdd}
          disabled={!canAdd}
        >
          Добавить
        </button>
      </div>
    </div>
  );
};
