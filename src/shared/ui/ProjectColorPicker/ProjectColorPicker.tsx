import React, { useState, useRef, useEffect } from 'react';
import userDropdownIconRaw from '../../icons/user-dropdown-icon.svg?raw';
import './project-color-picker.scss';

const userDropdownIcon = `data:image/svg+xml,${encodeURIComponent(userDropdownIconRaw)}`;

/**
 * Готовая палитра. Тона светлые: цвет идёт заливкой ячеек Excel-отчёта под чёрным текстом.
 * Травянисто-зелёного нет намеренно — им в отчёте отмечены выходные и праздники.
 */
const PRESET_COLORS = [
  { label: 'Красный', value: '#FF7B7B' },
  { label: 'Оранжевый', value: '#FFB366' },
  { label: 'Жёлтый', value: '#FFE066' },
  { label: 'Бирюзовый', value: '#66D9C8' },
  { label: 'Голубой', value: '#7FCDFF' },
  { label: 'Синий', value: '#7B9BFF' },
  { label: 'Фиолетовый', value: '#B58CFF' },
  { label: 'Розовый', value: '#FF9ED2' },
  { label: 'Персиковый', value: '#FFCBA4' },
  { label: 'Песочный', value: '#E8D5A3' },
  { label: 'Коричневый', value: '#C9A27E' },
  { label: 'Серый', value: '#BFC5CC' },
];

/** С чего открывается выбор своего цвета, пока цвет не задан */
const CUSTOM_PICKER_START = '#2787f5';

/** Название для цвета не из палитры — приблизительное, по оттенку, насыщенности и светлоте */
const describeColor = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (lightness <= 0.1) return 'Чёрный';
  if (lightness >= 0.96) return 'Белый';
  if (saturation < 0.12) return 'Серый';

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;

  const isDark = lightness < 0.4;
  if (hue < 15 || hue >= 345) {
    if (isDark) return 'Бордовый';
    return lightness >= 0.8 ? 'Розовый' : 'Красный';
  }
  if (hue < 40) return isDark ? 'Коричневый' : 'Оранжевый';
  if (hue < 65) return isDark ? 'Оливковый' : 'Жёлтый';
  if (hue < 95) return 'Салатовый';
  if (hue < 160) return 'Зелёный';
  if (hue < 185) return 'Бирюзовый';
  if (hue < 215) return 'Голубой';
  if (hue < 250) return 'Синий';
  if (hue < 295) return 'Фиолетовый';
  return 'Розовый';
};

type ProjectColorPickerProps = {
  /** HEX-цвет #RRGGBB или null, если цвет не выбран */
  value: string | null;
  onChange: (color: string | null) => void;
  disabled?: boolean;
  /** Клик по полю, когда оно недоступно для редактирования */
  onDisabledClick?: () => void;
};

export const ProjectColorPicker: React.FC<ProjectColorPickerProps> = ({
  value,
  onChange,
  disabled = false,
  onDisabledClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Бэкенд принимает оба регистра, храним и показываем в верхнем — как уже лежит в базе
  const color = value ? value.toUpperCase() : null;
  const preset = PRESET_COLORS.find((item) => item.value === color);
  const isCustom = color != null && !preset;

  const handleTriggerClick = () => {
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    setIsOpen(!isOpen);
  };

  const handleSelect = (next: string | null) => {
    onChange(next);
    setIsOpen(false);
  };

  return (
    <div className="project-color-picker" ref={rootRef}>
      <button
        type="button"
        className={`project-color-picker__trigger ${disabled ? 'project-color-picker__trigger--readonly' : ''}`}
        onClick={handleTriggerClick}
        title={color ?? undefined}
      >
        {color ? (
          <>
            <span className="project-color-picker__dot" style={{ backgroundColor: color }} />
            <span className="project-color-picker__value">{preset ? preset.label : describeColor(color)}</span>
          </>
        ) : (
          <span className="project-color-picker__placeholder">Не выбран</span>
        )}
        {!disabled && (
          <img
            src={userDropdownIcon}
            alt="▼"
            className={`project-color-picker__arrow ${isOpen ? 'project-color-picker__arrow--open' : ''}`}
          />
        )}
      </button>

      {isOpen && (
        <div className="project-color-picker__dropdown">
          <div className="project-color-picker__palette">
            {PRESET_COLORS.map((item) => (
              <button
                type="button"
                key={item.value}
                className={`project-color-picker__swatch ${item.value === color ? 'project-color-picker__swatch--selected' : ''}`}
                style={{ backgroundColor: item.value }}
                title={item.label}
                aria-label={item.label}
                onClick={() => handleSelect(item.value)}
              />
            ))}
          </div>

          <div className="project-color-picker__footer">
            <label className="project-color-picker__custom">
              <span
                className={`project-color-picker__swatch project-color-picker__swatch--custom ${isCustom ? 'project-color-picker__swatch--selected' : ''}`}
                style={isCustom ? { background: color } : undefined}
              >
                {/* Системный выбор цвета отдаёт ровно #rrggbb, без альфа-канала — как требует API */}
                <input
                  type="color"
                  value={(color ?? CUSTOM_PICKER_START).toLowerCase()}
                  onChange={(e) => onChange(e.target.value.toUpperCase())}
                />
              </span>
              <span>Свой цвет</span>
            </label>

            <button
              type="button"
              className="project-color-picker__clear"
              disabled={!color}
              onClick={() => handleSelect(null)}
            >
              Без цвета
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
