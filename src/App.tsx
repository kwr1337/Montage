import { useState, useEffect } from 'react';
import { LoginScreen } from './screens/Auth/LoginScreen';
import { MainLayout } from './shared/layouts/MainLayout';
import { apiService } from './services/api';
import './index.css';

// Импорт стилей всех экранов
import './screens/Dashboard/dashboard.scss';
import './screens/Projects/projects.scss';
import './screens/Calendar/calendar.scss';
import './screens/Employees/employees.scss';
import './screens/Employees/employee-detail.scss';
import './screens/Nomenclature/nomenclature.scss';
import './screens/Reports/reports.scss';
import './screens/Salary/salary.scss';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Проверяем токен при загрузке приложения
    const checkAuth = () => {
      if (apiService.isAuthenticated()) {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
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
    }
  };

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

  return <MainLayout onLogout={handleLogout} />;
}

export default App;
