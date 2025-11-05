import React, { useState, useRef, useEffect } from 'react';
import userDropdownIcon from '../../icons/user-dropdown-icon.svg';
import './status-filter.scss';

interface StatusFilterProps {
  onStatusChange: (status: string) => void;
}

const StatusFilter: React.FC<StatusFilterProps> = ({ onStatusChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('Все статусы');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const statuses = [
    { label: 'Все статусы', value: 'all', color: null },
    { label: 'Новый', value: 'Новый', color: '#2787F5' },
    { label: 'В работе', value: 'В работе', color: '#FF9E00' },
    { label: 'Завершен', value: 'Завершен', color: '#26AB69' },
    { label: 'Архив', value: 'Архив', color: '#919399' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusSelect = (status: typeof statuses[0]) => {
    setSelectedStatus(status.label);
    setIsOpen(false);
    onStatusChange(status.value);
  };


  return (
    <div className="status-filter" ref={dropdownRef}>
      <button
        className="status-filter__trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="status-filter__trigger-text">{selectedStatus}</span>
        <div className={`status-filter__arrow ${isOpen ? 'status-filter__arrow--up status-filter__arrow--active' : ''}`}>
          <img src={userDropdownIcon} alt="▼" />
        </div>
      </button>

      {isOpen && (
        <div className="status-filter__dropdown">
          {statuses.map((status) => (
            <div
              key={status.value}
              className={`status-filter__option ${
                selectedStatus === status.label ? 'status-filter__option--selected' : ''
              }`}
              onClick={() => handleStatusSelect(status)}
            >
              {status.color && (
                <div
                  className="status-filter__indicator"
                  style={{ backgroundColor: status.color }}
                />
              )}
              <span className="status-filter__option-text">{status.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StatusFilter;
