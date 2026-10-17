export type View = 'home' | 'work' | 'connect' | 'sources' | 'new' | 'study';
const views: View[] = ['home', 'work', 'connect', 'sources', 'new', 'study'];
export function workspaceRoute(hash: string): { view: View; assignmentId: string | null } {
  const [view, id] = hash.replace(/^#/, '').split('/');
  return {
    view: views.includes(view as View) ? view as View : 'home',
    assignmentId: view === 'work' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '') ? id : null,
  };
}
export const assignmentStarter = (id: string, title: string) => `Help me with the question open in SuperTutor: "${title}" (assignment ${id}). Use the SuperTutor connector to read its prompt and my saved draft. Give me one hint at a time, without writing the finished answer.`;
