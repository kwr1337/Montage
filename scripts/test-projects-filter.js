#!/usr/bin/env node
/**
 * Проверяет, какой формат GET /projects возвращает проекты для бригадира.
 * Запуск: node scripts/test-projects-filter.js <email> <password>
 *
 * Пробует разные варианты:
 * - filter[project_managers][]=id
 * - filter[manager_id][]=id
 * - filter[manager_id]=id (старый формат через запятую)
 * - my=1
 * - без фильтра
 */

const API_BASE = process.env.VITE_API_BASE_URL || 'http://92.53.97.20/api';

async function request(path, headers = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...headers },
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

function extractProjects(res) {
  if (!res?.data) return [];
  const d = res.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.projects)) return d.projects;
  return [];
}

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.log('Использование: node scripts/test-projects-filter.js <email> <password>');
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
    console.error('Токен не получен');
    process.exit(1);
  }
  const userId = user?.id;
  const role = user?.role ?? user?.position;
  console.log('Роль:', role, '| ID:', userId);

  const auth = { Authorization: `Bearer ${token}` };

  const tests = [
    { name: 'filter[project_managers][]=id', path: `/projects?page=1&per_page=100&with[]=logs&filter[project_managers][]=${userId}` },
    { name: 'filter[manager_id][]=id', path: `/projects?page=1&per_page=100&with[]=logs&filter[manager_id][]=${userId}` },
    { name: 'filter[manager_id]=id', path: `/projects?page=1&per_page=100&with[]=logs&filter[manager_id]=${userId}` },
    { name: 'my=1', path: '/projects?page=1&per_page=100&with[]=logs&my=1' },
    { name: 'без фильтра', path: '/projects?page=1&per_page=100&with[]=logs' },
  ];

  console.log('\n=== 2. GET /projects (разные форматы) ===\n');
  for (const t of tests) {
    const res = await request(t.path, auth);
    const projects = extractProjects(res);
    const count = Array.isArray(projects) ? projects.length : 0;
    console.log(`${t.name}: ${res.status} → ${count} проектов`);
    if (count > 0 && projects[0]?.name) {
      console.log(`  Пример: #${projects[0].id} ${projects[0].name}`);
    }
  }

  console.log('\n=== 3. GET /auth/me ===');
  const meRes = await request('/auth/me', auth);
  const meData = meRes?.data?.data ?? meRes?.data ?? meRes;
  const meProjects = meData?.projects ?? meData?.user?.projects ?? [];
  console.log('Проектов в /me:', Array.isArray(meProjects) ? meProjects.length : '-');

  console.log('\n--- Готово ---');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
