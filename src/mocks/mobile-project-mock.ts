/**
 * Тестовые данные для мобильной версии.
 * Используйте ?mock=1 в URL для просмотра без бэкенда.
 * Пример: http://localhost:5173/?mock=1
 */

const today = new Date().toISOString().slice(0, 10);

/** Тестовые рабочие для экрана «Добавьте сотрудников» */
const mockWorkers = [
  { id: 26, first_name: 'Иван', second_name: 'Петрович', last_name: 'Сидоров', busy: undefined as { foreman_name?: string } | undefined },
  { id: 27, first_name: 'Алексей', second_name: 'Сергеевич', last_name: 'Козлов', busy: undefined as { foreman_name?: string } | undefined },
  { id: 101, first_name: 'Александр', second_name: 'Андреевич', last_name: 'Боков', busy: undefined as { foreman_name?: string } | undefined },
  { id: 102, first_name: 'Руслан', second_name: 'Камиллович', last_name: 'Гильманов', busy: undefined as { foreman_name?: string } | undefined },
  { id: 103, first_name: 'Роман', second_name: 'Сергеевич', last_name: 'Дмитриев', busy: undefined as { foreman_name?: string } | undefined },
  { id: 104, first_name: 'Павел', second_name: 'Александрович', last_name: 'Елькин', busy: undefined as { foreman_name?: string } | undefined },
  { id: 105, first_name: 'Олег', second_name: 'Андреевич', last_name: 'Журавлев', busy: undefined as { foreman_name?: string } | undefined },
  { id: 106, first_name: 'Павел', second_name: 'Александрович', last_name: 'Зорин', busy: undefined as { foreman_name?: string } | undefined },
  { id: 107, first_name: 'Роман', second_name: 'Сергеевич', last_name: 'Кононов', busy: undefined as { foreman_name?: string } | undefined },
  { id: 108, first_name: 'Пётр', second_name: 'Петрович', last_name: 'Крабов', busy: undefined as { foreman_name?: string } | undefined },
  { id: 109, first_name: 'Алексей', second_name: 'Павлович', last_name: 'Лимонов', busy: undefined as { foreman_name?: string } | undefined },
  { id: 110, first_name: 'Руслан', second_name: 'Сергеевич', last_name: 'Ульданов', busy: undefined as { foreman_name?: string } | undefined },
  { id: 111, first_name: 'Владимир', second_name: 'Александрович', last_name: 'Федоров', busy: { foreman_name: 'Мунипов Р.К.' } },
  { id: 112, first_name: 'Александр', second_name: 'Олегович', last_name: 'Хлебников', busy: { foreman_name: 'Мунипов Р.К.' } },
  { id: 113, first_name: 'Андрей', second_name: 'Иванович', last_name: 'Цветков', busy: undefined as { foreman_name?: string } | undefined },
  { id: 114, first_name: 'Сергей', second_name: 'Михайлович', last_name: 'Чернов', busy: undefined as { foreman_name?: string } | undefined },
  { id: 115, first_name: 'Дмитрий', second_name: 'Николаевич', last_name: 'Шаров', busy: undefined as { foreman_name?: string } | undefined },
];

/** Назначенные на сегодня (текущим бригадиром) — для демо уже выбраны Козлов, Сидоров */
const mockAssignedToday = [
  { id: 27, first_name: 'Алексей', second_name: 'Сергеевич', last_name: 'Козлов' },
  { id: 26, first_name: 'Иван', second_name: 'Петрович', last_name: 'Сидоров' },
];

export const mockData = {
  project: {
    id: 1,
    name: 'Демо-проект (тестовые данные)',
    status: 'В работе',
    start_date: '2026-01-15',
    end_date: '2026-06-30',
    budget: 500000,
    address: 'Москва, ул. Строителей, д. 10',
    employees: [
      {
        id: 25,
        first_name: 'Бригадир',
        second_name: 'Тест',
        last_name: 'Новый',
        role: 'Бригадир',
        pivot: { start_working_date: '2026-01-15', end_working_date: null, rate_per_hour: 2000 },
      },
      {
        id: 26,
        first_name: 'Иван',
        second_name: 'Петрович',
        last_name: 'Сидоров',
        role: 'Бригадир',
        pivot: { start_working_date: '2026-02-01', end_working_date: null, rate_per_hour: 1800 },
      },
      {
        id: 27,
        first_name: 'Алексей',
        second_name: 'Сергеевич',
        last_name: 'Козлов',
        role: 'Рабочий',
        pivot: { start_working_date: '2026-01-20', end_working_date: null, rate_per_hour: 1200 },
      },
    ],
    nomenclature: [
      { id: 1, name: 'Кирпич', unit: 'Шт.', npp: 1, pivot: { start_amount: 1000, npp: 1 } },
      { id: 2, name: 'Цемент', unit: 'Мешок', npp: 2, pivot: { start_amount: 50, npp: 2 } },
      { id: 3, name: 'Песок', unit: 'м³', npp: 3, pivot: { start_amount: 20, npp: 3 } },
    ],
  },
  mockApiResponses: {
    getAssignments: { data: mockAssignedToday },
    getAssignmentsWorkers: { data: mockWorkers },
    getNomenclatureChanges: {
      '1': { data: [{ amount_change: 200, created_at: '2026-02-10' }] },
      '2': { data: [{ amount_change: 10, created_at: '2026-02-12' }] },
      '3': { data: [] },
    },
    getNomenclatureFacts: {
      '1': {
        data: [
          { id: 1, amount: 50, fact_date: today, user_id: 25, is_deleted: false },
          { id: 2, amount: 30, fact_date: today, user_id: 26, is_deleted: false },
          { id: 3, amount: 100, fact_date: '2026-02-15', user_id: 25, is_deleted: false },
        ],
      },
      '2': {
        data: [
          { id: 4, amount: 5, fact_date: today, user_id: 25, is_deleted: false },
          { id: 5, amount: 3, fact_date: today, user_id: 26, is_deleted: false },
        ],
      },
      '3': {
        data: [{ id: 6, amount: 2, fact_date: today, user_id: 25, is_deleted: false }],
      },
    },
  },
};
