/**
 * Достаёт сущность проекта/пользователя из типичных обёрток Laravel/фронта:
 * { data: { id } }, { data: { data: { id } } }, { project: { id } }.
 */
export function unwrapCreatedProject(response: unknown): Record<string, unknown> | null {
  if (response == null || typeof response !== 'object') return null;
  const r = response as Record<string, unknown>;
  const pick = (obj: unknown): Record<string, unknown> | null => {
    if (obj == null || typeof obj !== 'object') return null;
    const o = obj as Record<string, unknown>;
    if (o.id != null) return o;
    return null;
  };
  return (
    pick(r) ??
    pick(r.data) ??
    pick((r.data as Record<string, unknown> | undefined)?.data) ??
    pick(r.project) ??
    null
  );
}
