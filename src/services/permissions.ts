/**
 * Модуль прав доступа по ролям (ПК-версия)
 *
 * ГИП: Проекты CRUD, Сотрудники CRUD, Отчёты R, Выдача ЗП CRUD
 *
 * Инженер ПТО:
 * - Проекты: CRU, общая информация R, спецификация/номенклатура/импорт CRUD
 * - Фиксация работ: R; Добавить/Удалить сотрудника: CR/RD
 * - Сотрудники: нет доступа (-)
 * - Отчёты: R (только отчёт по номенклатуре)
 * - Выдача ЗП: нет доступа
 *
 * Сметчик:
 * - Проекты: R, общая информация R, спецификация/номенклатура/импорт CRUD
 * - Фиксация работ: R; Добавить/Удалить сотрудника: нет доступа (-)
 * - Сотрудники: нет доступа (-)
 * - Отчёты: R (только отчёт по номенклатуре)
 * - Выдача ЗП: нет доступа
 *
 * Бухгалтер:
 * - Проекты: R, общая информация R, спецификация R
 * - Добавление/изменение номенклатуры, импорт: нет доступа (-)
 * - Фиксация работ: R; Добавить/Удалить сотрудника: нет доступа (-)
 * - Сотрудники: CRUD
 * - Отчёты: R
 * - Выдача ЗП: CRUD
 */

export const isGIP = (user: { role?: string; position?: string } | null): boolean => {
  if (!user) return false;
  const role = (user.role || user.position || '').toLowerCase();
  return role.includes('гип') || role === 'главный инженер проекта';
};

export const isBrigadier = (user: { role?: string; position?: string } | null): boolean => {
  if (!user) return false;
  return (user.role || user.position) === 'Бригадир';
};

export const isSystemAdmin = (user: { is_system_admin?: boolean } | null): boolean => {
  return user?.is_system_admin === true;
};

export const isBuhgalter = (user: { role?: string; position?: string } | null): boolean => {
  if (!user) return false;
  const role = (user.role || user.position || '').toLowerCase();
  return role.includes('бухгалтер') || role === 'бухгалтер';
};

export const isPTOEngineer = (user: { role?: string; position?: string } | null): boolean => {
  if (!user) return false;
  const role = (user.role || user.position || '').toLowerCase();
  return role.includes('инженер') && role.includes('пто');
};

export const isEstimator = (user: { role?: string; position?: string } | null): boolean => {
  if (!user) return false;
  const role = (user.role || user.position || '').toLowerCase();
  return role.includes('сметчик');
};

/** Можно редактировать сотрудников (ГИП, Бухгалтер, Админ) */
export const canEditEmployees = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user) || isBuhgalter(user);
};

/** Доступ к разделу «Сотрудники» (ГИП, Бухгалтер, Админ) */
export const canAccessEmployees = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user) || isBuhgalter(user);
};

/** Можно создавать проекты (ГИП, ПТО, Админ — не Сметчик, не Бухгалтер) */
export const canCreateProject = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user) || isPTOEngineer(user);
};

/** Можно удалять проект (ГИП, Админ — не Бухгалтер) */
export const canDeleteProject = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user);
};

/** Можно редактировать общую информацию проекта (адрес, сроки, бюджет) — ГИП, Админ */
export const canEditProjectGeneralInfo = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user);
};

/** Можно добавлять/удалять сотрудников в проекте (фиксация работ) — ГИП, ПТО, Админ */
export const canManageProjectEmployees = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user) || isPTOEngineer(user);
};

/** Можно редактировать спецификацию (добавить/изменить номенклатуру, импорт) — ГИП, ПТО, Сметчик, Админ */
export const canEditSpecification = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user) || isPTOEngineer(user) || isEstimator(user);
};

/** Доступ к разделу «Выдача ЗП» */
export const canAccessSalary = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user) || isBuhgalter(user);
};

/** Показывать отчёт по выплатам (ПТО и Сметчик видят только отчёт по номенклатуре) */
export const canSeePaymentsReport = (user: any): boolean => {
  if (!user) return false;
  return isSystemAdmin(user) || isGIP(user) || isBuhgalter(user);
};
