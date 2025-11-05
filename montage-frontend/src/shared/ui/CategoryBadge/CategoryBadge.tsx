import React from 'react';
import './category-badge.scss';

type CategoryBadgeProps = {
  icon: string;
  label: string;
  className?: string;
};

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ icon, label, className }) => {
  return (
    <div className={`category-badge ${className ?? ''}`}>
      <img src={icon} alt={label} className="category-badge__icon" />
      <span className="category-badge__text">{label}</span>
    </div>
  );
};

