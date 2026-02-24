#!/usr/bin/env node
/**
 * Проверяет структуру ответов /assignments и /assignments/workers
 * для отладки busy-статуса (занятость другим бригадиром).
 *
 * Запуск: node scripts/test-assignments-workers.js <email> <password> [дата]
 * Пример: node scripts/test-assignments-workers.js brigadir2@mail.ru 12345678 2026-02-24
 */

const API_BASE = process.env.VITE_API_BASE_URL || 'http://92.53.97.20/api';
const today = new Date().toISOString().slice(0, 10);

async function request(path, headers = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...headers },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const [email, password, dateArg] = process.argv.slice(2);
  const assignmentDate = dateArg || today;

  if (!email || !password) {
    console.log('Использование: node scripts/test-assignments-workers.js <email> <password> [дата]');
    console.log('Пример: node scripts/test-assignments-workers.js brigadir2@mail.ru 12345678', assignmentDate);
    process.exit(1);
  }

  console.log('=== 1. Авторизация ===');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  const token = loginData?.data?.token ?? loginData?.token;
  const user = loginData?.data?.user ?? loginData?.user;
  if (!token) {
    console.error('Ошибка входа');
    process.exit(1);
  }
  console.log('Пользователь:', user?.id, user?.last_name, user?.role);

  const auth = { Authorization: `Bearer ${token}` };

  console.log('\n=== 2. GET /assignments?assignment_date=' + assignmentDate + ' ===');
  const assignRes = await request(`/assignments?assignment_date=${assignmentDate}`, auth);
  console.log('Статус:', assignRes.status);
  console.log('Ответ (первые 2000 символов):', JSON.stringify(assignRes.data).slice(0, 2000));

  console.log('\n=== 3. GET /assignments?assignment_date=...&all=1 ===');
  const assignAllRes = await request(`/assignments?assignment_date=${assignmentDate}&all=1`, auth);
  console.log('Статус:', assignAllRes.status);
  const assignAll = assignAllRes.data?.data ?? assignAllRes.data;
  console.log('Всего назначений:', Array.isArray(assignAll) ? assignAll.length : '-');
  if (Array.isArray(assignAll) && assignAll.length > 0) {
    console.log('Пример:', JSON.stringify(assignAll[0], null, 2).slice(0, 800));
  }

  console.log('\n=== 4. GET /assignments/workers?assignment_date=' + assignmentDate + ' ===');
  const workersRes = await request(`/assignments/workers?assignment_date=${assignmentDate}`, auth);
  console.log('Статус:', workersRes.status);
  const workersData = workersRes.data?.data ?? workersRes.data?.workers ?? workersRes.data;
  console.log('Структура:', Array.isArray(workersData) ? `массив, ${workersData.length} элементов` : typeof workersData);
  if (Array.isArray(workersData) && workersData.length > 0) {
    workersData.forEach((w, i) => {
      console.log('\n--- Worker', i + 1, 'id=', w.id, '---');
      console.log(JSON.stringify(w, null, 2));
    });
  }

  console.log('\n--- Готово ---');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
