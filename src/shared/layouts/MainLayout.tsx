import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Sidebar } from '../ui/Sidebar/Sidebar';

type MainLayoutProps = {
  onLogout?: () => void;
};
import { ProjectsScreen } from '../../screens/Projects/ProjectsScreen';
import { DashboardScreen } from '../../screens/Dashboard/DashboardScreen';
import { EmployeesScreen } from '../../screens/Employees/EmployeesScreen';
import { NomenclatureScreen } from '../../screens/Nomenclature/NomenclatureScreen';
import { ReportsScreen } from '../../screens/Reports/ReportsScreen';
import { SalaryScreen } from '../../screens/Salary/SalaryScreen';
import './main-layout.scss';

export const MainLayout: FC<MainLayoutProps> = ({ onLogout: _onLogout }) => {
  // Восстанавливаем activeMenuItem из localStorage при загрузке
  const [activeMenuItem, setActiveMenuItem] = useState(() => {
    const saved = localStorage.getItem('activeMenuItem');
    // Если сохранен 'calendar', перенаправляем на 'projects'
    if (saved === 'calendar') {
      localStorage.setItem('activeMenuItem', 'projects');
      return 'projects';
    }
    return saved || 'projects';
  });

  // Устанавливаем флаг в sessionStorage при первой загрузке, чтобы отличить перезагрузку от переключения вкладок
  useEffect(() => {
    const isPageReload = !sessionStorage.getItem('isInitialized');
    if (isPageReload) {
      sessionStorage.setItem('isInitialized', 'true');
      // При перезагрузке страницы сохраняем текущие значения selectedProjectId и selectedEmployeeId
      // в sessionStorage, чтобы они не были очищены при переключении вкладок
      const savedProjectId = localStorage.getItem('selectedProjectId');
      const savedEmployeeId = localStorage.getItem('selectedEmployeeId');
      if (savedProjectId) {
        sessionStorage.setItem('savedProjectId', savedProjectId);
      }
      if (savedEmployeeId) {
        sessionStorage.setItem('savedEmployeeId', savedEmployeeId);
      }
    }
  }, []);

  // Обработчик изменения активного пункта меню с сохранением в localStorage
  const handleNavigate = (itemId: string) => {
    setActiveMenuItem(itemId);
    localStorage.setItem('activeMenuItem', itemId);
    
    // Очищаем открытые карточки при переключении вкладок (но не при перезагрузке страницы)
    // Если флаг isInitialized уже установлен, значит это переключение вкладок, а не перезагрузка
    if (sessionStorage.getItem('isInitialized')) {
      localStorage.removeItem('selectedProjectId');
      localStorage.removeItem('selectedEmployeeId');
      // Также очищаем sessionStorage, чтобы карточки не восстанавливались при возврате на вкладку
      sessionStorage.removeItem('savedProjectId');
      sessionStorage.removeItem('savedEmployeeId');
    }
  };

  const renderScreen = () => {
    switch (activeMenuItem) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'projects':
        return <ProjectsScreen />;
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

