import React from 'react';
import nomenclaturaIconGreyRaw from '../../shared/icons/nomenculaturaIconGrey.svg?raw';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import './nomenclature.scss';

const nomenclaturaIconGrey = `data:image/svg+xml,${encodeURIComponent(nomenclaturaIconGreyRaw)}`;

export const NomenclatureScreen: React.FC = () => {
  return (
    <div className="nomenclature">
      <PageHeader
        categoryIcon={nomenclaturaIconGrey}
        categoryLabel="Номенклатура"
        showPagination={true}
        userName="Гиламанов Т.Р."
      />
      <div className="nomenclature__content">
        <h2>Номенклатура</h2>
        <p>Функционал будет доступен в следующем релизе.</p>
      </div>
    </div>
  );
};
