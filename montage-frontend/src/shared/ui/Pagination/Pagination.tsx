import React from 'react';
import paginationIconLeft from '../../icons/paginationIconNotActiveLeft.svg';
import paginationIconRight from '../../icons/paginationIconNotActiveRight.svg';
import './pagination.scss';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  className?: string;
};

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
  className,
}) => {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= maxVisiblePages + 2) {
      // Показываем все страницы, если их мало
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Показываем первую страницу
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Показываем страницы вокруг текущей
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Показываем последнюю страницу
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`pagination ${className || ''}`}>
      <button
        className="pagination__btn pagination__btn--prev"
        onClick={handlePrevious}
        disabled={currentPage === 1}
      >
        <img src={paginationIconLeft} alt="Предыдущая страница" />
      </button>

      <div className="pagination__container">
        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="pagination__ellipsis">
                ...
              </span>
            );
          }

          return (
            <button
              key={page}
              className={`pagination__number ${
                page === currentPage ? 'pagination__number--active' : ''
              }`}
              onClick={() => onPageChange(page as number)}
            >
              {page}
            </button>
          );
        })}
      </div>

      <button
        className="pagination__btn pagination__btn--next"
        onClick={handleNext}
        disabled={currentPage === totalPages}
      >
        <img src={paginationIconRight} alt="Следующая страница" />
      </button>
    </div>
  );
};

