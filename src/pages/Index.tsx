import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Bell, Check, ChevronRight, Clock3, Copy, FolderKanban, GripVertical, ListTodo, Loader2, LogOut, Mail, Menu, Mic, MoreHorizontal, Pencil, Plus, Search, Settings, SlidersHorizontal, Sparkles, Sun, Users, WandSparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { HomeControls } from '@/components/HomeControls';
import { NotionSettings } from '@/components/NotionSettings';
import { useDone } from '@/contexts/DoneContext';
import { useSession } from '@/contexts/SessionContext';
import { useHousehold } from '@/contexts/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { doneVoice, getTaskAssignees, Member, parseCapture, priorityEngine, Project, Task } from '@/lib/done';
import { DONE_APP_URL } from '@/lib/urls';

type View = 'now' | 'tasks' | 'projects' | 'household' | 'settings';
type TaskFilter = { type: 'category' | 'due'; value: string; label: string } | null;

const nav = [{ id: 'now', label: 'Now', icon: Sun }, { id: 'tasks', label: 'Everything', icon: ListTodo }, { id: 'projects', label: 'Projects', icon: FolderKanban }, { id: 'household', label: 'Us', icon: Users }, { id: 'settings', label: 'Settings', icon: Settings }] as const;
const timezones = [{ value: 'America/Los_Angeles', label: 'Pacific Time' }, { value: 'America/Denver', label: 'Mountain Time' }, { value: 'America/Chicago', label: 'Central Time' }, { value: 'America/New_York', label: 'Eastern Time' }, { value: 'Europe/London', label: 'London' }, { value: 'Europe/Berlin', label: 'Central Europe' }, { value: 'Asia/Dubai', label: 'Dubai' }, { value: 'Asia/Kolkata', label: 'India' }, { value: 'Asia/Tokyo', label: 'Tokyo' }, { value: 'Australia/Sydney', label: 'Sydney' }, { value: 'Pacific/Auckland', label: 'Auckland' }, { value: 'UTC', label: 'UTC' }];
const ordered = (tasks: Task[]) => [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const titleCase = (value?: string) => value ? value.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : 'Household';

function Wordmark() { return <div className="brand text-[27px]">DONE<span>.</span></div>; }
function zonedNow(timezone: string) {
  const date = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', hour12: false }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const hour = Number(get('hour'));
  const greeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
  return { label: `${get('weekday')} · ${get('month')} ${get('day')}`, greeting };
}

function AssigneePicker({ value, members, onChange }: { value: string[]; members: Member[]; onChange: (next: string[]) => void }) {
  const toggle = (id: string) => {
    if (id === 'household') return onChange(['household']);
    const people = value.filter(item => item !== 'household');
    const next = people.includes(id) ? people.filter(item => item !== id) : [...people, id];
    onChange(next.length ? next : ['household']);
  };
  const options = [{ id: 'household', name: 'Whole household', initial: 'H', color: '#39A852' }, ...members];
  return <div className="mt-2 flex flex-wrap gap-2">{options.map(option => {
    const selected = value.includes(option.id);
    return <button key={option.id} type="button" aria-pressed={selected} onClick={() => toggle(option.id)} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-bold transition ${selected ? 'border-primary bg-secondary text-primary' : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}><span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: option.color }}>{selected ? <Check size={12} strokeWidth={3}/> : option.initial}</span>{option.name}</button>;
  })}</div>;
}

function TaskRow({ task, onDone, onOpen, onSnooze, onMove, onReorder, onFilter, big = false }: { task: Task; onDone: () => void; onOpen?: () => void; onSnooze?: () => void; onMove?: (direction: 'up' | 'down') => void; onReorder?: (activeId: string, overId: string) => void; onFilter?: (filter: TaskFilter) => void; big?: boolean }) {
  const { data } = useDone();
  const category = data.categories.find(c => c.id === task.category);
  const assignees = getTaskAssignees(task).map(id => {
    const member = data.members.find(item => item.id === id);
    const name = member?.name ?? titleCase(id);
    return { id, name, initial: member?.initial ?? name.charAt(0), color: member?.color ?? '#39A852' };
  });
  const project = data.projects.find(p => p.id === task.project);
  const [dragging, setDragging] = useState(false);
  const priorityLabel = task.priority === 'high' ? 'Now' : task.priority === 'medium' ? 'Soon' : 'Whenever';

  const finishPointerDrag = (x: number, y: number) => {
    setDragging(false);
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-task-id]');
    const overId = target?.dataset.taskId;
    if (overId && overId !== task.id) onReorder?.(task.id, overId);
  };

  return <article data-task-id={task.id} draggable={Boolean(onReorder)} tabIndex={onOpen ? 0 : undefined} role={onOpen ? 'button' : undefined} onClick={event => { if (onOpen && !(event.target as HTMLElement).closest('button, a, input, select, textarea')) onOpen(); }} onKeyDown={event => { if (onOpen && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen(); } }} onDragStart={event => { setDragging(true); event.dataTransfer.setData('text/plain', task.id); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={event => { if (onReorder) event.preventDefault(); }} onDrop={event => { event.preventDefault(); setDragging(false); const activeId = event.dataTransfer.getData('text/plain'); if (activeId) onReorder?.(activeId, task.id); }} onDragEnd={() => setDragging(false)} className={`group flex items-start gap-2 transition ${onOpen ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : ''} ${dragging ? 'scale-[.99] opacity-60' : ''} ${big ? 'paper-card p-4 sm:p-5' : 'border-b py-4 last:border-0'}`}>
    <button aria-label={`Drag ${task.title}`} className="mt-0.5 touch-none rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing" onPointerDown={event => { if (!onReorder) return; event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }} onPointerUp={event => finishPointerDrag(event.clientX, event.clientY)}><GripVertical size={18} /></button>
    <button aria-label={`Complete ${task.title}`} onClick={onDone} className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border-2 border-foreground/25 transition hover:border-primary hover:bg-secondary ${big ? 'h-8 w-8' : 'h-7 w-7'}`}>{task.completed && <Check size={16} />}</button>
    <div className="min-w-0 flex-1"><h3 className={`${big ? 'text-[17px]' : 'text-[15px]'} font-bold leading-snug ${task.completed ? 'line-through opacity-45' : ''}`}>{task.title}</h3><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{task.due && <button onClick={() => onFilter?.({ type: 'due', value: task.due!, label: task.due! })} className={`rounded-full px-2.5 py-1 font-bold transition hover:-translate-y-0.5 ${task.due === 'Today' ? 'bg-[#f8ddd4] text-[#a64937]' : 'bg-muted'}`}>{task.due}</button>}{!task.due && task.priority && <span className={`rounded-full px-2.5 py-1 font-bold ${task.priority === 'high' ? 'bg-[#f8ddd4] text-[#a64937]' : task.priority === 'medium' ? 'bg-[#fff0d4] text-[#85611d]' : 'bg-muted'}`}>{priorityLabel}</span>}<button onClick={() => category && onFilter?.({ type: 'category', value: category.id, label: category.name })} className="rounded-full px-2.5 py-1 transition hover:-translate-y-0.5" style={{ backgroundColor: category?.color }}>{category?.name ?? 'Unsorted'}</button>{project && <span className="flex items-center gap-1 rounded-full bg-[#e8e1f3] px-2.5 py-1 font-bold text-[#624b82]"><FolderKanban size={12} />{project.name}</span>}<span className="flex items-center gap-1.5"><span className="flex -space-x-1">{assignees.map(assignee => <span key={assignee.id} className="h-4 w-4 rounded-full border border-card text-center text-[9px] font-bold leading-[14px] text-white" style={{ background: assignee.color }}>{assignee.initial}</span>)}</span>{assignees.map(assignee => assignee.name).join(', ')}</span></div></div>
    {onOpen && <button onClick={onOpen} className="mt-0.5 rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-primary sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Edit ${task.title}`}><Pencil size={16} /></button>}
    <div className="flex shrink-0 flex-col gap-1 opacity-80 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><button onClick={() => onMove?.('up')} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Move up"><ArrowUp size={14} /></button><button onClick={() => onMove?.('down')} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label="Move down"><ArrowDown size={14} /></button></div>
    {onSnooze && <button onClick={onSnooze} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Not now"><Clock3 size={17} /></button>}
  </article>;
}

function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data, updateTask } = useDone();
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? '');
  const [due, setDue] = useState(task.due ?? '');
  const [priority, setPriority] = useState<Task['priority'] | ''>(task.priority ?? '');
  const [category, setCategory] = useState(task.category);
  const [assignees, setAssignees] = useState(getTaskAssignees(task));
  const [project, setProject] = useState(task.project ?? '');

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    updateTask(task.id, {
      title: cleanTitle,
      note: note.trim() || undefined,
      due: due.trim() || undefined,
      priority: priority || undefined,
      category,
      assignees,
      project: project || undefined,
    });
    toast.success('Task updated.');
    onClose();
  };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] bg-card sm:max-w-xl"><DialogHeader><DialogTitle className="text-3xl">Edit task</DialogTitle><DialogDescription>Change the details, then save it back to your list.</DialogDescription></DialogHeader><div className="space-y-5 pt-2">
    <div><label htmlFor="edit-task-title" className="text-sm font-bold">Task</label><Input id="edit-task-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') save(); }} maxLength={140} className="mt-2 h-12 rounded-2xl bg-background px-4" /></div>
    <div><label htmlFor="edit-task-note" className="text-sm font-bold">Notes</label><textarea id="edit-task-note" value={note} onChange={event => setNote(event.target.value)} placeholder="Add anything useful…" maxLength={500} className="mt-2 min-h-24 w-full resize-none rounded-2xl border bg-background p-4 text-sm outline-none ring-primary focus:ring-2" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">When<Input value={due} onChange={event => setDue(event.target.value)} placeholder="Today, Friday, Aug 10…" maxLength={40} className="mt-2 h-11 rounded-xl bg-background" /></label><label className="text-sm font-bold">Priority<select value={priority} onChange={event => setPriority(event.target.value as Task['priority'] | '')} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-primary focus:ring-2"><option value="">No priority</option><option value="high">Now</option><option value="medium">Soon</option><option value="low">Whenever</option></select></label></div>
    <label className="block text-sm font-bold">Category<select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-primary focus:ring-2">{data.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div><p className="text-sm font-bold">Assigned to</p><p className="mt-1 text-xs text-muted-foreground">Choose any number of people, or the whole household.</p><AssigneePicker value={assignees} members={data.members} onChange={setAssignees}/></div>
    <label className="block text-sm font-bold">Project<select value={project} onChange={event => setProject(event.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-primary focus:ring-2"><option value="">No project</option>{data.projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="flex gap-3 pt-1"><Button variant="outline" onClick={onClose} className="h-12 flex-1 rounded-full font-bold">Cancel</Button><Button onClick={save} disabled={!title.trim()} className="h-12 flex-1 rounded-full font-bold">Save changes</Button></div>
  </div></DialogContent></Dialog>;
}

function Empty() { return <div className="py-14 text-center"><div className="relative mx-auto mb-5 h-32 w-48"><div className="absolute bottom-2 left-5 h-8 w-36 rounded-[50%] bg-[#ddefd8]" /><div className="absolute left-12 top-4 h-20 w-24 rotate-[-5deg] rounded-2xl border-2 border-foreground bg-card p-3"><Check className="mx-auto mt-3 text-primary" size={32} /></div><div className="absolute bottom-5 right-4 rotate-12 text-4xl">🕶️</div></div><h2 className="text-2xl">The coast is clear.</h2><p className="mx-auto mt-2 max-w-xs text-muted-foreground">{doneVoice.empty}</p></div>; }

function NowView({ complete, snooze, onFilter, onOpenTask }: { complete: (id: string) => void; snooze: (id: string) => void; onFilter: (filter: TaskFilter) => void; onOpenTask: (id: string) => void }) {
  const { data, moveTask, reorderTasks } = useDone();
  const [showRemaining, setShowRemaining] = useState(false);
  const now = zonedNow(data.settings.timezone ?? 'America/Los_Angeles');
  const big3 = priorityEngine(data.tasks);
  const remaining = ordered(data.tasks.filter(t => !t.completed && !big3.some(b => b.id === t.id)));
  const renderTask = (task: Task, big = false) => <TaskRow key={task.id} task={task} big={big} onDone={() => complete(task.id)} onOpen={() => onOpenTask(task.id)} onSnooze={big ? () => snooze(task.id) : undefined} onMove={direction => moveTask(task.id, direction)} onReorder={reorderTasks} onFilter={onFilter} />;
  return <div className="animate-in-soft"><div className="mb-7"><p className="eyebrow">{now.label}</p><h1 className="mt-2 text-4xl leading-none sm:text-5xl">{now.greeting}<br /><em>Here’s enough.</em></h1></div>
    <section><div className="mb-3 flex items-end justify-between"><div><p className="eyebrow text-primary">Your Big 3</p><p className="mt-1 text-sm text-muted-foreground">Drag to reorder, or use the arrows.</p></div><WandSparkles className="text-primary" size={21} /></div><div className="space-y-3">{big3.map((task, i) => <div key={task.id} style={{ animationDelay: `${i * 70}ms` }} className="animate-in-soft">{renderTask(task, true)}</div>)}</div></section>
    {big3.length === 0 ? <Empty /> : <section className="mt-8"><div className="mb-1 flex items-center justify-between"><p className="eyebrow">Waiting in the wings</p><button onClick={() => setShowRemaining(true)} className="rounded-full px-2 py-1 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground">{remaining.length} more</button></div>{remaining.slice(0, 3).map(t => renderTask(t))}</section>}
    <Dialog open={showRemaining} onOpenChange={setShowRemaining}><DialogContent className="max-h-[85vh] overflow-y-auto rounded-[2rem] bg-card sm:max-w-2xl"><DialogHeader><DialogTitle className="text-3xl">Everything waiting</DialogTitle><DialogDescription>Drag tasks here too—your order carries back to NOW.</DialogDescription></DialogHeader><div className="paper-card px-5">{remaining.length ? remaining.map(t => renderTask(t)) : <Empty />}</div></DialogContent></Dialog>
  </div>;
}

function TasksView({ complete, filter, onFilter, clearFilter, onOpenTask }: { complete: (id: string) => void; filter: TaskFilter; onFilter: (filter: TaskFilter) => void; clearFilter: () => void; onOpenTask: (id: string) => void }) {
  const { data, moveTask, reorderTasks } = useDone();
  const [query, setQuery] = useState('');
  const [triage, setTriage] = useState(false);
  const base = ordered(data.tasks).filter(t => !t.completed);
  const filtered = filter ? base.filter(t => filter.type === 'category' ? t.category === filter.value : t.due === filter.value) : base;
  const active = filtered.filter(t => t.title.toLowerCase().includes(query.toLowerCase()));
  const triageItems = active.filter(t => !t.due).slice(0, 3);
  return <div className="animate-in-soft"><div className="flex items-end justify-between"><div><p className="eyebrow">The whole lot</p><h1 className="mt-1 text-4xl">Everything</h1></div><Button onClick={() => setTriage(!triage)} variant="outline" className="rounded-full"><SlidersHorizontal size={16} className="mr-2" />Triage</Button></div>
    {filter && <div className="mt-5 flex items-center justify-between rounded-2xl bg-secondary p-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Filtered by</p><p className="font-bold">{filter.label}</p></div><button onClick={clearFilter} className="rounded-full p-2 hover:bg-background"><X size={18} /></button></div>}
    {triage && <div className="my-5 rounded-[1.75rem] bg-foreground p-5 text-background"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-[#9dddab]">Anti-overwhelm mode</p><h2 className="mt-1 text-2xl">Three loose ends. That’s all.</h2></div><button onClick={() => setTriage(false)}><X /></button></div><div className="mt-4 space-y-2">{triageItems.map(t => <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3"><button onClick={() => complete(t.id)} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/50"><Check size={14} /></button><span className="flex-1 text-sm font-bold">{t.title}</span><button className="text-xs text-white/70">Later</button></div>)}</div></div>}
    <div className="relative my-5"><Search className="absolute left-4 top-3.5 text-muted-foreground" size={19} /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find anything..." className="h-12 rounded-full bg-card pl-12" /></div><div className="paper-card px-5">{active.length ? active.map(t => <TaskRow key={t.id} task={t} onDone={() => complete(t.id)} onOpen={() => onOpenTask(t.id)} onMove={direction => moveTask(t.id, direction)} onReorder={reorderTasks} onFilter={onFilter} />) : <Empty />}</div>
    <div className="mt-7"><p className="eyebrow mb-3">By category</p><div className="grid grid-cols-2 gap-3">{data.categories.map(c => <button key={c.id} onClick={() => onFilter({ type: 'category', value: c.id, label: c.name })} className="rounded-3xl p-4 text-left transition hover:-translate-y-0.5" style={{ background: c.color }}><span className="font-bold">{c.name}</span><p className="mt-1 text-xs opacity-60">{c.owner ? `${c.owner} · ` : ''}{data.tasks.filter(t => t.category === c.id && !t.completed).length} open</p></button>)}</div></div>
  </div>;
}

const projectColors = ['#DDF0D9', '#F9DED7', '#DFE7F3', '#F5E9C8', '#E7DFF3'];
const projectEmojis = ['🎯', '🏡', '✈️', '🎉', '🌱'];

type DraftProjectTask = { id: string; title: string; assignees: string[] };

function ProjectActions({ onEdit }: { onEdit: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="Project options" className="rounded-full p-2 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"><MoreHorizontal /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-2xl p-2"><DropdownMenuItem onSelect={onEdit} className="cursor-pointer rounded-xl px-3 py-2 font-bold"><Pencil className="mr-2" size={16}/>Edit project</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function ProjectEditor({ project, onClose }: { project: Project; onClose: () => void }) {
  const { data, updateProject } = useDone();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [targetEndDate, setTargetEndDate] = useState(project.targetEndDate ?? '');
  const [emoji, setEmoji] = useState(project.emoji);
  const [color, setColor] = useState(project.color);

  const save = () => {
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    if (!cleanName || !cleanDescription || !targetEndDate) return;
    if (data.projects.some(item => item.id !== project.id && item.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`${cleanName} already exists.`);
      return;
    }
    updateProject(project.id, { name: cleanName, description: cleanDescription, targetEndDate, emoji, color });
    toast.success('Project updated.');
    onClose();
  };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] bg-card sm:max-w-xl"><DialogHeader><DialogTitle className="text-3xl">Edit project</DialogTitle><DialogDescription>Keep the outcome, finish line and look up to date.</DialogDescription></DialogHeader><div className="space-y-5 pt-2">
    <div><label htmlFor="edit-project-name" className="text-sm font-bold">Project name</label><Input id="edit-project-name" autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={80} className="mt-2 h-12 rounded-2xl bg-background px-4" /></div>
    <div><label htmlFor="edit-project-description" className="text-sm font-bold">Short description</label><textarea id="edit-project-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={220} className="mt-2 min-h-24 w-full resize-none rounded-2xl border bg-background p-4 text-sm outline-none ring-primary focus:ring-2" /></div>
    <div><label htmlFor="edit-project-date" className="text-sm font-bold">Target end date</label><Input id="edit-project-date" type="date" value={targetEndDate} onChange={event => setTargetEndDate(event.target.value)} className="mt-2 h-12 rounded-2xl bg-background px-4" /></div>
    <div><p className="text-sm font-bold">Project icon</p><div className="mt-2 flex flex-wrap gap-2">{projectEmojis.map(option => <button key={option} type="button" aria-pressed={emoji === option} onClick={() => setEmoji(option)} className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition ${emoji === option ? 'border-primary bg-secondary ring-2 ring-primary/20' : 'bg-background hover:border-primary/50'}`}>{option}</button>)}</div></div>
    <div><p className="text-sm font-bold">Project color</p><div className="mt-2 flex flex-wrap gap-3">{projectColors.map(option => <button key={option} type="button" aria-label={`Choose ${option}`} aria-pressed={color === option} onClick={() => setColor(option)} className={`flex h-10 w-10 items-center justify-center rounded-full transition ${color === option ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'hover:scale-105'}`} style={{ backgroundColor: option }}>{color === option && <Check size={17} strokeWidth={3}/>}</button>)}</div></div>
    <div className="flex gap-3"><Button variant="outline" onClick={onClose} className="h-12 flex-1 rounded-full font-bold">Cancel</Button><Button onClick={save} disabled={!name.trim() || !description.trim() || !targetEndDate} className="h-12 flex-1 rounded-full font-bold">Save project</Button></div>
  </div></DialogContent></Dialog>;
}

function AddProjectTask({ project, onClose }: { project: Project; onClose: () => void }) {
  const { data, addTask } = useDone();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Task['priority'] | ''>('');
  const [category, setCategory] = useState('home');
  const [assignees, setAssignees] = useState<string[]>(['household']);

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    addTask({ id: crypto.randomUUID(), title: cleanTitle, note: note.trim() || undefined, due: due.trim() || undefined, priority: priority || undefined, category, assignees, project: project.id, energy: 'focus', completed: false, createdAt: new Date().toISOString() });
    toast.success(`Task added to ${project.name}.`);
    onClose();
  };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] bg-card sm:max-w-xl"><DialogHeader><DialogTitle className="text-3xl">Add a project task</DialogTitle><DialogDescription>It will stay linked to {project.name} everywhere it appears.</DialogDescription></DialogHeader><div className="space-y-5 pt-2">
    <div><label htmlFor="new-project-task-title" className="text-sm font-bold">Task</label><Input id="new-project-task-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') save(); }} placeholder="What needs doing?" maxLength={140} className="mt-2 h-12 rounded-2xl bg-background px-4" /></div>
    <div><label htmlFor="new-project-task-note" className="text-sm font-bold">Notes</label><textarea id="new-project-task-note" value={note} onChange={event => setNote(event.target.value)} placeholder="Add anything useful…" maxLength={500} className="mt-2 min-h-24 w-full resize-none rounded-2xl border bg-background p-4 text-sm outline-none ring-primary focus:ring-2" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">When<Input value={due} onChange={event => setDue(event.target.value)} placeholder="Today, Friday, Aug 10…" maxLength={40} className="mt-2 h-11 rounded-xl bg-background" /></label><label className="text-sm font-bold">Priority<select value={priority} onChange={event => setPriority(event.target.value as Task['priority'] | '')} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-primary focus:ring-2"><option value="">No priority</option><option value="high">Now</option><option value="medium">Soon</option><option value="low">Whenever</option></select></label></div>
    <label className="block text-sm font-bold">Category<select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-primary focus:ring-2">{data.categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div><p className="text-sm font-bold">Assigned to</p><AssigneePicker value={assignees} members={data.members} onChange={setAssignees}/></div>
    <div className="flex gap-3"><Button variant="outline" onClick={onClose} className="h-12 flex-1 rounded-full font-bold">Cancel</Button><Button onClick={save} disabled={!title.trim()} className="h-12 flex-1 rounded-full font-bold">Add task</Button></div>
  </div></DialogContent></Dialog>;
}

function ProjectsView() {
  const { data, createProject, toggleTask } = useDone();
  const [creating, setCreating] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [addingTaskProjectId, setAddingTaskProjectId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [draftTasks, setDraftTasks] = useState<DraftProjectTask[]>([{ id: crypto.randomUUID(), title: '', assignees: ['household'] }]);
  const selectedProject = data.projects.find(project => project.id === selectedProjectId);
  const editingProject = data.projects.find(project => project.id === editingProjectId);
  const addingTaskProject = data.projects.find(project => project.id === addingTaskProjectId);
  const editingTask = data.tasks.find(task => task.id === editingTaskId);
  const selectedTasks = ordered(data.tasks.filter(task => task.project === selectedProjectId));

  const closeCreator = () => {
    setCreating(false);
    setName('');
    setDescription('');
    setTargetEndDate('');
    setDraftTasks([{ id: crypto.randomUUID(), title: '', assignees: ['household'] }]);
  };
  const submitProject = () => {
    const cleanName = name.trim();
    const cleanDescription = description.trim();
    if (!cleanName || !cleanDescription || !targetEndDate) return;
    if (data.projects.some(project => project.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`${cleanName} already exists.`);
      return;
    }
    const projectId = crypto.randomUUID();
    const tasks: Task[] = draftTasks.filter(task => task.title.trim()).map(task => ({
      id: crypto.randomUUID(),
      title: task.title.trim(),
      category: 'home',
      assignees: task.assignees,
      project: projectId,
      energy: 'focus',
      completed: false,
      createdAt: new Date().toISOString(),
    }));
    const visualIndex = data.projects.length % projectColors.length;
    createProject({ id: projectId, name: cleanName, description: cleanDescription, targetEndDate, emoji: projectEmojis[visualIndex], color: projectColors[visualIndex], completed: 0, total: tasks.length }, tasks);
    toast.success(`${cleanName} is ready to roll.`);
    closeCreator();
  };
  const formatDate = (date?: string) => date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`)) : 'No target date';

  return <div className="animate-in-soft"><p className="eyebrow">Keep the big stuff moving</p><h1 className="mt-1 text-4xl">Projects</h1>{data.projects.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2">{data.projects.map(project => {
    const linkedTasks = data.tasks.filter(task => task.project === project.id);
    const total = linkedTasks.length || project.total;
    const completed = linkedTasks.length ? linkedTasks.filter(task => task.completed).length : project.completed;
    const percent = total ? Math.round(completed / total * 100) : 0;
    return <article key={project.id} className="paper-card relative overflow-hidden transition hover:-translate-y-1"><button onClick={() => setSelectedProjectId(project.id)} className="w-full text-left"><div className="p-5" style={{ background: project.color }}><div className="text-3xl"><span>{project.emoji}</span></div><h2 className="mt-7 text-2xl leading-tight">{project.name}</h2>{project.description && <p className="mt-2 line-clamp-2 text-sm opacity-70">{project.description}</p>}</div><div className="p-5"><p className="mb-3 flex items-center gap-2 text-xs font-bold text-muted-foreground"><Clock3 size={14} />Target {formatDate(project.targetEndDate)}</p><div className="mb-2 flex justify-between text-xs font-bold"><span>{completed} of {total} done</span><span>{percent}%</span></div><Progress value={percent} className="h-2" /></div></button><div className="absolute right-3 top-3"><ProjectActions onEdit={() => setEditingProjectId(project.id)}/></div></article>;
  })}</div> : <div className="paper-card mt-6 p-8 text-center"><h2 className="text-2xl">No projects yet.</h2><p className="mt-2 text-muted-foreground">Start with an outcome, a finish line, and the people who can help.</p></div>}<button onClick={() => setCreating(true)} className="mt-4 flex min-h-28 w-full items-center justify-center rounded-[1.75rem] border-2 border-dashed text-muted-foreground transition hover:border-primary hover:text-primary"><Plus className="mr-2" />Start a project</button>

    <Dialog open={creating} onOpenChange={open => open ? setCreating(true) : closeCreator()}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] bg-card sm:max-w-2xl"><DialogHeader><DialogTitle className="text-3xl">Start something worth finishing</DialogTitle><DialogDescription>Define the outcome, pick a finish line, then share the work.</DialogDescription></DialogHeader><div className="space-y-5 pt-2"><div><label htmlFor="project-name" className="text-sm font-bold">Project name</label><Input id="project-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Refresh the kids’ room" maxLength={80} className="mt-2 h-12 rounded-2xl bg-background px-4" /></div><div><label htmlFor="project-description" className="text-sm font-bold">Short description</label><textarea id="project-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="What does done look like?" maxLength={220} className="mt-2 min-h-24 w-full resize-none rounded-2xl border bg-background p-4 text-sm outline-none ring-primary focus:ring-2" /></div><div><label htmlFor="project-date" className="text-sm font-bold">Target end date</label><Input id="project-date" type="date" value={targetEndDate} min={new Date().toISOString().slice(0, 10)} onChange={event => setTargetEndDate(event.target.value)} className="mt-2 h-12 rounded-2xl bg-background px-4" /></div><div><div className="flex items-center justify-between"><div><p className="text-sm font-bold">Related tasks</p><p className="text-xs text-muted-foreground">Each task will be tagged to this project.</p></div><button type="button" onClick={() => setDraftTasks(tasks => [...tasks, { id: crypto.randomUUID(), title: '', assignees: ['household'] }])} className="rounded-full bg-secondary px-3 py-2 text-xs font-bold text-primary"><Plus className="mr-1 inline" size={14} />Add task</button></div><div className="mt-3 space-y-3">{draftTasks.map((task, index) => <div key={task.id} className="rounded-2xl border bg-background p-3"><div className="flex gap-2"><Input value={task.title} onChange={event => setDraftTasks(tasks => tasks.map(item => item.id === task.id ? { ...item, title: event.target.value } : item))} placeholder={`Task ${index + 1}`} maxLength={100} className="h-11 rounded-xl" /><button type="button" onClick={() => setDraftTasks(tasks => tasks.filter(item => item.id !== task.id))} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remove task ${index + 1}`}><X size={18} /></button></div><div className="mt-3"><p className="text-xs font-bold text-muted-foreground">Assigned to</p><AssigneePicker value={task.assignees} members={data.members} onChange={assignees => setDraftTasks(tasks => tasks.map(item => item.id === task.id ? { ...item, assignees } : item))}/></div></div>)}</div></div><Button onClick={submitProject} disabled={!name.trim() || !description.trim() || !targetEndDate} className="h-12 w-full rounded-full text-base font-bold">Create project{draftTasks.filter(task => task.title.trim()).length ? ` with ${draftTasks.filter(task => task.title.trim()).length} tasks` : ''}</Button></div></DialogContent></Dialog>

    <Dialog open={Boolean(selectedProject)} onOpenChange={open => { if (!open) setSelectedProjectId(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] bg-card sm:max-w-2xl">{selectedProject && <><DialogHeader><div className="flex items-start justify-between pr-8"><div><div className="mb-2 text-4xl">{selectedProject.emoji}</div><DialogTitle className="text-3xl">{selectedProject.name}</DialogTitle></div><ProjectActions onEdit={() => setEditingProjectId(selectedProject.id)}/></div><DialogDescription className="text-base">{selectedProject.description || 'No description yet.'}</DialogDescription></DialogHeader><div className="flex items-center gap-2 rounded-2xl bg-secondary p-3 text-sm font-bold text-primary"><Clock3 size={17} />Target {formatDate(selectedProject.targetEndDate)}</div><div><div className="mb-3 flex items-center justify-between gap-3"><div><p className="eyebrow">Project tasks</p><span className="text-xs font-bold text-muted-foreground">{selectedTasks.filter(task => task.completed).length}/{selectedTasks.length} done</span></div><Button onClick={() => setAddingTaskProjectId(selectedProject.id)} className="h-10 rounded-full px-4 font-bold"><Plus className="mr-2" size={16}/>Add task</Button></div><div className="paper-card px-4">{selectedTasks.length ? selectedTasks.map(task => <TaskRow key={task.id} task={task} onDone={() => toggleTask(task.id)} onOpen={() => setEditingTaskId(task.id)} />) : <div className="py-8 text-center"><p className="text-sm text-muted-foreground">No tasks attached yet.</p><button onClick={() => setAddingTaskProjectId(selectedProject.id)} className="mt-3 rounded-full px-4 py-2 text-sm font-bold text-primary hover:bg-secondary">Add the first task</button></div>}</div></div></>}</DialogContent></Dialog>
    {editingProject && <ProjectEditor key={editingProject.id} project={editingProject} onClose={() => setEditingProjectId(null)}/>}
    {addingTaskProject && <AddProjectTask key={addingTaskProject.id} project={addingTaskProject} onClose={() => setAddingTaskProjectId(null)}/>}
    {editingTask && <TaskEditor key={editingTask.id} task={editingTask} onClose={() => setEditingTaskId(null)}/>}
  </div>;
}

const memberColors = ['#39A852', '#D86F56', '#5279B8', '#8A68B8', '#D09232', '#267F83'];

function HouseholdView() {
  const { data, addMember } = useDone();
  const { session, demo } = useSession();
  const { household } = useHousehold();
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState(memberColors[0]);
  const inviteLink = `${DONE_APP_URL}/join/${household.projectId}`;

  const closeCreator = () => {
    setCreating(false);
    setName('');
    setColor(memberColors[0]);
  };
  const closeInvite = () => {
    setInviting(false);
    setEmail('');
  };
  const createMember = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (data.members.some(member => member.name.toLowerCase() === cleanName.toLowerCase())) {
      toast.error(`${cleanName} is already in your household.`);
      return;
    }
    addMember({ id: crypto.randomUUID(), name: cleanName, initial: cleanName.charAt(0).toUpperCase(), color, managed: true });
    toast.success(`${cleanName} joined the home team.`);
    closeCreator();
  };
  const sendInvite = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || sendingInvite) return;
    if (!session || demo) {
      toast.error('Sign in to send an email invitation. You can still copy the invite link.');
      return;
    }
    if (cleanEmail === session.user.email?.toLowerCase()) {
      toast.error('That’s your email—invite someone else.');
      return;
    }

    setSendingInvite(true);
    const { data: response, error } = await supabase.functions.invoke('send-household-invite', {
      body: { email: cleanEmail, projectId: household.projectId },
    });
    setSendingInvite(false);
    if (error || response?.error) {
      toast.error(response?.error ?? 'The invitation could not be sent. Please try again.');
      return;
    }

    toast.success(`Invitation sent to ${cleanEmail}.`);
    closeInvite();
  };
  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast.success('Invite link copied.');
    } catch {
      toast.error('Could not copy automatically. Select and copy the link instead.');
    }
  };

  return <div className="animate-in-soft"><p className="eyebrow">The home team</p><h1 className="mt-1 text-4xl">Your people</h1><p className="mt-2 text-muted-foreground">Invite adults, or add kids and others who won’t need their own account.</p><div className="mt-6 space-y-3">{data.members.length ? data.members.map(m => <article key={m.id} className="paper-card flex items-center gap-4 p-4"><Avatar className="h-14 w-14 border-4 border-card"><AvatarFallback style={{ background: m.color }} className="text-lg font-bold text-white">{m.initial}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{m.name}</h3>{m.managed && <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">No account needed</span>}</div><p className="text-sm text-muted-foreground">{data.tasks.filter(t => getTaskAssignees(t).includes(m.id) && !t.completed).length} things on their plate</p></div><ChevronRight className="shrink-0 text-muted-foreground" /></article>) : <div className="paper-card p-8 text-center"><h2 className="text-2xl">No people added yet.</h2><p className="mt-2 text-muted-foreground">Build your home team by inviting someone or adding a managed family member.</p></div>}
    <button onClick={() => setCreating(true)} className="flex w-full items-center gap-4 rounded-[1.75rem] bg-secondary p-4 text-left text-foreground transition hover:-translate-y-0.5"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus /></span><span><span className="block font-bold">Create family member</span><span className="text-sm text-muted-foreground">For kids or anyone without an account</span></span></button>
    <button onClick={() => setInviting(true)} className="flex w-full items-center gap-4 rounded-[1.75rem] border-2 border-dashed p-4 text-left text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary hover:text-primary"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Mail /></span><span><span className="block font-bold">Invite someone</span><span className="text-sm font-normal">Send an email or share a link</span></span></button></div><HomeControls/>
    <Dialog open={creating} onOpenChange={open => open ? setCreating(true) : closeCreator()}><DialogContent className="rounded-[2rem] bg-card sm:max-w-md"><DialogHeader><DialogTitle className="text-3xl">Add to the home team</DialogTitle><DialogDescription>Create a family member you can assign tasks to. They won’t need to sign in.</DialogDescription></DialogHeader><div className="space-y-5 pt-2"><div><label htmlFor="member-name" className="text-sm font-bold">Name</label><Input id="member-name" autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') createMember(); }} placeholder="e.g. Milo" className="mt-2 h-12 rounded-2xl bg-background px-4" maxLength={60} /></div><div><p className="text-sm font-bold">Their color</p><div className="mt-3 flex flex-wrap gap-3">{memberColors.map(memberColor => <button key={memberColor} type="button" aria-label={`Choose ${memberColor}`} aria-pressed={color === memberColor} onClick={() => setColor(memberColor)} className={`flex h-10 w-10 items-center justify-center rounded-full transition ${color === memberColor ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'hover:scale-105'}`} style={{ backgroundColor: memberColor }}>{color === memberColor && <Check className="text-white" size={18} strokeWidth={3} />}</button>)}</div></div><Button onClick={createMember} disabled={!name.trim()} className="h-12 w-full rounded-full text-base font-bold">Create family member</Button></div></DialogContent></Dialog>
    <Dialog open={inviting} onOpenChange={open => open ? setInviting(true) : closeInvite()}><DialogContent className="rounded-[2rem] bg-card sm:max-w-md"><DialogHeader><div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary"><Mail size={25}/></div><DialogTitle className="text-3xl">Bring someone into DONE.</DialogTitle><DialogDescription>Email an invitation, or copy a link to share however you like.</DialogDescription></DialogHeader><div className="space-y-5 pt-2"><div><label htmlFor="invite-email" className="text-sm font-bold">Email address</label><Input id="invite-email" autoFocus type="email" inputMode="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') sendInvite(); }} placeholder="person@example.com" className="mt-2 h-12 rounded-2xl bg-background px-4" maxLength={254} /></div><Button onClick={sendInvite} disabled={!email.trim() || sendingInvite} className="h-12 w-full rounded-full text-base font-bold">{sendingInvite ? <><Loader2 className="mr-2 animate-spin" size={18}/>Sending…</> : <><Mail className="mr-2" size={18}/>Send email invitation</>}</Button><div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"><span className="h-px flex-1 bg-border"/>or share a link<span className="h-px flex-1 bg-border"/></div><div className="rounded-2xl border bg-background p-3"><p className="truncate text-sm text-muted-foreground">{inviteLink}</p><Button type="button" variant="outline" onClick={copyInviteLink} className="mt-3 h-11 w-full rounded-full font-bold"><Copy className="mr-2" size={17}/>Copy invite link</Button></div></div></DialogContent></Dialog>
  </div>;
}

function SettingsView() {
  const { data, toggleSetting, setTimezone } = useDone();
  const { session, demo, signOut } = useSession();
  const items = [['doneVoice', 'DONE. voice', 'Warm, occasional nudges'], ['quietHours', 'Quiet hours', 'No nudges after 8pm']] as const;
  return <div className="animate-in-soft"><p className="eyebrow">Make it yours</p><h1 className="mt-1 text-4xl">Settings</h1><div className="paper-card mt-6 px-5">{items.map(([key, label, desc]) => <div key={key} className="flex items-center gap-4 border-b py-5 last:border-0"><div className="flex-1"><p className="font-bold">{label}</p><p className="text-sm text-muted-foreground">{desc}</p></div><Switch checked={data.settings[key]} onCheckedChange={() => toggleSetting(key)} /></div>)}</div>
    <div className="paper-card mt-4 p-5"><label htmlFor="timezone" className="font-bold">Household time zone</label><p className="mt-1 text-sm text-muted-foreground">Controls the date and greeting shown on NOW.</p><select id="timezone" value={data.settings.timezone ?? 'America/Los_Angeles'} onChange={event => setTimezone(event.target.value)} className="mt-4 h-12 w-full rounded-2xl border bg-background px-4 text-sm font-bold outline-none ring-primary focus:ring-2">{timezones.map(timezone => <option key={timezone.value} value={timezone.value}>{timezone.label}</option>)}</select></div>
    <NotionSettings /><div className="paper-card mt-4 p-5"><p className="font-bold">Coming next</p><p className="mt-1 text-sm text-muted-foreground">Voice capture, AI sorting and family notifications are ready for a future phase.</p></div><button onClick={signOut} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border py-3 text-sm font-bold"><LogOut size={17} />{demo ? 'Leave demo' : `Sign out ${session?.user.email ?? ''}`}</button></div>;
}

function Capture({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) { const { addTask } = useDone(); const [text, setText] = useState(''); const submit = () => { if (!text.trim()) return; const parsed = parseCapture(text); addTask({ ...parsed, id: crypto.randomUUID(), completed: false, createdAt: new Date().toISOString() }); setText(''); onOpenChange(false); toast.success(doneVoice.capture); }; return <Drawer open={open} onOpenChange={onOpenChange}><DrawerContent className="mx-auto max-w-xl rounded-t-[2rem] bg-card"><DrawerHeader className="text-left"><DrawerTitle className="text-3xl">Drop it here.</DrawerTitle><DrawerDescription>Write it like you’d say it. We’ll sort the details.</DrawerDescription></DrawerHeader><div className="px-4 pb-8"><div className="rounded-[1.5rem] border-2 border-primary/30 bg-background p-3"><textarea autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} className="min-h-28 w-full resize-none bg-transparent p-2 text-lg outline-none" placeholder="e.g. Interview follow-up tomorrow for Jemal" /><div className="flex items-center justify-between"><button className="rounded-full p-3 text-primary"><Mic /></button><Button onClick={submit} className="rounded-full px-6 font-bold">Add it <ChevronRight className="ml-1" size={17} /></Button></div></div><p className="mt-3 text-center text-xs text-muted-foreground">Try a person, day or place — DONE. will catch it.</p></div></DrawerContent></Drawer>; }

export default function Index() {
  const [view, setView] = useState<View>('now');
  const [filter, setFilter] = useState<TaskFilter>(null);
  const [capture, setCapture] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const { data, toggleTask, snoozeTask } = useDone();
  const { household, households, switchHousehold } = useHousehold();
  const editingTask = data.tasks.find(task => task.id === editingTaskId);
  const openFilter = (next: TaskFilter) => { setFilter(next); setView('tasks'); };
  const complete = (id: string) => { const task = data.tasks.find(t => t.id === id); toggleTask(id); if (task && !task.completed) { const messages = doneVoice.celebrations; toast.success(data.settings.doneVoice ? messages[Math.floor(Math.random() * messages.length)].title : 'Done.'); if (data.settings.celebrations && data.tasks.filter(t => t.completed).length % 3 === 2) setCelebrate(true); } };
  const content = useMemo(() => view === 'now' ? <NowView complete={complete} snooze={snoozeTask} onFilter={openFilter} onOpenTask={setEditingTaskId} /> : view === 'tasks' ? <TasksView complete={complete} filter={filter} onFilter={openFilter} clearFilter={() => setFilter(null)} onOpenTask={setEditingTaskId} /> : view === 'projects' ? <ProjectsView /> : view === 'household' ? <HouseholdView /> : <SettingsView />, [view, data, filter]);
  return <div className="min-h-screen"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-card/95 p-7 lg:flex lg:flex-col"><Wordmark /><p className="mt-2 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Do · Organize · Now · Enjoy</p><nav className="mt-12 space-y-2">{nav.map(n => <button key={n.id} onClick={() => setView(n.id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${view === n.id ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted'}`}><n.icon size={19} />{n.label}</button>)}</nav><div className="mt-auto rounded-3xl bg-[#f8ddd4] p-4"><Sparkles size={20} className="text-[#bd5b47]" /><p className="mt-3 text-sm font-bold">Your household has finished {data.tasks.filter(t => t.completed).length} things.</p><p className="mt-1 text-xs text-muted-foreground">No streaks. No guilt. Just progress.</p></div></aside>
    <header className="sticky top-0 z-20 border-b bg-background/90 px-4 py-4 backdrop-blur lg:ml-64 lg:px-5"><div className="mx-auto flex max-w-3xl items-center justify-between gap-2"><div className="lg:hidden"><Wordmark /></div><DropdownMenu><DropdownMenuTrigger asChild><button className="flex min-w-0 max-w-[9rem] items-center gap-2 rounded-full border bg-card px-3 py-2 text-sm font-bold text-foreground transition hover:border-primary/40 lg:max-w-none lg:px-4"><span className="h-2 w-2 shrink-0 rounded-full bg-primary"/><span className="truncate">{household.name}</span><ChevronRight className="shrink-0 rotate-90 text-muted-foreground" size={15}/></button></DropdownMenuTrigger><DropdownMenuContent align="center" className="min-w-56 rounded-2xl p-2">{households.map(home => <DropdownMenuItem key={home.id} onSelect={() => { if (home.id !== household.id) switchHousehold(home.id).catch(() => toast.error('That home could not be opened.')); }} className={`cursor-pointer rounded-xl px-3 py-2.5 font-bold ${home.id === household.id ? 'bg-secondary text-primary' : ''}`}><span className="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">{home.name.charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1 truncate">{home.name}</span>{home.id === household.id && <Check size={16}/>}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu><div className="flex items-center gap-1 lg:gap-2"><button className="hidden rounded-full p-2.5 hover:bg-muted sm:block"><Bell size={20} /></button><button onClick={() => setView('household')} className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">D</button></div></div></header>
    <main className="px-5 pb-32 pt-7 lg:ml-64 lg:pb-16"><div className="mx-auto max-w-3xl">{content}</div></main><Button onClick={() => setCapture(true)} className="fixed bottom-[5.4rem] right-5 z-30 h-14 rounded-full px-5 text-base font-bold shadow-[0_12px_30px_rgba(57,168,82,.3)] lg:bottom-8 lg:right-8"><Plus className="mr-2" />Quick add</Button>
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-2 pt-2 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-lg items-center justify-around">{nav.slice(0, 4).map(n => <button key={n.id} onClick={() => setView(n.id)} className={`flex min-w-16 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-bold ${view === n.id ? 'text-primary' : 'text-muted-foreground'}`}><n.icon size={20} strokeWidth={view === n.id ? 2.7 : 2} />{n.label}</button>)}<button onClick={() => setView('settings')} className={`flex min-w-16 flex-col items-center gap-1 py-1.5 text-[10px] font-bold ${view === 'settings' ? 'text-primary' : 'text-muted-foreground'}`}><Menu size={20} />More</button></div></nav>
    <Capture open={capture} onOpenChange={setCapture} />{editingTask && <TaskEditor key={editingTask.id} task={editingTask} onClose={() => setEditingTaskId(null)} />}<Dialog open={celebrate} onOpenChange={setCelebrate}><DialogContent className="max-w-sm rounded-[2rem] bg-card text-center"><DialogHeader><div className="mx-auto flex h-28 w-28 rotate-[-5deg] items-center justify-center rounded-full bg-secondary"><Check className="pop text-primary" size={66} strokeWidth={3} /><span className="absolute translate-x-14 -translate-y-10 text-2xl">✦</span><span className="absolute -translate-x-14 translate-y-9 text-2xl">🍦</span></div><DialogTitle className="pt-3 text-center text-3xl">That was a big one.</DialogTitle><DialogDescription className="text-center text-base">Take the win. Maybe even the good biscuits.</DialogDescription></DialogHeader><Button onClick={() => setCelebrate(false)} className="mt-2 rounded-full">Lovely, thanks</Button></DialogContent></Dialog></div>;
}
