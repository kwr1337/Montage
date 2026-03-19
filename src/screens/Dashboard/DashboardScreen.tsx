import React from 'react';
import dashboardIconGreyRaw from '../../shared/icons/dashboardIconGrey.svg?raw';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import './dashboard.scss';

const dashboardIconGrey = `data:image/svg+xml,${encodeURIComponent(dashboardIconGreyRaw)}`;

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
        <p>Функционал будет доступен в следующем релизе.</p>
      </div>
    </div>
  );
};
