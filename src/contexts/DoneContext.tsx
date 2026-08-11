import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BooleanSetting, DoneData, mergeStarterData, starterData, Task } from '@/lib/done';
import { useSession } from './SessionContext';

type DoneValue = {
  data: DoneData;
  toggleTask: (id: string) => void;
  addTask: (task: Task) => void;
  addTasks: (tasks: Task[]) => void;
  snoozeTask: (id: string) => void;
  moveTask: (id: string, direction: 'up' | 'down') => void;
  reorderTasks: (activeId: string, overId: string) => void;
  toggleSetting: (key: BooleanSetting) => void;
  setTimezone: (timezone: string) => void;
};

const DoneContext = createContext<DoneValue | null>(null);

const orderedTasks = (tasks: Task[]) => [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const normalizeOrder = (tasks: Task[]) => orderedTasks(tasks).map((task, index) => ({ ...task, order: index }));

export function DoneProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const [data, setData] = useState<DoneData>(() => {
    const saved = localStorage.getItem('done-state');
    return saved ? mergeStarterData(JSON.parse(saved) as DoneData) : starterData;
  });

  useEffect(() => { setData(current => mergeStarterData(current)); }, []);
  useEffect(() => {
    if (!session) return;
    supabase.from('app_state').select('data').eq('user_id', session.user.id).single().then(({ data: row }) => {
      if (row?.data && Array.isArray((row.data as unknown as DoneData).tasks)) setData(mergeStarterData(row.data as unknown as DoneData));
    });
  }, [session]);
  useEffect(() => {
    localStorage.setItem('done-state', JSON.stringify(data));
    if (session) supabase.from('app_state').upsert({ user_id: session.user.id, data: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() }).then();
  }, [data, session]);

  const update = (fn: (d: DoneData) => DoneData) => setData(fn);
  const toggleTask = (id: string) => update(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) }));
  const addTask = (task: Task) => update(d => ({ ...d, tasks: [{ ...task, order: 0 }, ...normalizeOrder(d.tasks).map(t => ({ ...t, order: (t.order ?? 0) + 1 }))] }));
  const addTasks = (tasks: Task[]) => update(d => {
    const existingIds = new Set(d.tasks.map(task => task.id));
    const incoming = tasks.filter(task => !existingIds.has(task.id)).map((task, index) => ({ ...task, order: index }));
    const shifted = normalizeOrder(d.tasks).map(task => ({ ...task, order: (task.order ?? 0) + incoming.length }));
    return { ...d, tasks: [...incoming, ...shifted] };
  });
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

  return <DoneContext.Provider value={{ data, toggleTask, addTask, addTasks, snoozeTask, moveTask, reorderTasks, toggleSetting, setTimezone }}>{children}</DoneContext.Provider>;
}

export const useDone = () => {
  const value = useContext(DoneContext);
  if (!value) throw new Error('DoneProvider missing');
  return value;
};
