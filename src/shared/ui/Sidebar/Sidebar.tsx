import React from 'react';
import dashboardIconGreyRaw from '../../icons/dashboardIconGrey.svg?raw';
import dashboardIconWhiteRaw from '../../icons/dashboardIconWhite.svg?raw';
import menuIconGreyRaw from '../../icons/menuIconGrey.svg?raw';
import menuIconWhiteRaw from '../../icons/menuIconWhite.svg?raw';
import sotrudnikiIconGreyRaw from '../../icons/sotrudnikiIconGrey.svg?raw';
import sotrudnikiIconWhiteRaw from '../../icons/sotrudnikiIconWhite.svg?raw';
import nomenculaturaIconGreyRaw from '../../icons/nomenculaturaIconGrey.svg?raw';
import nomenculaturaIconWhiteRaw from '../../icons/nomenculaturaIconWhite.svg?raw';
import otchetIconGreyRaw from '../../icons/otchetIconGrey.svg?raw';
import otchetIconWhiteRaw from '../../icons/otchetIconWhite.svg?raw';
import zpIconGreyRaw from '../../icons/zpIconGrey.svg?raw';
import zpIconWhiteRaw from '../../icons/zpIconWhite.svg?raw';
import './sidebar.scss';

const toDataUrl = (raw: string) => `data:image/svg+xml,${encodeURIComponent(raw)}`;
const dashboardIconGrey = toDataUrl(dashboardIconGreyRaw);
const dashboardIconWhite = toDataUrl(dashboardIconWhiteRaw);
const menuIconGrey = toDataUrl(menuIconGreyRaw);
const menuIconWhite = toDataUrl(menuIconWhiteRaw);
const sotrudnikiIconGrey = toDataUrl(sotrudnikiIconGreyRaw);
const sotrudnikiIconWhite = toDataUrl(sotrudnikiIconWhiteRaw);
const nomenculaturaIconGrey = toDataUrl(nomenculaturaIconGreyRaw);
const nomenculaturaIconWhite = toDataUrl(nomenculaturaIconWhiteRaw);
const otchetIconGrey = toDataUrl(otchetIconGreyRaw);
const otchetIconWhite = toDataUrl(otchetIconWhiteRaw);
const zpIconGrey = toDataUrl(zpIconGreyRaw);
const zpIconWhite = toDataUrl(zpIconWhiteRaw);

type MenuItem = {
  id: string;
  path: string;
  label: string;
  iconGrey: string;
  iconWhite: string;
};

const menuItems: MenuItem[] = [
  { id: 'dashboard', path: '/dashboard', label: 'Дашборд', iconGrey: dashboardIconGrey, iconWhite: dashboardIconWhite },
  { id: 'projects', path: '/projects', label: 'Проекты', iconGrey: menuIconGrey, iconWhite: menuIconWhite },
  { id: 'employees', path: '/employees', label: 'Сотрудники', iconGrey: sotrudnikiIconGrey, iconWhite: sotrudnikiIconWhite },
  { id: 'nomenclature', path: '/nomenclature', label: 'Номенклатура', iconGrey: nomenculaturaIconGrey, iconWhite: nomenculaturaIconWhite },
  { id: 'reports', path: '/reports', label: 'Отчеты', iconGrey: otchetIconGrey, iconWhite: otchetIconWhite },
  { id: 'salary', path: '/salary', label: 'Выдача ЗП', iconGrey: zpIconGrey, iconWhite: zpIconWhite },
];

type SidebarProps = {
  activeItem?: string;
  onNavigate?: (path: string) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({ activeItem = 'projects', onNavigate }) => {
  const handleClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-icon" />
        LOGO
      </div>

      <nav className="sidebar__nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar__item ${activeItem === item.id ? 'sidebar__item--active' : ''}`}
            onClick={() => handleClick(item.path)}
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
