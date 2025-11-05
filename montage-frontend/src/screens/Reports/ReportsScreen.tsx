import React from 'react';
import otchetIconGrey from '../../shared/icons/otchetIconGrey.svg';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

export const ReportsScreen: React.FC = () => {
  return (
    <div className="reports">
      <PageHeader
        categoryIcon={otchetIconGrey}
        categoryLabel="Отчеты"
        showPagination={true}
        userName="Гиламанов Т.Р."
      />
      <div className="reports__content">
        <h2>Отчеты</h2>
        <p>Здесь будет отображаться список отчетов и аналитика</p>
      </div>
    </div>
  );
};
