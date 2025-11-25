import React from 'react';
import closeIcon from '../../icons/closeIcon.svg';
import './comment-modal.scss';

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  comment: string;
  employeeName?: string;
  date?: string;
}

export const CommentModal: React.FC<CommentModalProps> = ({
  isOpen,
  onClose,
  comment,
  employeeName,
  date,
}) => {
  if (!isOpen) return null;

  return (
    <div className="comment-modal-overlay" onClick={onClose}>
      <div className="comment-modal" onClick={(e) => e.stopPropagation()}>
        <button className="comment-modal__close" onClick={onClose}>
          <img src={closeIcon} alt="Закрыть" />
        </button>
        
        <h2 className="comment-modal__title">Комментарий</h2>
        
        {employeeName && (
          <div className="comment-modal__info">
            <span className="comment-modal__label">Сотрудник:</span>
            <span className="comment-modal__value">{employeeName}</span>
          </div>
        )}
        
        {date && (
          <div className="comment-modal__info">
            <span className="comment-modal__label">Дата:</span>
            <span className="comment-modal__value">{date}</span>
          </div>
        )}
        
        <div className="comment-modal__comment">
          <span className="comment-modal__label">Причина:</span>
          <p className="comment-modal__text">{comment}</p>
        </div>
        
        <div className="comment-modal__actions">
          <button 
            className="comment-modal__btn comment-modal__btn--close"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

