import React from 'react';
import searchIcon from '../../icons/searchIcon.svg';
import './search-input.scss';

type SearchInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Поиск',
  className,
}) => {
  return (
    <div className={`search-input ${className ?? ''}`}>
      <img src={searchIcon} alt="Поиск" className="search-input__icon" />
      <input
        type="text"
        className="search-input__field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};

