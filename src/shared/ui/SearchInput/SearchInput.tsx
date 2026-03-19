import React from 'react';
import searchIconRaw from '../../icons/searchIcon.svg?raw';
import './search-input.scss';

const toDataUrl = (raw: string) => `data:image/svg+xml,${encodeURIComponent(raw)}`;
const searchIcon = toDataUrl(searchIconRaw);

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

