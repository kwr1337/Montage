import React from 'react';
import nomenclaturaIconGrey from '../../shared/icons/nomenculaturaIconGrey.svg';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';

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
        <p>Здесь будет отображаться каталог товаров и услуг</p>
      </div>
    </div>
  );
};
