#!/usr/bin/env node
/**
 * Скрипт для тестирования API проектов (для бригадира).
 * Показывает, что именно возвращают /auth/me и /projects.
 *
 * Запуск: node scripts/test-api-projects.js <email> <password>
 * Пример: node scripts/test-api-projects.js brigadir@mail.com 12345678
 *
 * Запустите с учётными данными бригадира и пришлите вывод — по нему
 * можно понять, где лежат проекты и как их правильно извлечь.
 */

const API_BASE = process.env.VITE_API_BASE_URL || 'http://92.53.97.20/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.log('Использование: node scripts/test-api-projects.js <email> <password>');
    console.log('Пример: node scripts/test-api-projects.js brigadir@mail.com 12345678');
    process.exit(1);
  }

  console.log('=== 1. Авторизация ===');
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) {
    console.error('Ошибка входа:', loginRes.status, loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data?.data?.token ?? loginRes.data?.token;
  const user = loginRes.data?.data?.user ?? loginRes.data?.user;
  if (!token) {
    console.error('Токен не получен. Ответ:', JSON.stringify(loginRes.data, null, 2));
    process.exit(1);
  }
  console.log('Роль пользователя:', user?.role ?? 'не указана');
  console.log('ID пользователя:', user?.id);

  const authHeader = { Authorization: `Bearer ${token}` };

  console.log('\n=== 2. GET /auth/me ===');
  const meRes = await request('/auth/me', { headers: authHeader });
  console.log('Статус:', meRes.status);
  console.log('Ответ:', JSON.stringify(meRes.data, null, 2));
  if (meRes.data?.data?.projects || meRes.data?.projects) {
    const projects = meRes.data?.data?.projects ?? meRes.data?.projects;
    console.log('Проекты в /me:', Array.isArray(projects) ? projects.length : 'не массив');
  }

  console.log('\n=== 3. GET /projects?with[]=logs ===');
  const proj1 = await request('/projects?with[]=logs', { headers: authHeader });
  console.log('Статус:', proj1.status);
  const arr1 = proj1.data?.data ?? proj1.data;
  console.log('Проектов:', Array.isArray(arr1) ? arr1.length : typeof arr1);
  if (Array.isArray(arr1) && arr1.length > 0) {
    console.log('Первый проект:', JSON.stringify(arr1[0], null, 2).slice(0, 500) + '...');
  } else {
    console.log('Полный ответ:', JSON.stringify(proj1.data, null, 2).slice(0, 800));
  }

  console.log('\n=== 4. GET /projects?page=1&per_page=100 ===');
  const proj2 = await request('/projects?page=1&per_page=100', { headers: authHeader });
  console.log('Статус:', proj2.status);
  const arr2 = proj2.data?.data ?? proj2.data;
  console.log('Проектов:', Array.isArray(arr2) ? arr2.length : typeof arr2);
  if (!Array.isArray(arr2) && proj2.data) {
    console.log('Структура ответа:', Object.keys(proj2.data));
  }

  console.log('\n=== 5. GET /projects?with[]=employees&with[]=logs ===');
  const proj3 = await request('/projects?page=1&per_page=100&with[]=employees&with[]=logs', { headers: authHeader });
  console.log('Статус:', proj3.status);
  const arr3 = proj3.data?.data ?? proj3.data;
  console.log('Проектов:', Array.isArray(arr3) ? arr3.length : typeof arr3);

  console.log('\n=== 6. GET /assignments (для бригадира) ===');
  const today = new Date().toISOString().slice(0, 10);
  const assignRes = await request(`/assignments?assignment_date=${today}`, { headers: authHeader });
  console.log('Статус:', assignRes.status);
  console.log('Ответ (первые 600 символов):', JSON.stringify(assignRes.data).slice(0, 600));

  console.log('\n=== 7. Проверка: может /projects ожидает role в query? ===');
  const projRole = await request('/projects?role=Бригадир', { headers: authHeader });
  console.log('Статус:', projRole.status, 'Проектов:', Array.isArray(projRole.data?.data ?? projRole.data) ? (projRole.data?.data ?? projRole.data).length : '-');

  const projMy = await request('/projects?my=1', { headers: authHeader });
  console.log('/projects?my=1:', projMy.status, 'Проектов:', Array.isArray(projMy.data?.data ?? projMy.data) ? (projMy.data?.data ?? projMy.data).length : '-');

  console.log('\n--- Готово ---');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
