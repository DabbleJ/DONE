import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BooleanSetting, DoneData, getTaskAssignees, Member, mergeStarterData, Project, starterData, Task } from '@/lib/done';
import { useSession } from './SessionContext';
import { useHousehold } from './HouseholdContext';

type DoneValue = {
  data: DoneData;
  toggleTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  addTask: (task: Task) => void;
  addTasks: (tasks: Task[]) => void;
  addMember: (member: Member) => void;
  updateMember: (id: string, updates: Partial<Omit<Member, 'id'>>) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
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
  const { household } = useHousehold();
  const storageKey = session ? `done-state-household-${household.id}` : 'done-state-demo';
  const [data, setData] = useState<DoneData>(() => readStoredData(storageKey));
  const [hydrated, setHydrated] = useState(!session);
  const dataRef = useRef(data);

  const applyRemoteData = (remote: DoneData) => {
    const next = mergeStarterData(remote);
    dataRef.current = next;
    setData(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  useEffect(() => {
    if (!session) {
      const next = readStoredData('done-state-demo');
      dataRef.current = next;
      setData(next);
      setHydrated(true);
      return;
    }

    let active = true;
    setHydrated(false);
    supabase.from('app_state').select('data').eq('household_id', household.id).single().then(({ data: row }) => {
      if (!active) return;
      const remote = row?.data as unknown as DoneData | undefined;
      if (remote && Array.isArray(remote.tasks)) applyRemoteData(remote);
      else {
        const next = readStoredData(storageKey);
        dataRef.current = next;
        setData(next);
      }
      setHydrated(true);
    });
    return () => { active = false; };
  }, [household.id, session, storageKey]);

  useEffect(() => {
    if (!session || !hydrated) return;
    const channel = supabase.channel(`household-state-${household.id}`).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'app_state', filter: `household_id=eq.${household.id}` },
      payload => {
        const remote = payload.new.data as DoneData | undefined;
        if (remote && Array.isArray(remote.tasks)) applyRemoteData(remote);
      },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [household.id, hydrated, session]);

  const update = (fn: (d: DoneData) => DoneData, persistRemote = true) => {
    const next = fn(dataRef.current);
    dataRef.current = next;
    setData(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    if (session && persistRemote) supabase.from('app_state').update({ data: JSON.parse(JSON.stringify(next)), updated_at: new Date().toISOString() }).eq('household_id', household.id).then();
  };
  const toggleTask = (id: string) => {
    const task = dataRef.current.tasks.find(item => item.id === id);
    if (!task) return;
    const completed = !task.completed;
    update(d => ({ ...d, tasks: d.tasks.map(item => item.id === id ? { ...item, completed } : item) }), !session);
    if (session) supabase.rpc('set_task_completion', { target_household_id: household.id, target_task_id: id, is_completed: completed }).then(async ({ error }) => {
      if (!error) return;
      const { data: row } = await supabase.from('app_state').select('data').eq('household_id', household.id).single();
      const remote = row?.data as unknown as DoneData | undefined;
      if (remote && Array.isArray(remote.tasks)) applyRemoteData(remote);
    });
  };
  const updateTask = (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    update(d => ({ ...d, tasks: d.tasks.map(task => task.id === id ? { ...task, ...updates } : task) }));
    if (session && updates.assignees) {
      void supabase.rpc('set_task_assignees', {
        target_household_id: household.id,
        target_task_id: id,
        target_assignees: updates.assignees,
      }).then(async ({ error }) => {
        if (!error) return;
        const { data: row } = await supabase.from('app_state').select('data').eq('household_id', household.id).single();
        const remote = row?.data as unknown as DoneData | undefined;
        if (remote && Array.isArray(remote.tasks)) applyRemoteData(remote);
      });
    }
  };
  const addTask = (task: Task) => update(d => ({ ...d, tasks: [{ ...task, order: 0 }, ...normalizeOrder(d.tasks).map(t => ({ ...t, order: (t.order ?? 0) + 1 }))] }));
  const addTasks = (tasks: Task[]) => update(d => {
    const existingIds = new Set(d.tasks.map(task => task.id));
    const incoming = tasks.filter(task => !existingIds.has(task.id)).map((task, index) => ({ ...task, order: index }));
    const shifted = normalizeOrder(d.tasks).map(task => ({ ...task, order: (task.order ?? 0) + incoming.length }));
    return { ...d, tasks: [...incoming, ...shifted] };
  });
  const addMember = (member: Member) => update(d => ({ ...d, members: [...d.members, member] }));
  const updateMember = async (id: string, updates: Partial<Omit<Member, 'id'>>) => {
    if (session) {
      const current = dataRef.current.members.find(member => member.id === id);
      if (!current) throw new Error('Household member not found.');
      const next = { ...current, ...updates };
      const { error } = await supabase.rpc('update_household_member', {
        target_household_id: household.id,
        target_member_id: id,
        display_name: next.name,
        preferred_pronouns: next.pronouns ?? null,
        personality_hints: next.personalityHints ?? null,
        avatar_data: next.avatar ?? null,
      });
      if (error) throw error;
    }
    update(d => ({ ...d, members: d.members.map(member => member.id === id ? { ...member, ...updates } : member) }), !session);
  };
  const removeMember = async (id: string) => {
    const member = dataRef.current.members.find(item => item.id === id);
    if (!member) throw new Error('Household member not found.');
    if (session) {
      const { error } = await supabase.rpc('remove_household_member', { target_household_id: household.id, target_member_id: id });
      if (error) throw error;
    }
    update(d => ({
      ...d,
      members: d.members.filter(item => item.id !== id),
      tasks: d.tasks.map(task => {
        const assignees = getTaskAssignees(task).filter(assignee => assignee !== id && assignee !== member.userId);
        return { ...task, assignees: assignees.length ? assignees : ['household'] };
      }),
    }), !session);
  };
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

  return <DoneContext.Provider value={{ data, toggleTask, updateTask, addTask, addTasks, addMember, updateMember, removeMember, createProject, updateProject, snoozeTask, moveTask, reorderTasks, toggleSetting, setTimezone }}>{children}</DoneContext.Provider>;
}

export const useDone = () => {
  const value = useContext(DoneContext);
  if (!value) throw new Error('DoneProvider missing');
  return value;
};
