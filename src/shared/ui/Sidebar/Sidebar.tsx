import React, { useState } from 'react';
import { SearchInput } from '../SearchInput/SearchInput';
import dashboardIconGrey from '../../icons/dashboardIconGrey.svg';
import dashboardIconWhite from '../../icons/dashboardIconWhite.svg';
import menuIconGrey from '../../icons/menuIconGrey.svg';
import menuIconWhite from '../../icons/menuIconWhite.svg';
import calendarIconGrey from '../../icons/calendarIconGrey.svg';
import calendarIconWhite from '../../icons/calendarIconWhite.svg';
import sotrudnikiIconGrey from '../../icons/sotrudnikiIconGrey.svg';
import sotrudnikiIconWhite from '../../icons/sotrudnikiIconWhite.svg';
import nomenculaturaIconGrey from '../../icons/nomenculaturaIconGrey.svg';
import nomenculaturaIconWhite from '../../icons/nomenculaturaIconWhite.svg';
import otchetIconGrey from '../../icons/otchetIconGrey.svg';
import otchetIconWhite from '../../icons/otchetIconWhite.svg';
import zpIconGrey from '../../icons/zpIconGrey.svg';
import zpIconWhite from '../../icons/zpIconWhite.svg';
import './sidebar.scss';

type MenuItem = {
  id: string;
  label: string;
  iconGrey: string;
  iconWhite: string;
};

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Дашборд', iconGrey: dashboardIconGrey, iconWhite: dashboardIconWhite },
  { id: 'projects', label: 'Проекты', iconGrey: menuIconGrey, iconWhite: menuIconWhite },
  { id: 'calendar', label: 'Календарь', iconGrey: calendarIconGrey, iconWhite: calendarIconWhite },
  { id: 'employees', label: 'Сотрудники', iconGrey: sotrudnikiIconGrey, iconWhite: sotrudnikiIconWhite },
  { id: 'nomenclature', label: 'Номенклатура', iconGrey: nomenculaturaIconGrey, iconWhite: nomenculaturaIconWhite },
  { id: 'reports', label: 'Отчеты', iconGrey: otchetIconGrey, iconWhite: otchetIconWhite },
  { id: 'salary', label: 'Выдача ЗП', iconGrey: zpIconGrey, iconWhite: zpIconWhite },
];

type SidebarProps = {
  activeItem?: string;
  onNavigate?: (itemId: string) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({ activeItem = 'projects', onNavigate }) => {
  const [searchValue, setSearchValue] = useState('');

  const handleClick = (itemId: string) => {
    if (onNavigate) {
      onNavigate(itemId);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-icon" />
        LOGO
      </div>
      
      {/* <SearchInput
        value={searchValue}
        onChange={setSearchValue}
        placeholder="Поиск"
        className="sidebar__search"
      /> */}

      <nav className="sidebar__nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar__item ${activeItem === item.id ? 'sidebar__item--active' : ''}`}
            onClick={() => handleClick(item.id)}
          >
            <img 
              src={activeItem === item.id ? item.iconWhite : item.iconGrey} 
              alt={item.label} 
              className="sidebar__item-icon" 
            />
            <span className="sidebar__item-text">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

