import { useState } from 'react';
import type { FC } from 'react';
import { Sidebar } from '../ui/Sidebar/Sidebar';

type MainLayoutProps = {
  onLogout?: () => void;
};
import { ProjectsScreen } from '../../screens/Projects/ProjectsScreen';
import { DashboardScreen } from '../../screens/Dashboard/DashboardScreen';
import { CalendarScreen } from '../../screens/Calendar/CalendarScreen';
import { EmployeesScreen } from '../../screens/Employees/EmployeesScreen';
import { NomenclatureScreen } from '../../screens/Nomenclature/NomenclatureScreen';
import { ReportsScreen } from '../../screens/Reports/ReportsScreen';
import { SalaryScreen } from '../../screens/Salary/SalaryScreen';
import './main-layout.scss';

export const MainLayout: FC<MainLayoutProps> = ({ onLogout }) => {
  // Восстанавливаем activeMenuItem из localStorage при загрузке
  const [activeMenuItem, setActiveMenuItem] = useState(() => {
    const saved = localStorage.getItem('activeMenuItem');
    return saved || 'projects';
  });

  // Обработчик изменения активного пункта меню с сохранением в localStorage
  const handleNavigate = (itemId: string) => {
    setActiveMenuItem(itemId);
    localStorage.setItem('activeMenuItem', itemId);
  };

  const renderScreen = () => {
    switch (activeMenuItem) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'projects':
        return <ProjectsScreen />;
      case 'calendar':
        return <CalendarScreen />;
      case 'employees':
        return <EmployeesScreen />;
      case 'nomenclature':
        return <NomenclatureScreen />;
      case 'reports':
        return <ReportsScreen />;
      case 'salary':
        return <SalaryScreen />;
      default:
        return <ProjectsScreen />;
    }
  };

  return (
    <div className="main-layout">
      <Sidebar activeItem={activeMenuItem} onNavigate={handleNavigate} />
      <main className="main-layout__content">{renderScreen()}</main>
    </div>
  );
};

