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
      
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
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

  async getProjects(page: number = 1, perPage: number = 11): Promise<any> {
    const response = await this.request<any>(`/projects?page=${page}&per_page=${perPage}`, {
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

  // Получить историю изменений номенклатуры в проекте
  async getNomenclatureChanges(projectId: number, nomenclatureId: number, page: number = 1, perPage: number = 100): Promise<any> {
    const response = await this.request<any>(`/projects/${projectId}/nomenclature/${nomenclatureId}/changes?page=${page}&per_page=${perPage}`, {
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

  // Функция для форматирования ФИО в формате "Фамилия И. О."
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
}

export const apiService = new ApiService(API_BASE_URL);
export type { LoginRequest, LoginResponse, ApiResponse };
