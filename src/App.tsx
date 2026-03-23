import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isMobile, isTablet } from 'react-device-detect';
import { LoginScreen } from './screens/Auth/LoginScreen';
import { MainLayout } from './shared/layouts/MainLayout';
import { apiService } from './services/api';
import './index.css';

const ProjectsScreenMobile = lazy(() => import('./screens/Projects/ProjectsScreenMobile').then(m => ({ default: m.ProjectsScreenMobile })));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>
    Загрузка...
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => apiService.getCurrentUser());
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return isMobile || isTablet;
  });

  useEffect(() => {
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

    const handleDeviceChange = () => {
      setIsMobileDevice(isMobile || isTablet);
    };

    window.addEventListener('resize', handleDeviceChange);
    window.addEventListener('orientationchange', handleDeviceChange);
    handleDeviceChange();

    return () => {
      window.removeEventListener('resize', handleDeviceChange);
      window.removeEventListener('orientationchange', handleDeviceChange);
    };
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentUser(apiService.getCurrentUser());
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } catch {
      // Even if server logout fails, clear local state
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('token_type');
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  if (isLoading) {
    return <LoadingFallback />;
  }

  const userRole = currentUser?.role || currentUser?.position;
  const isBrigadier = userRole === 'Бригадир';
  const useMockData = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock') === '1';
  const shouldUseMobileProjects = isAuthenticated && isMobileDevice && (isBrigadier || useMockData);
  const shouldShowMobileRestriction = isAuthenticated && isMobileDevice && !isBrigadier && !useMockData;
  const shouldShowBrigadierPcRestriction = isAuthenticated && !isMobileDevice && isBrigadier && !useMockData;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/projects" replace />
              : <LoginScreen onLogin={handleLogin} />
          }
        />

        {!isAuthenticated ? (
          <Route path="*" element={<Navigate to="/login" replace />} />
        ) : shouldUseMobileProjects ? (
          <Route
            path="*"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <ProjectsScreenMobile onLogout={handleLogout} />
              </Suspense>
            }
          />
        ) : shouldShowMobileRestriction ? (
          <Route
            path="*"
            element={
              <div className="mobile-restriction">
                <div className="mobile-restriction__content">
                  <h1>Доступ через ПК</h1>
                  <p>Мобильная версия доступна только для бригадиров. Пожалуйста, откройте сервис на компьютере.</p>
                  <button type="button" onClick={handleLogout}>Выйти</button>
                </div>
              </div>
            }
          />
        ) : shouldShowBrigadierPcRestriction ? (
          <Route
            path="*"
            element={
              <div className="mobile-restriction">
                <div className="mobile-restriction__content">
                  <h1>Доступ через мобильную версию</h1>
                  <p>Бригадир может использовать сервис только на мобильном устройстве. Пожалуйста, откройте сервис на телефоне или планшете.</p>
                  <button type="button" onClick={handleLogout}>Выйти</button>
                </div>
              </div>
            }
          />
        ) : (
          <>
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/*" element={<MainLayout onLogout={handleLogout} />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
