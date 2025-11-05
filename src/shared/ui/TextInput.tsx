import React from 'react';
import glazOtkrit from '../icons/glaz_seriy_otkrit.svg';
import glazZakrit from '../icons/glaz_seriy_zakrit.svg';
import './text-input.scss';

type TextInputProps = {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  rightIcon?: React.ReactNode;
  className?: string;
  showPasswordToggle?: boolean;
  onTogglePassword?: () => void;
  isPasswordVisible?: boolean;
  fieldStyle?: React.CSSProperties;
};

export const TextInput: React.FC<TextInputProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  rightIcon,
  className,
  showPasswordToggle = false,
  onTogglePassword,
  isPasswordVisible = false,
  fieldStyle,
}) => {
  const handleIconClick = () => {
    if (showPasswordToggle && onTogglePassword) {
      onTogglePassword();
    }
  };

  const renderIcon = () => {
    if (showPasswordToggle) {
      const iconSrc = isPasswordVisible ? glazZakrit : glazOtkrit;
      return (
        <img
          src={iconSrc}
          alt={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
          className="ti__icon"
          onClick={handleIconClick}
        />
      );
    }
    return rightIcon;
  };

  return (
    <label className={`ti ${className ?? ''}`}>
      {label && <span className="ti__label">{label}</span>}
      <span className="ti__field" style={fieldStyle}>
        <input
          className="ti__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          style={fieldStyle ? { 
            height: '20px', 
            maxHeight: '20px',
            lineHeight: '20px', 
            fontSize: '12px', 
            padding: 0,
            margin: 0,
            border: 'none',
            outline: 'none'
          } : undefined}
        />
        {renderIcon() && <span className="ti__right">{renderIcon()}</span>}
      </span>
    </label>
  );
};


