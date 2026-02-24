#!/usr/bin/env node
/**
 * Тест API фактов номенклатуры: создание и получение.
 * Запуск: node scripts/test-nomenclature-facts.js <email> <password> [project_id] [nomenclature_id]
 */

const API_BASE = process.env.VITE_API_BASE_URL || 'http://92.53.97.20/api';
const today = new Date();
const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

async function main() {
  const [email, password, projectId, nomenclatureId] = process.argv.slice(2);

  if (!email || !password) {
    console.log('Использование: node scripts/test-nomenclature-facts.js <email> <password> [project_id] [nomenclature_id]');
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
    console.error('Ошибка входа:', loginData);
    process.exit(1);
  }
  console.log('Пользователь:', user?.id, user?.last_name, user?.role);

  const auth = { Authorization: `Bearer ${token}` };

  // Получаем проект и номенклатуру если не переданы
  let pid = projectId ? parseInt(projectId, 10) : null;
  let nid = nomenclatureId ? parseInt(nomenclatureId, 10) : null;

  if (!pid || !nid) {
    console.log('\n=== 2. Получение проектов ===');
    const projectsRes = await fetch(`${API_BASE}/projects?per_page=5`, { headers: auth });
    const projectsData = await projectsRes.json();
    const projects = projectsData?.data?.data ?? projectsData?.data ?? projectsData;
    const projList = Array.isArray(projects) ? projects : [];
    if (projList.length === 0) {
      console.error('Нет проектов');
      process.exit(1);
    }
    const project = projList[0];
    pid = project.id;
    console.log('Проект:', pid, project.name);
    const nom = project?.nomenclature ?? project?.nomenclature_items ?? [];
    const nomList = Array.isArray(nom) ? nom : [];
    if (nomList.length === 0) {
      console.error('В проекте нет номенклатуры');
      process.exit(1);
    }
    const firstNom = nomList[0];
    nid = firstNom?.id ?? firstNom?.nomenclature_id ?? firstNom?.nomenclature?.id;
    console.log('Номенклатура:', nid, firstNom?.name ?? firstNom?.nomenclature?.name);
  }

  console.log('\n=== 3. GET facts до создания ===');
  const getUrl = `${API_BASE}/projects/${pid}/nomenclature/${nid}/facts?per_page=100`;
  const factsBeforeRes = await fetch(getUrl, { headers: auth });
  const factsBeforeData = await factsBeforeRes.json();
  console.log('Статус:', factsBeforeRes.status);
  console.log('Структура ответа:', JSON.stringify(factsBeforeData, null, 2).slice(0, 1500));

  console.log('\n=== 4. POST создание факта ===');
  const createBody = { fact_date: todayLocal, amount: 99 };
  const createRes = await fetch(`${API_BASE}/projects/${pid}/nomenclature/${nid}/facts`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(createBody),
  });
  const createData = await createRes.json();
  console.log('Статус:', createRes.status);
  console.log('Ответ создания:', JSON.stringify(createData, null, 2));

  console.log('\n=== 5. GET facts после создания ===');
  const factsAfterRes = await fetch(getUrl, { headers: auth });
  const factsAfterData = await factsAfterRes.json();
  console.log('Статус:', factsAfterRes.status);
  console.log('Полный ответ:', JSON.stringify(factsAfterData, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
