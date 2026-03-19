import { lazy, Suspense } from 'react';
import type { FC } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../ui/Sidebar/Sidebar';
import { apiService } from '../../services/api';
import { canAccessEmployees, canAccessSalary } from '../../services/permissions';
import './main-layout.scss';

const ProjectsScreen = lazy(() => import('../../screens/Projects/ProjectsScreen').then(m => ({ default: m.ProjectsScreen })));
const DashboardScreen = lazy(() => import('../../screens/Dashboard/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const EmployeesScreen = lazy(() => import('../../screens/Employees/EmployeesScreen').then(m => ({ default: m.EmployeesScreen })));
const NomenclatureScreen = lazy(() => import('../../screens/Nomenclature/NomenclatureScreen').then(m => ({ default: m.NomenclatureScreen })));
const ReportsScreen = lazy(() => import('../../screens/Reports/ReportsScreen').then(m => ({ default: m.ReportsScreen })));
const SalaryScreen = lazy(() => import('../../screens/Salary/SalaryScreen').then(m => ({ default: m.SalaryScreen })));

type MainLayoutProps = {
  onLogout?: () => void;
};

const NoAccess = () => (
  <div className="main-layout__no-access">
    <p>Недостаточно прав</p>
  </div>
);

const ProtectedEmployees = () => {
  const user = apiService.getCurrentUser();
  return canAccessEmployees(user) ? <EmployeesScreen /> : <NoAccess />;
};

const ProtectedSalary = () => {
  const user = apiService.getCurrentUser();
  return canAccessSalary(user) ? <SalaryScreen /> : <NoAccess />;
};

export const MainLayout: FC<MainLayoutProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    const user = apiService.getCurrentUser();
    if (path === '/employees' && !canAccessEmployees(user)) {
      alert('Недостаточно прав');
      return;
    }
    if (path === '/salary' && !canAccessSalary(user)) {
      alert('Недостаточно прав');
      return;
    }
    navigate(path);
  };

  const activeItem = location.pathname.split('/')[1] || 'projects';

  return (
    <div className="main-layout">
      <Sidebar activeItem={activeItem} onNavigate={handleNavigate} />
      <main className="main-layout__content">
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#888' }}>Загрузка...</div>}>
          <Routes>
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/projects/*" element={<ProjectsScreen />} />
            <Route path="/employees/*" element={<ProtectedEmployees />} />
            <Route path="/nomenclature" element={<NomenclatureScreen />} />
            <Route path="/reports" element={<ReportsScreen />} />
            <Route path="/salary" element={<ProtectedSalary />} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};
