import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import closeIcon from '../../icons/closeIcon.svg';
import importIcon from '../../icons/importIcon.svg';
import trashIcon from '../../icons/trashIcon.svg';
import importTableIcon from '../../icons/imporTableIcon.svg';
import templateFile from '../../files/Файл шаблон для импорта.xlsx?url';
import { apiService } from '../../../services/api';
import './import-modal.scss';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, parsedData?: ParsedRow[], matches?: string[]) => void;
  projectId?: number;
}

interface ParsedRow {
  nomenclature: string;
  unit: string;
  quantity: number;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  projectId: _projectId,
}) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [allNomenclature, setAllNomenclature] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Загружаем всю номенклатуру при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      const loadNomenclature = async () => {
        try {
          const response = await apiService.getNomenclature();
          const nomenclatureData = Array.isArray(response?.data) 
            ? response.data 
            : response?.data 
            ? [response.data] 
            : [];
          setAllNomenclature(nomenclatureData);
        } catch (error) {
          console.error('Error loading nomenclature:', error);
          setAllNomenclature([]);
        }
      };
      loadNomenclature();
    }
  }, [isOpen]);

  // Сброс состояния при закрытии модального окна
  useEffect(() => {
    if (!isOpen) {
      setUploadedFile(null);
      setMatches([]);
      setParsedData([]);
      setTotalItems(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Функция для парсинга файла
  const parseFile = async (file: File): Promise<ParsedRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error('Не удалось прочитать файл'));
            return;
          }

          let workbook: XLSX.WorkBook;
          
          // Определяем тип файла и парсим
          if (file.name.toLowerCase().endsWith('.csv')) {
            // Для CSV используем текстовый режим
            const text = typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data as ArrayBuffer);
            workbook = XLSX.read(text, { type: 'string', codepage: 65001 });
          } else {
            // Для XLS/XLSX используем бинарный режим
            workbook = XLSX.read(data, { type: 'binary' });
          }

          // Берем первый лист
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Конвертируем в JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
          
          if (jsonData.length === 0) {
            reject(new Error('Файл пуст'));
            return;
          }

          // Ищем заголовки (первая строка)
          const headers = jsonData[0].map((h: any) => String(h).toLowerCase().trim());
          
          // Ищем индексы колонок
          const nomenclatureIndex = headers.findIndex(h => 
            h.includes('номенклатура') || h.includes('nomenclature')
          );
          const unitIndex = headers.findIndex(h => 
            h.includes('ед') || h.includes('измерения') || h.includes('unit')
          );
          const quantityIndex = headers.findIndex(h => 
            h.includes('кол') || h.includes('количество') || h.includes('quantity') || h.includes('кол-во')
          );

          if (nomenclatureIndex === -1 || unitIndex === -1 || quantityIndex === -1) {
            reject(new Error('Не найдены обязательные колонки: Номенклатура, Ед. измерения, Кол-во'));
            return;
          }

          // Парсим данные (начиная со второй строки)
          const parsed: ParsedRow[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const nomenclature = String(row[nomenclatureIndex] || '').trim();
            const unit = String(row[unitIndex] || '').trim();
            const quantityStr = String(row[quantityIndex] || '').trim();
            
            // Пропускаем пустые строки
            if (!nomenclature && !unit && !quantityStr) {
              continue;
            }

            // Проверяем обязательные поля
            if (!nomenclature || !unit) {
              continue; // Пропускаем строки без обязательных полей
            }

            const quantity = parseFloat(quantityStr.replace(',', '.'));
            if (isNaN(quantity) || quantity < 0) {
              continue; // Пропускаем невалидные значения количества
            }

            parsed.push({
              nomenclature,
              unit,
              quantity,
            });
          }

          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Ошибка чтения файла'));
      };

      // Читаем файл в зависимости от типа
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file, 'UTF-8');
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  // Функция для поиска совпадений по всей номенклатуре
  const findMatches = (parsedRows: ParsedRow[]): string[] => {
    const matchNames: string[] = [];
    
    parsedRows.forEach((row) => {
      // Ищем совпадение по названию номенклатуры во всей номенклатуре (без учета регистра)
      const found = allNomenclature.find((item: any) => {
        const itemName = String(item.name || '').toLowerCase().trim();
        const rowName = row.nomenclature.toLowerCase().trim();
        return itemName === rowName;
      });
      
      if (found) {
        matchNames.push(row.nomenclature);
      }
    });

    return matchNames;
  };

  const isValidFileType = (file: File): boolean => {
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const validMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    const hasValidMimeType = validMimeTypes.includes(file.type);
    
    return hasValidExtension || hasValidMimeType;
  };

  const handleFileSelect = async (file: File) => {
    if (isValidFileType(file)) {
      setUploadedFile(file);
      setMatches([]);
      setParsedData([]);
      setTotalItems(0);
      
      // Парсим файл и ищем совпадения (без импорта)
      try {
        setIsLoading(true);
        
        // Парсим файл
        const parsed = await parseFile(file);
        setParsedData(parsed);
        setTotalItems(parsed.length);
        
        // Ищем совпадения по названию номенклатуры во всей номенклатуре
        const foundMatches = findMatches(parsed);
        setMatches(foundMatches);
      } catch (error: any) {
        console.error('Error parsing file:', error);
        alert(error.message || 'Ошибка при чтении файла');
        setUploadedFile(null);
        setMatches([]);
        setParsedData([]);
        setTotalItems(0);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && isValidFileType(file)) {
      handleFileSelect(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(templateFile);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Файл шаблон для импорта.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      // Fallback: попробуем прямой способ
      const link = document.createElement('a');
      link.href = templateFile;
      link.download = 'Файл шаблон для импорта.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setMatches([]);
    setParsedData([]);
    setTotalItems(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (uploadedFile && parsedData.length > 0) {
      try {
        setIsImporting(true);
        // Вызываем импорт с передачей распарсенных данных и совпадений
        // Импорт происходит только здесь, при нажатии кнопки
        await onImport(uploadedFile, parsedData, matches);
        onClose();
      } catch (error) {
        console.error('Error importing file:', error);
      } finally {
        setIsImporting(false);
      }
    }
  };

  if (!isOpen) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="import-modal-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="import-modal__header">
          <h2 className="import-modal__title">Импорт таблицы</h2>
          <button className="import-modal__close" onClick={onClose}>
            <img src={closeIcon} alt="Закрыть" />
          </button>
        </div>

        {/* Контент */}
        <div className="import-modal__content">
          {/* Ссылка на шаблон */}
          <div className="import-modal__template-link">
            Шаблон:{' '}
            <button 
              onClick={handleDownloadTemplate}
              className="import-modal__template-link-url"
              type="button"
            >
              Скачать шаблон
            </button>
          </div>

          {/* Область загрузки */}
          <div 
            className={`import-modal__drop-zone ${isDragging ? 'import-modal__drop-zone--dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
            
            <div className="import-modal__drop-icon">
              <img src={importIcon} alt="Импорт" />
            </div>
            
            <p className="import-modal__drop-text">
              <span className="import-modal__drop-text-bold">Нажмите, чтобы загрузить</span>
              <br />
              <span className="import-modal__drop-text-normal">или перетащите файл в это поле</span>
            </p>
          </div>

          {/* Информация о форматах */}
          <div className="import-modal__info">
            <span>Формат: CSV, XLS, XLSX</span>
            <span>Макс. размер: 150 Mb</span>
          </div>

          {/* Загруженный файл */}
          {uploadedFile && (
            <div className="import-modal__file-info">
              <div className="import-modal__file-header">
                <div className="import-modal__file-name-wrapper">
                  <div className="import-modal__file-icon">
                    <img src={importTableIcon} alt="Файл" />
                  </div>
                  <div className="import-modal__file-details">
                    <div className="import-modal__file-name">{uploadedFile.name}</div>
                    <div className="import-modal__file-size">{formatFileSize(uploadedFile.size)} из {formatFileSize(uploadedFile.size)}</div>
                  </div>
                </div>
                <button className="import-modal__remove-btn" onClick={handleRemoveFile}>
                  <img src={trashIcon} alt="Удалить" />
                </button>
              </div>

              {/* Совпадения */}
              {isLoading ? (
                <div className="import-modal__matches">
                  <div className="import-modal__matches-header">
                    Проверка файла...
                  </div>
                </div>
              ) : uploadedFile ? (
                <div className="import-modal__matches">
                  <div className="import-modal__matches-header">
                    Найдено совпадений: {matches.length} из {totalItems}
                  </div>
                  {matches.length > 0 && (
                    <div className="import-modal__matches-list">
                      {matches.slice(0, 10).map((match, index) => (
                        <div key={index} className="import-modal__match-item">
                          {match}
                        </div>
                      ))}
                      {matches.length > 10 && (
                        <div className="import-modal__match-item" style={{ fontStyle: 'italic', color: '#919399' }}>
                          ... и еще {matches.length - 10} совпадений
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Кнопка */}
        <div className="import-modal__actions">
          <button 
            className="import-modal__btn import-modal__btn--import"
            onClick={handleSubmit}
            disabled={!uploadedFile || isLoading || isImporting}
          >
            {isImporting ? 'Импорт...' : isLoading ? 'Обработка...' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;

