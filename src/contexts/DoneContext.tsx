import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BooleanSetting, DoneData, Member, mergeStarterData, Project, starterData, Task } from '@/lib/done';
import { useSession } from './SessionContext';

type DoneValue = {
  data: DoneData;
  toggleTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  addTask: (task: Task) => void;
  addTasks: (tasks: Task[]) => void;
  addMember: (member: Member) => void;
  createProject: (project: Project, tasks: Task[]) => void;
  updateProject: (id: string, updates: Partial<Omit<Project, 'id'>>) => void;
  snoozeTask: (id: string) => void;
  moveTask: (id: string, direction: 'up' | 'down') => void;
  reorderTasks: (activeId: string, overId: string) => void;
  toggleSetting: (key: BooleanSetting) => void;
  setTimezone: (timezone: string) => void;
};

const DoneContext = createContext<DoneValue | null>(null);

const orderedTasks = (tasks: Task[]) => [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const normalizeOrder = (tasks: Task[]) => orderedTasks(tasks).map((task, index) => ({ ...task, order: index }));
const readStoredData = (key: string) => {
  const saved = localStorage.getItem(key);
  return saved ? mergeStarterData(JSON.parse(saved) as DoneData) : starterData;
};

export function DoneProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const storageKey = session ? `done-state-${session.user.id}` : 'done-state-demo';
  const [data, setData] = useState<DoneData>(() => readStoredData(storageKey));
  const [hydrated, setHydrated] = useState(!session);

  useEffect(() => {
    if (!session) {
      setData(readStoredData('done-state-demo'));
      setHydrated(true);
      return;
    }

    let active = true;
    setHydrated(false);
    supabase.from('app_state').select('data').eq('user_id', session.user.id).single().then(({ data: row }) => {
      if (!active) return;
      const remote = row?.data as unknown as DoneData | undefined;
      setData(remote && Array.isArray(remote.tasks) ? mergeStarterData(remote) : readStoredData(storageKey));
      setHydrated(true);
    });
    return () => { active = false; };
  }, [session, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(data));
    if (session) supabase.from('app_state').upsert({ user_id: session.user.id, data: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() }).then();
  }, [data, hydrated, session, storageKey]);

  const update = (fn: (d: DoneData) => DoneData) => setData(fn);
  const toggleTask = (id: string) => update(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) }));
  const updateTask = (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => update(d => ({ ...d, tasks: d.tasks.map(task => task.id === id ? { ...task, ...updates } : task) }));
  const addTask = (task: Task) => update(d => ({ ...d, tasks: [{ ...task, order: 0 }, ...normalizeOrder(d.tasks).map(t => ({ ...t, order: (t.order ?? 0) + 1 }))] }));
  const addTasks = (tasks: Task[]) => update(d => {
    const existingIds = new Set(d.tasks.map(task => task.id));
    const incoming = tasks.filter(task => !existingIds.has(task.id)).map((task, index) => ({ ...task, order: index }));
    const shifted = normalizeOrder(d.tasks).map(task => ({ ...task, order: (task.order ?? 0) + incoming.length }));
    return { ...d, tasks: [...incoming, ...shifted] };
  });
  const addMember = (member: Member) => update(d => ({ ...d, members: [...d.members, member] }));
  const createProject = (project: Project, tasks: Task[]) => update(d => {
    const incoming = tasks.map((task, order) => ({ ...task, order }));
    const shifted = normalizeOrder(d.tasks).map(task => ({ ...task, order: (task.order ?? 0) + incoming.length }));
    return { ...d, projects: [...d.projects, project], tasks: [...incoming, ...shifted] };
  });
  const updateProject = (id: string, updates: Partial<Omit<Project, 'id'>>) => update(d => ({ ...d, projects: d.projects.map(project => project.id === id ? { ...project, ...updates } : project) }));
  const snoozeTask = (id: string) => update(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, snoozed: true } : t) }));
  const moveTask = (id: string, direction: 'up' | 'down') => update(d => {
    const tasks = normalizeOrder(d.tasks);
    const index = tasks.findIndex(task => task.id === id);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= tasks.length) return d;
    const next = [...tasks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    return { ...d, tasks: next.map((task, order) => ({ ...task, order })) };
  });
  const reorderTasks = (activeId: string, overId: string) => update(d => {
    if (activeId === overId) return d;
    const tasks = normalizeOrder(d.tasks);
    const activeIndex = tasks.findIndex(task => task.id === activeId);
    const overIndex = tasks.findIndex(task => task.id === overId);
    if (activeIndex < 0 || overIndex < 0) return d;
    const [active] = tasks.splice(activeIndex, 1);
    tasks.splice(overIndex, 0, active);
    return { ...d, tasks: tasks.map((task, order) => ({ ...task, order })) };
  });
  const toggleSetting = (key: BooleanSetting) => update(d => ({ ...d, settings: { ...d.settings, [key]: !d.settings[key] } }));
  const setTimezone = (timezone: string) => update(d => ({ ...d, settings: { ...d.settings, timezone } }));

  return <DoneContext.Provider value={{ data, toggleTask, updateTask, addTask, addTasks, addMember, createProject, updateProject, snoozeTask, moveTask, reorderTasks, toggleSetting, setTimezone }}>{children}</DoneContext.Provider>;
}

export const useDone = () => {
  const value = useContext(DoneContext);
  if (!value) throw new Error('DoneProvider missing');
  return value;
};
