import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CategoryBadge } from '../CategoryBadge/CategoryBadge';
import { apiService } from '../../../services/api';
import plusIconRaw from '../../icons/plus-icon.svg?raw';
import userDropdownIconRaw from '../../icons/user-dropdown-icon.svg?raw';
import logoutIconRaw from '../../icons/logoutIcon.svg?raw';
import './page-header.scss';

const toDataUrl = (raw: string) => `data:image/svg+xml,${encodeURIComponent(raw)}`;
const plusIcon = toDataUrl(plusIconRaw);
const userDropdownIcon = toDataUrl(userDropdownIconRaw);
const logoutIcon = toDataUrl(logoutIconRaw);

type PageHeaderProps = {
  // Левая часть
  categoryIcon?: string;
  categoryLabel?: string;
  
  // Breadcrumb (хлебные крошки)
  breadcrumb?: {
    icon?: string;
    label: string;
    onClick?: () => void;
  }[];

  // Пагинация
  showPagination?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  backDisabled?: boolean;
  forwardDisabled?: boolean;

  // Правая часть
  createButtonText?: string;
  onCreate?: () => void;
  showUser?: boolean;
  userName?: string;
  onUserClick?: () => void;
  onLogout?: () => void;

  className?: string;
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  categoryIcon,
  categoryLabel,
  breadcrumb,
  showPagination = true,
  onBack,
  onForward,
  backDisabled = false,
  forwardDisabled = false,
  createButtonText = '+ Создать',
  onCreate,
  showUser = true,
  onUserClick,
  onLogout,
  className,
}) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = apiService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    if (apiService.isAuthenticated()) {
      apiService.getCurrentUserProfile()
        .then(response => {
          const userData = response?.data ?? response;
          if (userData && (userData.id || userData.role != null || userData.position != null)) {
            setCurrentUser(userData);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Функция для форматирования ФИО в формате "Фамилия И. О."
  const formatUserName = (user: any) => {
    if (!user) return 'Пользователь';

    const { first_name, second_name, last_name } = user;

    // Формат: Фамилия И. О.
    const lastNameInitial = last_name ? last_name.charAt(0).toUpperCase() : '';
    const firstNameInitial = first_name ? first_name.charAt(0).toUpperCase() : '';
    const secondNameInitial = second_name ? second_name.charAt(0).toUpperCase() : '';

    if (lastNameInitial && firstNameInitial) {
      return `${last_name} ${firstNameInitial}.${secondNameInitial ? ` ${secondNameInitial}.` : ''}`;
    }

    return first_name || 'Пользователь';
  };

  // Функция для получения инициалов (Иван Иванов -> ИИ)
  const getInitials = (user: any) => {
    if (!user) return 'П';
    const { first_name, last_name } = user;
    const firstInitial = first_name ? first_name.charAt(0).toUpperCase() : '';
    const lastInitial = last_name ? last_name.charAt(0).toUpperCase() : '';
    return (lastInitial + firstInitial) || 'П';
  };

  // Функция для получения цвета фона на основе имени
  const getAvatarColor = (text: string) => {
    const colors = [
      '#2787f5', '#26ab69', '#ff9e00', '#f5222d', 
      '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const userDisplayName = currentUser ? formatUserName(currentUser) : 'Пользователь';

  const handleUserClick = () => {
    if (onUserClick) {
      onUserClick();
    } else {
      setIsUserDropdownOpen(!isUserDropdownOpen);
    }
  };

  const handleLogout = async () => {
    try {
      if (onLogout) {
        await onLogout();
      }
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('user');
      setIsUserDropdownOpen(false);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };
  return (
    <header className={`page-header ${className ?? ''}`}>
      <div className="page-header__left">
        {showPagination && (
          <div className="page-header__pagination">
            <button
              className="page-header__pagination-btn page-header__pagination-btn--back"
              onClick={onBack}
              disabled={backDisabled}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11.25 13.5L6.75 9L11.25 4.5" stroke="#2C2D2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="page-header__pagination-btn page-header__pagination-btn--forward"
              onClick={onForward}
              disabled={forwardDisabled}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M6.75 4.5L11.25 9L6.75 13.5" stroke="#2C2D2E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}

        {breadcrumb && breadcrumb.length > 0 ? (
          <div className="page-header__breadcrumb">
            {breadcrumb.map((item, index) => (
              <React.Fragment key={index}>
                {item.onClick ? (
                  <button className="page-header__breadcrumb-btn" onClick={item.onClick}>
                    {item.icon && <img src={item.icon} alt={item.label} />}
                    <span>{item.label}</span>
                  </button>
                ) : (
                  <span className="page-header__breadcrumb-current">{item.label}</span>
                )}
                {index < breadcrumb.length - 1 && (
                  <img 
                    src={userDropdownIcon} 
                    alt="→" 
                    className="page-header__breadcrumb-separator" 
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        ) : categoryIcon && categoryLabel ? (
          <CategoryBadge icon={categoryIcon} label={categoryLabel} />
        ) : null}
      </div>

      <div className="page-header__right">
        {onCreate && (
          <button className="page-header__create" onClick={onCreate}>
            <img src={plusIcon} alt="+" className="page-header__create-icon" />
            <span className="page-header__create-text">{createButtonText}</span>
          </button>
        )}

        {showUser && (
          <div className="page-header__user-wrapper" ref={dropdownRef}>
            <div className="page-header__user" onClick={handleUserClick}>
              {currentUser && (currentUser.avatar_id || currentUser.avatar_url) ? (
                <img 
                  src={currentUser.avatar_url || `http://92.53.97.20/api/avatars/${currentUser.avatar_id}`} 
                  alt={userDisplayName} 
                  className="page-header__user-avatar" 
                />
              ) : (
                <div 
                  className="page-header__user-avatar page-header__user-avatar--initials"
                  style={{ backgroundColor: getAvatarColor(userDisplayName) }}
                >
                  {getInitials(currentUser)}
                </div>
              )}
              <span className="page-header__user-text">{userDisplayName}</span>
              <img
                src={userDropdownIcon}
                alt="▼"
                className={`page-header__user-arrow ${isUserDropdownOpen ? 'page-header__user-arrow--active' : ''}`}
              />
            </div>

            {isUserDropdownOpen && (
              <div className="page-header__user-dropdown">
                <button className="page-header__logout-btn" onClick={handleLogout}>
                  <img src={logoutIcon} alt="Выйти" />
                  <span>Выйти</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
