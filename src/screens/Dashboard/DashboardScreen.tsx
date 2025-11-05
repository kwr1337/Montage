import React from 'react';
import dashboardIconGrey from '../../shared/icons/dashboardIconGrey.svg';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

export const DashboardScreen: React.FC = () => {
  return (
    <div className="dashboard">
      <PageHeader
        categoryIcon={dashboardIconGrey}
        categoryLabel="Дашборд"
        showPagination={true}
        showUser={true}
        userName="Гиламанов Т.Р."
      />
      <div className="dashboard__content">
        <h2>Дашборд</h2>
        <p>Здесь будет отображаться общая информация и статистика</p>
      </div>
    </div>
  );
};
