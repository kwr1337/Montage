import React from 'react';
import calendarIconGrey from '../../shared/icons/calendarIconGrey.svg';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

export const CalendarScreen: React.FC = () => {
  return (
    <div className="calendar">
      <PageHeader
        categoryIcon={calendarIconGrey}
        categoryLabel="Календарь"
        showPagination={true}
        userName="Гиламанов Т.Р."
      />
      <div className="calendar__content">
        <h2>Календарь</h2>
        <p>Здесь будет отображаться календарь событий и встреч</p>
      </div>
    </div>
  );
};
