import React, { useState, useRef } from 'react';
import closeIcon from '../../icons/closeIcon.svg';
import importIcon from '../../icons/importIcon.svg';
import trashIcon from '../../icons/trashIcon.svg';
import importTableIcon from '../../icons/imporTableIcon.svg';
import './import-modal.scss';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/vnd.ms-excel' || file.type === 'text/csv' || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      handleFileSelect(file);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (uploadedFile) {
      onImport(uploadedFile);
      onClose();
      setUploadedFile(null);
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
            <a 
              href="https://docs.google.com/spreadsheets/d/1XI19fKKhvKeNL30NRor6hWltLZzNbHGSyiQt1IPU5VM/edit?gid=1262826783#gid=1262826783" 
              target="_blank" 
              rel="noopener noreferrer"
              className="import-modal__template-link-url"
            >
              https://docs.google.com/spreadsheets/d/1XI19fKKhvKeNL30NRor6hWltLZzNbHGSyiQt1IPU5VM/edit?gid=1262826783#gid=1262826783
            </a>
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
              accept=".xls,.csv"
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
            <span>Формат: XLS, CSV</span>
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
              <div className="import-modal__matches">
                <div className="import-modal__matches-header">
                  Найдено совпадений: 4 из 45
                </div>
                <div className="import-modal__matches-list">
                  <div className="import-modal__match-item">Провод ПВСбм Мастер Тока 3х1.5 белый 10м МТ1206</div>
                  <div className="import-modal__match-item">Кабель МКЭШ Торкабель 2х0,75 30м в коробке 0670087116637</div>
                  <div className="import-modal__match-item">Провод ПВСбм Мастер Тока 3х1.5 белый 10м МТ1206</div>
                  <div className="import-modal__match-item">Кабель МКЭШ Торкабель 2х0,75 30м в коробке 0670087116637</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Кнопка */}
        <div className="import-modal__actions">
          <button 
            className="import-modal__btn import-modal__btn--import"
            onClick={handleSubmit}
            disabled={!uploadedFile}
          >
            Импортировать
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;

