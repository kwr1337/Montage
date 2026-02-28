import { useEffect, useState } from 'react';
import { LoginScreen } from './screens/Auth/LoginScreen';
import { MainLayout } from './shared/layouts/MainLayout';
import { apiService } from './services/api';
import { ProjectsScreenMobile } from './screens/Projects/ProjectsScreenMobile';
import './index.css';

// Импорт стилей всех экранов
import './screens/Dashboard/dashboard.scss';
import './screens/Projects/projects.scss';
import './screens/Projects/projects-mobile.scss';
import './screens/Calendar/calendar.scss';
import './screens/Employees/employees.scss';
import './screens/Employees/employee-detail.scss';
import './screens/Nomenclature/nomenclature.scss';
import './screens/Reports/reports.scss';
import './screens/Salary/salary.scss';

// 1280 — мобильная версия на планшетах в горизонтальной ориентации (1024px и меньше)
const MOBILE_WIDTH_THRESHOLD = 1024;
const MOBILE_HEIGHT_THRESHOLD = 600;

const getIsMobileViewport = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.innerWidth <= MOBILE_WIDTH_THRESHOLD || window.innerHeight <= MOBILE_HEIGHT_THRESHOLD;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => apiService.getCurrentUser());
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);

  useEffect(() => {
    // Проверяем токен при загрузке приложения
    const checkAuth = () => {
      if (apiService.isAuthenticated()) {
        setIsAuthenticated(true);
        setCurrentUser(apiService.getCurrentUser());
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleViewportChange = () => {
      setIsMobileViewport(getIsMobileViewport());
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    handleViewportChange();

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentUser(apiService.getCurrentUser());
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      // Даже если logout на сервере не удался, очищаем локальное состояние
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('token_type');
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  const userRole = currentUser?.role || currentUser?.position;
  const isBrigadier = userRole === 'Бригадир';
  const isMobileContext = isMobileViewport;
  const useMockData = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock') === '1';
  const shouldUseMobileProjects = isAuthenticated && isMobileContext && (isBrigadier || useMockData);
  const shouldShowMobileRestriction = isAuthenticated && isMobileContext && !isBrigadier && !useMockData;

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Загрузка...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (shouldUseMobileProjects) {
    return <ProjectsScreenMobile onLogout={handleLogout} />;
  }

  if (shouldShowMobileRestriction) {
    return (
      <div className="mobile-restriction">
        <div className="mobile-restriction__content">
          <h1>Доступ через ПК</h1>
          <p>Мобильная версия доступна только для бригадиров. Пожалуйста, откройте сервис на компьютере.</p>
          <button type="button" onClick={handleLogout}>Выйти</button>
        </div>
      </div>
    );
  }

  return <MainLayout onLogout={handleLogout} />;
}

export default App;

