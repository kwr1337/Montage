import React from 'react';
import './button.scss';

type ButtonProps = {
  text: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
};

export const Button: React.FC<ButtonProps> = ({ text, className, disabled, onClick, type = 'button' }) => {
  return (
    <button type={type} className={`btn ${className ?? ''}`} disabled={disabled} onClick={onClick}>
      {text}
    </button>
  );
};


