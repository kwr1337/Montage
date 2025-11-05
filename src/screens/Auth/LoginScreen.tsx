import React, { useMemo, useState } from 'react';
import { TextInput } from '../../shared/ui/TextInput';
import { Button } from '../../shared/ui/Button';
import { apiService } from '../../services/api';
import './login.scss';

type LoginScreenProps = {
  onLogin?: () => void;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const formValid = useMemo(() => email.trim() && password.trim(), [email, password]);

  const handleLogin = async () => {
    if (formValid) {
      setIsLoading(true);
      setError('');
      try {
        await apiService.login({ email, password });
        if (onLogin) {
          onLogin();
        }
      } catch (err) {
        setError('Неверные учетные данные');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__logo">LOGO</div>
        <div className="login__title">Вход</div>

        <div className="login__form">
          <TextInput
            label="Электронная почта"
            placeholder="example@mail.com"
            value={email}
            onChange={setEmail}
            type="email"
          />

          <TextInput
            label="Пароль"
            placeholder="Введите пароль"
            value={password}
            onChange={setPassword}
            type={showPassword ? 'text' : 'password'}
            showPasswordToggle={true}
            onTogglePassword={() => setShowPassword((v) => !v)}
            isPasswordVisible={showPassword}
          />

          <button type="button" className="login__forgot">Восстановить пароль</button>

          {error && <div className="login__error">{error}</div>}

          <Button text={isLoading ? 'Загрузка...' : 'Войти'} disabled={!formValid || isLoading} className="login__submit" onClick={handleLogin} />
        </div>
      </div>
    </div>
  );
};


