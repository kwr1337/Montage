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
  private _requestCache = new Map<string, { promise: Promise<any>; ts: number }>();
  private readonly CACHE_TTL = 10_000; // 10 секунд — дедупликация в рамках одной загрузки страницы
  /** Дольше кэшируем тяжёлые GET по номенклатуре (много параллельных строк спецификации) */
  private readonly CACHE_TTL_NOM = 60_000;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private _cacheTtlForKey(cacheKey: string): number {
    if (cacheKey.startsWith('nom-facts:') || cacheKey.startsWith('nom-changes:')) {
      return this.CACHE_TTL_NOM;
    }
    return this.CACHE_TTL;
  }

  private _cachedGet<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const ttl = this._cacheTtlForKey(cacheKey);
    const cached = this._requestCache.get(cacheKey);
    if (cached && (now - cached.ts) < ttl) {
      return cached.promise;
    }
    const promise = fetcher().catch(err => {
      this._requestCache.delete(cacheKey);
      throw err;
    });
    this._requestCache.set(cacheKey, { promise, ts: now });
    return promise;
  }

  invalidateCache(prefix?: string): void {
    if (!prefix) {
      this._requestCache.clear();
      return;
    }
    for (const key of this._requestCache.keys()) {
      if (key.startsWith(prefix)) this._requestCache.delete(key);
    }
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
    this.clearProfileCache();
    this.invalidateCache();
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getCurrentUser(): any | null {
    const user = localStorage.getItem('user');
    if (!user) return null;
    try {
      const parsed = JSON.parse(user);
      // Иногда в localStorage кладут ApiResponse/обёртки вида:
      // { success, data: user } или { success, data: { user } } или { success, data: { data: user } }
      const unwrap = (obj: any): any | null => {
        if (!obj || typeof obj !== 'object') return null;
        if (obj.id != null && (obj.role != null || obj.position != null || obj.email != null)) return obj;
        const d = obj.data;
        if (d && typeof d === 'object') {
          // data.user
          if (d.user && typeof d.user === 'object') return d.user;
          // data.data (иногда двойная обёртка)
          if (d.data && typeof d.data === 'object') {
            if (d.data.user && typeof d.data.user === 'object') return d.data.user;
            return d.data;
          }
          return d;
        }
        // user в корне
        if (obj.user && typeof obj.user === 'object') return obj.user;
        return null;
      };

      return unwrap(parsed) ?? parsed;
    } catch {
      return null;
    }
  }

  private _profileCache: { promise: Promise<any> | null; data: any | null } = { promise: null, data: null };

  async getCurrentUserProfile(): Promise<any> {
    if (this._profileCache.data) return this._profileCache.data;
    if (this._profileCache.promise) return this._profileCache.promise;

    this._profileCache.promise = this.request<any>('/auth/me', { method: 'GET' })
      .then(response => {
        const userData = response?.data ?? response;
        this._profileCache.data = response;
        if (userData && typeof userData === 'object') {
          localStorage.setItem('user', JSON.stringify(userData));
        }
        return response;
      })
      .catch(err => {
        this._profileCache.promise = null;
        throw err;
      });

    return this._profileCache.promise;
  }

  clearProfileCache(): void {
    this._profileCache = { promise: null, data: null };
  }

  async getProjects(
    page: number = 1,
    perPage: number = 11,
    options?: {
      with?: string[];
      noPagination?: boolean;
      filter?: { manager_id?: number[]; project_managers?: number[] };
      my?: boolean;
    }
  ): Promise<any> {
    const params = new URLSearchParams();
    if (!options?.noPagination) {
      params.set('page', String(page));
      params.set('per_page', String(perPage));
    }
    if (options?.with?.length) {
      options.with.forEach((rel) => params.append('with[]', rel));
    }
    if (options?.filter?.project_managers?.length) {
      options.filter.project_managers.forEach((id) => params.append('filter[project_managers][]', String(id)));
    }
    if (options?.filter?.manager_id?.length) {
      params.set('filter[manager_id]', options.filter.manager_id.join(','));
    }
    if (options?.my) {
      params.set('my', '1');
    }
    const query = params.toString();
    const url = `/projects${query ? `?${query}` : ''}`;
    return this._cachedGet(`projects:${query}`, () =>
      this.request<any>(url, { method: 'GET' })
    );
  }

  async getProjectById(projectId: number): Promise<any> {
    return this._cachedGet(`project:${projectId}`, () =>
      this.request<any>(`/projects/${projectId}?with[]=nomenclature&with[]=employees`, { method: 'GET' })
    );
  }

  async getUsers(): Promise<any> {
    return this._cachedGet('users', () =>
      this.request<any>('/users', { method: 'GET' })
    );
  }

  /** Назначения рабочих на день. Только свои (бригадир = авторизованный пользователь). project_id — фильтр по проекту */
  async getAssignments(assignmentDate: string, projectId?: number): Promise<any> {
    let url = `/assignments?assignment_date=${assignmentDate}`;
    if (projectId != null) url += `&project_id=${projectId}`;
    return this.request<any>(url, { method: 'GET' });
  }

  /** Все доступные рабочие с информацией о назначениях (assigned, brigadier_id, brigadier). Только assignment_date */
  async getAssignmentsWorkers(assignmentDate: string): Promise<any> {
    const url = `/assignments/workers?assignment_date=${assignmentDate}`;
    return this.request<any>(url, { method: 'GET' });
  }

  /** Добавить рабочего на день в конкретный проект. project_id обязателен — без него назначается на все проекты бригадира */
  async addAssignment(workerId: number, assignmentDate: string, projectId: number): Promise<any> {
    return this.request<any>('/assignments/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        worker_id: workerId,
        assignment_date: assignmentDate,
        project_id: projectId,
      }),
    });
  }

  /** Удалить назначение. id в URL — worker_id. Только бригадир, только своих сотрудников. Body: assignment_date */
  async deleteAssignment(workerId: number, assignmentDate: string): Promise<any> {
    return this.request<any>(`/assignments/delete/${workerId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ assignment_date: assignmentDate }),
    });
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
    const response = await this.request<any>('/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    this.invalidateCache('projects');
    return response;
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
      this.invalidateCache('project');
      this.invalidateCache('projects');
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
    this.invalidateCache('project');
    this.invalidateCache('projects');
    return response;
  }

  // Получить историю изменений номенклатуры в проекте
  async getNomenclatureChanges(projectId: number, nomenclatureId: number, page: number = 1, perPage: number = 100): Promise<any> {
    const url = `/projects/${projectId}/nomenclature/${nomenclatureId}/changes?page=${page}&per_page=${perPage}&with[]=logs&with[]=logs.user`;
    return this._cachedGet(`nom-changes:${projectId}:${nomenclatureId}:${page}:${perPage}`, () =>
      this.request<any>(url, { method: 'GET' })
    );
  }

  /** Все изменения номенклатуры проекта (одним запросом) */
  async getProjectNomenclatureChangesAll(projectId: number): Promise<any> {
    return this._cachedGet(`nom-changes:all:${projectId}`, () =>
      this.request<any>(`/projects/${projectId}/nomenclature/changes`, { method: 'GET' })
    );
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
    this.invalidateCache('nom-changes');
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
    this.invalidateCache('project');
    return response;
  }

  // Получить список номенклатуры
  async getNomenclature(): Promise<any> {
    return this._cachedGet('nomenclature', () =>
      this.request<any>('/nomenclature', { method: 'GET' })
    );
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
    this.invalidateCache('nomenclature');
    return response;
  }

  /** Обновить карточку номенклатуры (например ед. изм. после импорта с другой подписью в файле) */
  async updateNomenclature(
    id: number,
    data: { name?: string; unit?: string; price?: number; description?: string }
  ): Promise<any> {
    const response = await this.request<any>(`/nomenclature/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(data),
    });
    this.invalidateCache('nomenclature');
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
    this.invalidateCache('project');
    return response;
  }

  // Обновить start_amount (План) номенклатуры в проекте
  async updateProjectNomenclatureStartAmount(
    projectId: number,
    nomenclatureId: number,
    startAmount: number
  ): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ start_amount: startAmount }),
    });
    return response;
  }

  // Импорт номенклатуры из файла (Postman: Импорт из файла)
  async importNomenclatureFromFile(projectId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', 'import');
    formData.append('project_id', String(projectId));

    const token = localStorage.getItem('auth_token');
    const tokenType = localStorage.getItem('token_type') || 'Bearer';
    const url = `${this.baseURL}/nomenclature/import`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `${tokenType} ${token}` }),
        'Accept': 'application/json',
      },
      body: formData,
      redirect: 'manual', // не следовать редиректам — иначе страница может перезагрузиться
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Import failed: ${response.status} ${errorText}`);
    }
    const contentType = response.headers.get('content-type');
    this.invalidateCache('project');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return { data: null, success: true };
  }

  /** Все факты номенклатуры проекта (одним запросом) */
  async getProjectNomenclatureFactsAll(projectId: number): Promise<any> {
    return this._cachedGet(`nom-facts:all:${projectId}`, () =>
      this.request<any>(`/projects/${projectId}/nomenclature/facts`, { method: 'GET' })
    );
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
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return this._cachedGet(`nom-facts:${projectId}:${nomenclatureId}:${qs}`, () =>
      this.request<any>(url, { method: 'GET' })
    );
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
    this.invalidateCache('nom-facts');
    return response;
  }

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
    this.invalidateCache('nom-facts');
    return response;
  }

  async deleteNomenclatureFact(projectId: number, nomenclatureId: number, factId: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/facts/${factId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });
    this.invalidateCache('nom-facts');
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
    this.invalidateCache('project');
    this.invalidateCache('projects');
    return response;
  }

  async getProjectWorkReports(projectId: number, params?: { page?: number; per_page?: number }): Promise<any> {
    const search = new URLSearchParams();
    if (params?.page) search.append('page', String(params.page));
    if (params?.per_page) search.append('per_page', String(params.per_page));
    const qs = search.toString();
    const url = `/projects/${projectId}/work-reports${qs ? `?${qs}` : ''}`;
    return this._cachedGet(`project-work-reports:${projectId}:${qs}`, () =>
      this.request<any>(url, { method: 'GET' })
    );
  }

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
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return this._cachedGet(`work-reports:${projectId}:${userId}:${qs}`, () =>
      this.request<any>(url, { method: 'GET' })
    );
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
    this.invalidateCache('project-work-reports');
    this.invalidateCache('work-reports');
    return response;
  }

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
    this.invalidateCache('project-work-reports');
    this.invalidateCache('work-reports');
    return response;
  }

  async deleteWorkReport(projectId: number, userId: number, reportId: number): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/user/${userId}/work-reports/${reportId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });
    this.invalidateCache('project-work-reports');
    this.invalidateCache('work-reports');
    return response;
  }

  // Функция для форматирования ФИО в формате "Фамилия И. О."
  // Получить список выплат
  async getPayments(params?: {
    page?: number;
    per_page?: number;
    with?: string[];
    filter?: {
      project_id?: number | number[];
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
      if (params.filter.project_id !== undefined) {
        const ids = Array.isArray(params.filter.project_id) ? params.filter.project_id : [params.filter.project_id];
        ids.forEach((id) => {
          url += `filter[project_id][]=${id}&`;
        });
      }
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
    project_id?: number | null;
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
    project_id?: number | null;
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
