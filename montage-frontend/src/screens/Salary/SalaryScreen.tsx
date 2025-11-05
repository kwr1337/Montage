import React from 'react';
import zpIconGrey from '../../shared/icons/zpIconGrey.svg';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

export const SalaryScreen: React.FC = () => {
  return (
    <div className="salary">
      <PageHeader
        categoryIcon={zpIconGrey}
        categoryLabel="Выдача ЗП"
        showPagination={true}
        userName="Гиламанов Т.Р."
      />
      <div className="salary__content">
        <h2>Выдача ЗП</h2>
        <p>Здесь будет отображаться информация о зарплатах и выплатах</p>
      </div>
    </div>
  );
};
