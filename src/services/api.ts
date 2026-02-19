// Используем переменную окружения или прокси через Vercel в production
// В development через vite proxy, в production через Vercel rewrites
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://92.53.97.20/api');

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  token_type?: string;
  user: {
    id: number;
    first_name: string;
    second_name: string;
    last_name: string;
    email: string;
    phone?: string;
    role?: string;
    avatar_id?: string | null;
    is_employee?: boolean;
    employment_date?: string;
    employee_status?: string;
    position?: string;
    rate_per_hour?: number;
    work_schedule?: string;
    is_system_admin?: boolean;
  };
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

class ApiService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const token = localStorage.getItem('auth_token');
    const tokenType = localStorage.getItem('token_type') || 'Bearer';

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(token && { Authorization: `${tokenType} ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      console.error('Response status:', response.status);
      console.error('Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Если 401 - токен истек, разлогинить пользователя
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_type');
        localStorage.removeItem('user');
        window.location.href = '/'; // Перенаправляем на страницу входа
      }
      
      // Создаем ошибку с информацией о статусе для лучшей обработки
      const error = new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      (error as any).status = response.status;
      (error as any).statusText = response.statusText;
      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      await response.text();
      return { data: null as any, success: false, message: 'Unexpected response format' };
    }
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      await response.text();
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const response_data = await response.json();

    if (response_data.data) {
      const { token, token_type, user } = response_data.data;
      
      if (token) {
        localStorage.setItem('auth_token', token);
      }
      
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }

      // Сохраним токен типа для будущих запросов
      if (token_type) {
        localStorage.setItem('token_type', token_type);
      }
    }

    return response_data.data;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
    });

    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('token_type');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getCurrentUser(): any | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  async getCurrentUserProfile(): Promise<any> {
    const response = await this.request<any>('/auth/me', {
      method: 'GET',
    });
    return response;
  }

  async getProjects(
    page: number = 1,
    perPage: number = 11,
    options?: { with?: string[]; noPagination?: boolean }
  ): Promise<any> {
    const params = new URLSearchParams();
    if (!options?.noPagination) {
      params.set('page', String(page));
      params.set('per_page', String(perPage));
    }
    if (options?.with?.length) {
      options.with.forEach((rel) => params.append('with[]', rel));
    }
    const query = params.toString();
    const response = await this.request<any>(`/projects${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
    return response;
  }

  async getProjectById(projectId: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}`, {
      method: 'GET',
    });
    return response;
  }

  async getUsers(): Promise<any> {
    const response = await this.request<any>('/users', {
      method: 'GET',
    });
    return response;
  }

  /** Назначения рабочих на день (для бригадира) */
  async getAssignments(assignmentDate: string): Promise<any> {
    const response = await this.request<any>(`/assignments?assignment_date=${assignmentDate}`, {
      method: 'GET',
    });
    return response;
  }

  /** Рабочие с информацией о занятости (кто кем назначен) */
  async getAssignmentsWorkers(assignmentDate: string): Promise<any> {
    const response = await this.request<any>(`/assignments/workers?assignment_date=${assignmentDate}`, {
      method: 'GET',
    });
    return response;
  }

  /** Добавить рабочего на день */
  async addAssignment(workerId: number, assignmentDate: string): Promise<any> {
    const response = await this.request<any>('/assignments/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ worker_id: workerId, assignment_date: assignmentDate }),
    });
    return response;
  }

  /** Удалить рабочего с дня */
  async deleteAssignment(workerId: number, assignmentDate: string): Promise<any> {
    const response = await this.request<any>(`/assignments/delete/${workerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ assignment_date: assignmentDate }),
    });
    return response;
  }

  async getUserById(userId: number): Promise<any> {
    const response = await this.request<any>(`/users/${userId}`, {
      method: 'GET',
    });
    return response;
  }

  async registerEmployee(data: any): Promise<any> {
    const response = await this.request<any>('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response;
  }

  // Обновление пользователя
  async updateUser(userId: number, data: any): Promise<any> {
    const url = `/users/${userId}/update`;
    const response = await this.request<any>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response;
  }

  async createProject(data: any): Promise<any> {
    try {
      const response = await this.request<any>('/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateProject(projectId: number, data: any): Promise<any> {
    const url = `${this.baseURL}/projects/${projectId}`;
    const token = localStorage.getItem('auth_token');
    const tokenType = localStorage.getItem('token_type') || 'Bearer';

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token && { Authorization: `${tokenType} ${token}` }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const responseData = await response.json();
      return responseData;
    } catch (error) {
      throw error;
    }
  }

  async deleteProject(projectId: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response;
  }

  // Получить историю изменений номенклатуры в проекте
  async getNomenclatureChanges(projectId: number, nomenclatureId: number, page: number = 1, perPage: number = 100): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/changes?page=${page}&per_page=${perPage}&with[]=logs&with[]=logs.user`, {
      method: 'GET',
    });
    return response;
  }

  // Добавить изменение номенклатуры в проекте
  async addNomenclatureChange(projectId: number, nomenclatureId: number, amountChange: number): Promise<any> {
    const payload = { amount_change: amountChange };

    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/changes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return response;
  }

  // Удалить номенклатуру из проекта
  async removeNomenclature(projectId: number, nomenclatureId: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/remove`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response;
  }

  // Получить список номенклатуры
  async getNomenclature(): Promise<any> {
    const response = await this.request<any>('/nomenclature', {
      method: 'GET',
    });
    return response;
  }

  // Создать номенклатуру в общей номенклатуре
  async createNomenclature(data: { name: string; unit: string; price: number; description?: string }): Promise<any> {
    const response = await this.request<any>('/nomenclature', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        unit: data.unit,
        price: data.price,
        description: data.description || '',
      }),
    });
    return response;
  }

  // Добавить номенклатуру в проект
  async addNomenclatureToProject(projectId: number, nomenclatureId: number, startAmount: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ start_amount: startAmount }),
    });
    return response;
  }

  // Получить список фактических расходов номенклатуры в проекте
  async getNomenclatureFacts(projectId: number, nomenclatureId: number, options?: { page?: number; per_page?: number; with?: string[] }): Promise<any> {
    let url = `/projects/${projectId}/nomenclature/${nomenclatureId}/facts`;
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    if (options?.with && Array.isArray(options.with)) {
      options.with.forEach((item) => params.append('with[]', item));
    }
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    const response = await this.request<any>(url, {
      method: 'GET',
    });
    return response;
  }

  // Создать фактический расход номенклатуры в проекте
  async createNomenclatureFact(projectId: number, nomenclatureId: number, amount: number, factDate: string): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/facts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        fact_date: factDate,
      }),
    });
    return response;
  }

  // Редактировать фактический расход номенклатуры в проекте
  async updateNomenclatureFact(projectId: number, nomenclatureId: number, factId: number, amount: number, factDate: string): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/facts/${factId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        fact_date: factDate,
      }),
    });
    return response;
  }

  // Удалить фактический расход номенклатуры в проекте
  async deleteNomenclatureFact(projectId: number, nomenclatureId: number, factId: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/facts/${factId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response;
  }


  // Перенести проект в архив
  async archiveProject(projectId: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/archive`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response;
  }

  // Получить список рабочего графика сотрудника в проекте
  async getWorkReports(
    projectId: number,
    userId: number,
    options?: {
      page?: number;
      per_page?: number;
      with?: string[];
      filter?: { date_from?: string; date_to?: string };
    }
  ): Promise<any> {
    let url = `/projects/${projectId}/user/${userId}/work-reports`;
    const params = new URLSearchParams();
    
    if (options?.page) params.append('page', options.page.toString());
    if (options?.per_page) params.append('per_page', options.per_page.toString());
    if (options?.with) {
      options.with.forEach(w => params.append('with[]', w));
    }
    if (options?.filter) {
      if (options.filter.date_from) params.append('filter[date_from]', options.filter.date_from);
      if (options.filter.date_to) params.append('filter[date_to]', options.filter.date_to);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await this.request<any>(url, {
      method: 'GET',
    });
    return response;
  }

  // Добавить запись в график сотрудника
  async createWorkReport(
    projectId: number,
    userId: number,
    data: {
      report_date: string;
      hours_worked: number;
      absent: boolean;
      notes?: string;
    }
  ): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/user/${userId}/work-reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response;
  }

  // Изменить запись в графике сотрудника
  async updateWorkReport(
    projectId: number,
    userId: number,
    reportId: number,
    data: {
      hours_worked?: number;
      absent?: boolean;
      notes?: string;
    }
  ): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/user/${userId}/work-reports/${reportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response;
  }

  // Удалить запись из графика сотрудника
  async deleteWorkReport(projectId: number, userId: number, reportId: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/user/${userId}/work-reports/${reportId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response;
  }

  // Функция для форматирования ФИО в формате "Фамилия И. О."
  // Получить список выплат
  async getPayments(params?: {
    page?: number;
    per_page?: number;
    with?: string[];
    filter?: {
      users?: number[];
      date_from?: string;
      date_to?: string;
    };
  }): Promise<any> {
    let url = '/payments?';
    if (params?.page) url += `page=${params.page}&`;
    if (params?.per_page) url += `per_page=${params.per_page}&`;
    if (params?.with) {
      params.with.forEach((w) => {
        url += `with[]=${w}&`;
      });
    }
    if (params?.filter) {
      if (params.filter.users) {
        params.filter.users.forEach((userId) => {
          url += `filter[users][]=${userId}&`;
        });
      }
      if (params.filter.date_from) {
        url += `filter[date_from]=${params.filter.date_from}&`;
      }
      if (params.filter.date_to) {
        url += `filter[date_to]=${params.filter.date_to}&`;
      }
    }
    url = url.replace(/&$/, ''); // Убираем последний &
    
    const response = await this.request<any>(url, {
      method: 'GET',
    });
    return response;
  }

  // Создать выплату
  async createPayment(data: {
    user_id: number;
    first_payment_date?: string | null;
    first_payment_amount?: number | null;
    first_payment_type?: string | null;
    second_payment_date?: string | null;
    second_payment_amount?: number | null;
    second_payment_type?: string | null;
    third_payment_date?: string | null;
    third_payment_amount?: number | null;
    third_payment_type?: string | null;
    notes?: string | null;
  }): Promise<any> {
    const response = await this.request<any>('/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response;
  }

  // Редактировать выплату
  async updatePayment(paymentId: number, data: {
    user_id?: number;
    first_payment_date?: string | null;
    first_payment_amount?: number | null;
    first_payment_type?: string | null;
    second_payment_date?: string | null;
    second_payment_amount?: number | null;
    second_payment_type?: string | null;
    third_payment_date?: string | null;
    third_payment_amount?: number | null;
    third_payment_type?: string | null;
    notes?: string | null;
  }): Promise<any> {
    const response = await this.request<any>(`/payments/${paymentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response;
  }

  // Удалить выплату
  async deletePayment(paymentId: number): Promise<any> {
    const response = await this.request<any>(`/payments/${paymentId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });
    return response;
  }

  formatUserName(user: any): string {
    if (!user) return 'Пользователь';

    const { first_name, second_name, last_name } = user;

    // Формат: Фамилия И. О.
    const lastNameInitial = last_name ? last_name.charAt(0).toUpperCase() : '';
    const firstNameInitial = first_name ? first_name.charAt(0).toUpperCase() : '';
    const secondNameInitial = second_name ? second_name.charAt(0).toUpperCase() : '';

    if (lastNameInitial && firstNameInitial) {
      return `${last_name} ${firstNameInitial}.${secondNameInitial ? ` ${secondNameInitial}.` : ''}`;
    }

    return first_name || 'Пользователь';
  }

  // Получить отчёт по выплатам (может возвращать файл или JSON)
  async getPaymentsReport(params: {
    period: string; // Дата, месяц отчета
  }): Promise<Blob | any> {
    const url = `${this.baseURL}/reports/payments?period=${params.period}`;
    const token = localStorage.getItem('auth_token');
    const tokenType = localStorage.getItem('token_type') || 'Bearer';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token && { Authorization: `${tokenType} ${token}` }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      console.error('Response status:', response.status);
      
      // Если 401 - токен истек, разлогинить пользователя
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_type');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
      
      // Пытаемся извлечь сообщение об ошибке из HTML ответа
      let errorMessage = `Ошибка сервера (${response.status})`;
      if (errorText.includes('Permission denied') || errorText.includes('mkdir')) {
        errorMessage = 'Ошибка на сервере: недостаточно прав для создания файла отчёта. Обратитесь к администратору.';
      } else if (errorText.includes('<!DOCTYPE html>')) {
        // Это HTML страница с ошибкой Laravel
        errorMessage = 'Ошибка на сервере при генерации отчёта. Обратитесь к администратору.';
      }
      
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    
    // Если это файл (Excel, например)
    if (contentType && (
      contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      contentType.includes('application/vnd.ms-excel') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/xls')
    )) {
      return await response.blob();
    }
    
    // Если это JSON
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    // По умолчанию возвращаем как blob
    return await response.blob();
  }

  // Получить отчёт по номенклатуре проекта (может возвращать файл или JSON)
  async getProjectNomenclatureReport(
    projectId: number,
    params: {
      period_start: string;
      period_end: string;
    }
  ): Promise<Blob | any> {
    const url = `${this.baseURL}/projects/${projectId}/reports/nomenclature?period_start=${params.period_start}&period_end=${params.period_end}`;
    const token = localStorage.getItem('auth_token');
    const tokenType = localStorage.getItem('token_type') || 'Bearer';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token && { Authorization: `${tokenType} ${token}` }),
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error response:', errorText);
      console.error('Response status:', response.status);
      
      // Если 401 - токен истек, разлогинить пользователя
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_type');
        localStorage.removeItem('user');
        window.location.href = '/';
      }
      
      // Пытаемся извлечь сообщение об ошибке из HTML ответа
      let errorMessage = `Ошибка сервера (${response.status})`;
      if (errorText.includes('Permission denied') || errorText.includes('mkdir')) {
        errorMessage = 'Ошибка на сервере: недостаточно прав для создания файла отчёта. Обратитесь к администратору.';
      } else if (errorText.includes('<!DOCTYPE html>')) {
        // Это HTML страница с ошибкой Laravel
        errorMessage = 'Ошибка на сервере при генерации отчёта. Обратитесь к администратору.';
      }
      
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    
    // Если это файл (Excel, например)
    if (contentType && (
      contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      contentType.includes('application/vnd.ms-excel') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/xls')
    )) {
      return await response.blob();
    }
    
    // Если это JSON
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    // По умолчанию возвращаем как blob
    return await response.blob();
  }
}

export const apiService = new ApiService(API_BASE_URL);
export type { LoginRequest, LoginResponse, ApiResponse };
