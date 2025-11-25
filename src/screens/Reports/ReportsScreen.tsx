import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PageHeader } from '../../shared/ui/PageHeader/PageHeader';
import { Pagination } from '../../shared/ui/Pagination/Pagination';
import { apiService } from '../../services/api';
import otchetIconGrey from '../../shared/icons/otchetIconGrey.svg';
import searchIcon from '../../shared/icons/searchIcon.svg';
import upDownTableFilter from '../../shared/icons/upDownTableFilter.svg';
import calendarIconGrey from '../../shared/icons/calendarIconGrey.svg';
import otchetDownIcon from '../../shared/icons/otchetDown.svg';
import './reports.scss';

type ReportType = 'nomenclature' | 'payments';

type Report = {
  id: number;
  type: ReportType;
  name: string;
  format: string;
  createdAt: string; // Дата создания отчёта
  projectId?: number; // Для отчёта по номенклатуре
};

export const ReportsScreen: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null); // null = по дате добавления
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  
  const itemsPerPage = 11;
  const dateFromRef = useRef<HTMLInputElement>(null);
  const dateToRef = useRef<HTMLInputElement>(null);


  // Загрузка проектов для отчёта по номенклатуре
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await apiService.getProjects(1, 1000);
        let projectsList: any[] = [];
        
        if (Array.isArray(response)) {
          projectsList = response;
        } else if (response?.data && Array.isArray(response.data)) {
          projectsList = response.data;
        } else if (response?.data?.data && Array.isArray(response.data.data)) {
          projectsList = response.data.data;
        }
        
        setProjects(projectsList);
      } catch (error) {
        console.error('Error loading projects:', error);
      }
    };
    
    loadProjects();
  }, []);

  // Генерация списка отчётов на основе периода
  useEffect(() => {
    const generateReports = () => {
      const reportsList: Report[] = [];
      let reportId = 1;

      // Для каждого проекта создаём отчёт по номенклатуре
      projects.forEach((project) => {
        if (project.id) {
          reportsList.push({
            id: reportId++,
            type: 'nomenclature',
            name: `Отчет выполнения работ по проекту (движение материала) - ${project.name || `Проект №${project.id}`}`,
            format: '.xls',
            createdAt: project.created_at || new Date().toISOString(),
            projectId: project.id,
          });
        }
      });

      // Добавляем отчёт по выплатам
      reportsList.push({
        id: reportId++,
        type: 'payments',
        name: 'Отчет по выплатам',
        format: '.xls',
        createdAt: new Date().toISOString(),
      });

      setReports(reportsList);
    };

    generateReports();
  }, [projects]);


  // Фильтрация отчётов по периоду
  const filteredByPeriod = useMemo(() => {
    if (!dateFrom && !dateTo) {
      return reports; // Если период не выбран, показываем все
    }

    return reports.filter((report) => {
      const reportDate = new Date(report.createdAt);
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? new Date(dateTo) : null;

      if (fromDate && toDate) {
        return reportDate >= fromDate && reportDate <= toDate;
      } else if (fromDate) {
        return reportDate >= fromDate;
      } else if (toDate) {
        return reportDate <= toDate;
      }

      return true;
    });
  }, [reports, dateFrom, dateTo]);

  // Фильтрация по поиску
  const filteredBySearch = useMemo(() => {
    if (!searchValue) return filteredByPeriod;
    return filteredByPeriod.filter((report) =>
      report.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [filteredByPeriod, searchValue]);

  // Сортировка
  const sortedReports = useMemo(() => {
    const sorted = [...filteredBySearch];

    if (sortField === null) {
      // Сортировка по дате добавления (по умолчанию)
      sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
      });
    } else if (sortField === 'name') {
      // Сортировка по названию (А-Я или Я-А)
      sorted.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (sortDirection === 'asc') {
          return nameA.localeCompare(nameB, 'ru');
        } else {
          return nameB.localeCompare(nameA, 'ru');
        }
      });
    }

    return sorted;
  }, [filteredBySearch, sortField, sortDirection]);

  // Обработка клика на иконку сортировки
  const handleSortClick = () => {
    if (sortField === null) {
      // Переключаемся на сортировку по названию
      setSortField('name');
      setSortDirection('asc');
    } else if (sortField === 'name') {
      // Переключаем направление сортировки
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    }
  };

  // Пагинация
  const totalPages = Math.ceil(sortedReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReports = sortedReports.slice(startIndex, endIndex);

  const handleSelectReport = (reportId: number) => {
    const newSelected = new Set(selectedReportIds);
    if (newSelected.has(reportId)) {
      newSelected.delete(reportId);
    } else {
      newSelected.add(reportId);
    }
    setSelectedReportIds(newSelected);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(paginatedReports.map((r) => r.id));
      setSelectedReportIds(allIds);
    } else {
      setSelectedReportIds(new Set());
    }
  };

  // Скачивание отчёта по номенклатуре
  const downloadNomenclatureReport = async (report: Report) => {
    if (!report.projectId) return;

    setIsLoading(true);
    try {
      const periodStart = dateFrom || new Date().toISOString().split('T')[0];
      const periodEnd = dateTo || new Date().toISOString().split('T')[0];

      const response = await apiService.getProjectNomenclatureReport(report.projectId, {
        period_start: periodStart,
        period_end: periodEnd,
      });

      // Если ответ - это Blob (файл), скачиваем его
      if (response instanceof Blob) {
        const url = window.URL.createObjectURL(response);
        const link = document.createElement('a');
        link.href = url;
        
        // Формируем имя файла: Отчет_номенклатуры_Проект_ИД_Период.xlsx
        const projectName = report.name.includes('Проект №') 
          ? report.name.match(/Проект №(\d+)/)?.[1] || report.projectId 
          : report.projectId;
        const startDate = periodStart.replace(/-/g, '');
        const endDate = periodEnd.replace(/-/g, '');
        link.download = `Отчет_номенклатуры_Проект_${projectName}_${startDate}_${endDate}.xlsx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (response && typeof response === 'object' && 'report_url' in response) {
        // Если ответ - JSON с report_url, скачиваем файл по URL
        const reportUrl = (response as any).report_url;
        if (reportUrl) {
          // Создаем временную ссылку для скачивания
          const link = document.createElement('a');
          link.href = reportUrl;
          link.download = reportUrl.split('/').pop() || 'report.xlsx';
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        // Если ответ - JSON без report_url
        console.log('Nomenclature report data (JSON):', response);
        alert('Функция формирования отчёта из JSON данных в разработке');
      }
    } catch (error: any) {
      console.error('Error downloading nomenclature report:', error);
      const errorMessage = error?.message || 'Ошибка при скачивании отчёта';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Скачивание отчёта по выплатам
  const downloadPaymentsReport = async (_report: Report) => {
    setIsLoading(true);
    try {
      // Используем dateFrom или текущую дату, но берём первый день месяца
      let periodDate: Date;
      if (dateFrom) {
        periodDate = new Date(dateFrom);
      } else {
        periodDate = new Date();
      }
      
      // Форматируем как YYYY-MM-DD (первый день месяца)
      const year = periodDate.getFullYear();
      const month = String(periodDate.getMonth() + 1).padStart(2, '0');
      const period = `${year}-${month}-01`;

      const response = await apiService.getPaymentsReport({
        period: period,
      });

      // Если ответ - это Blob (файл), скачиваем его
      if (response instanceof Blob) {
        const url = window.URL.createObjectURL(response);
        const link = document.createElement('a');
        link.href = url;
        
        // Формируем имя файла: Выплаты_ЗП_ММ_ГГГГ.xlsx
        const monthName = String(periodDate.getMonth() + 1).padStart(2, '0');
        const yearName = periodDate.getFullYear();
        link.download = `Выплаты_ЗП_${monthName}_${yearName}.xlsx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else if (response && typeof response === 'object' && 'report_url' in response) {
        // Если ответ - JSON с report_url, скачиваем файл по URL
        const reportUrl = (response as any).report_url;
        if (reportUrl) {
          // Создаем временную ссылку для скачивания
          const link = document.createElement('a');
          link.href = reportUrl;
          link.download = reportUrl.split('/').pop() || 'report.xlsx';
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        // Если ответ - JSON без report_url
        console.log('Payments report data (JSON):', response);
        alert('Функция формирования отчёта из JSON данных в разработке');
      }
    } catch (error: any) {
      console.error('Error downloading payments report:', error);
      const errorMessage = error?.message || 'Ошибка при скачивании отчёта';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (report: Report) => {
    if (report.type === 'nomenclature') {
      downloadNomenclatureReport(report);
    } else if (report.type === 'payments') {
      downloadPaymentsReport(report);
    }
  };

  const formatDateDDMMYYYY = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="reports">
      <PageHeader
        categoryIcon={otchetIconGrey}
        categoryLabel="Отчёты"
        showPagination={true}
      />

      <div className="reports__content">
        <div className="reports__toolbar">
          <div className="reports__filters">
            <div className="reports__search">
              <img src={searchIcon} alt="Поиск" className="reports__search-icon" />
              <input
                type="text"
                className="reports__search-input"
                placeholder="Поиск"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>

            <div className="reports__date-range">
              <div className="reports__date-range-left">
                <img src={calendarIconGrey} alt="Календарь" />
                <div 
                  className="reports__date-input-wrapper"
                  onClick={() => {
                    if (dateFromRef.current) {
                      dateFromRef.current.showPicker?.();
                      dateFromRef.current.focus();
                    }
                  }}
                >
                  <input
                    ref={dateFromRef}
                    type="date"
                    className="reports__date-input"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setCurrentPage(1); // Сбрасываем страницу при изменении фильтра
                    }}
                  />
                  {dateFrom ? (
                    <span className="reports__date-display">
                      {formatDateDDMMYYYY(dateFrom)}
                    </span>
                  ) : (
                    <span className="reports__date-placeholder">С ...</span>
                  )}
                </div>
              </div>
              <div className="reports__date-range-divider"></div>
              <div className="reports__date-range-right">
                <div 
                  className="reports__date-input-wrapper"
                  onClick={() => {
                    if (dateToRef.current) {
                      dateToRef.current.showPicker?.();
                      dateToRef.current.focus();
                    }
                  }}
                >
                  <input
                    ref={dateToRef}
                    type="date"
                    className="reports__date-input"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setCurrentPage(1); // Сбрасываем страницу при изменении фильтра
                    }}
                  />
                  {dateTo ? (
                    <span className="reports__date-display">
                      {formatDateDDMMYYYY(dateTo)}
                    </span>
                  ) : (
                    <span className="reports__date-placeholder">По ...</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="reports__table">
          <div className="reports__table-header">
            <div className="reports__table-header-col">
              <input
                type="checkbox"
                checked={paginatedReports.length > 0 && paginatedReports.every((r) => selectedReportIds.has(r.id))}
                onChange={handleSelectAll}
              />
              <div className="reports__table-header-content" onClick={handleSortClick}>
                <span>Наименование</span>
                <img 
                  src={upDownTableFilter} 
                  alt="↑↓" 
                  className={`reports__sort-icon ${sortField !== null ? 'reports__sort-icon--active' : ''}`}
                />
              </div>
            </div>
          </div>

          <div className="reports__table-body">
            {isLoading ? (
              <div className="reports__empty">Загрузка...</div>
            ) : paginatedReports.length === 0 ? (
              <div className="reports__empty">Нет данных для отображения</div>
            ) : (
              paginatedReports.map((report) => (
                <div key={report.id} className="reports__table-row">
                  <div className="reports__table-row-col">
                    <input
                      type="checkbox"
                      className="reports__checkbox"
                      checked={selectedReportIds.has(report.id)}
                      onChange={() => handleSelectReport(report.id)}
                    />
                    <div className="reports__report-info">
                      <span className="reports__report-name">{report.name}</span>
                    </div>
                    <div className="reports__report-format">{report.format}</div>
                    <button 
                      className="reports__download-btn"
                      onClick={() => handleDownload(report)}
                      disabled={isLoading}
                    >
                      <img src={otchetDownIcon} alt="Скачать" className="reports__download-icon" />
                      <span>Скачать</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="reports__pagination">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};
