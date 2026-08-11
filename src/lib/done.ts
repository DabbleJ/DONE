export type Member = { id: string; name: string; initial: string; color: string };
export type Category = { id: string; name: string; color: string; owner?: string };
export type Project = { id: string; name: string; emoji: string; color: string; completed: number; total: number };
export type Task = { id: string; title: string; note?: string; due?: string; category: string; assignee: string; project?: string; energy: 'quick' | 'focus' | 'errand'; priority?: 'low' | 'medium' | 'high'; order?: number; completed: boolean; createdAt: string; snoozed?: boolean };
export type DoneData = { tasks: Task[]; projects: Project[]; members: Member[]; categories: Category[]; settings: { doneVoice: boolean; celebrations: boolean; quietHours: boolean } };
export const starterData: DoneData = {
  members: [],
  categories: [
    { id: 'home', name: 'Home', color: '#DDF0D9' },
    { id: 'family', name: 'Family', color: '#F9DED7' },
    { id: 'admin', name: 'Life admin', color: '#DFE7F3' },
    { id: 'errands', name: 'Errands', color: '#F5E9C8' },
    { id: 'job-search', name: 'Job Search', owner: 'Jemal', color: '#DCE9F7' },
    { id: 'global-resilience', name: 'Global Resilience', owner: 'Heather', color: '#E7DFF3' },
  ],
  projects: [],
  tasks: [],
  settings: { doneVoice: true, celebrations: true, quietHours: true },
};

const legacySampleTasks = new Map([
  ['1', 'Book dentist appointments'],
  ['2', 'Send passport photos'],
  ['3', 'Order new cabinet hinge'],
  ['4', "Pick up Nana's birthday gift"],
  ['5', 'Refill dog food'],
]);
const legacyMembers = new Map([['you', 'You'], ['sam', 'Sam'], ['milo', 'Milo']]);
const legacyProjects = new Map([['trip', 'Summer in Lisbon'], ['room', "Milo's big-kid room"]]);

export function mergeStarterData(data: DoneData): DoneData {
  const existingCategories = data.categories ?? [];
  const missingCategories = starterData.categories.filter(category => !existingCategories.some(existing => existing.id === category.id));
  const tasks = (data.tasks ?? []).filter(task => legacySampleTasks.get(task.id) !== task.title).map((task, index) => ({ ...task, order: task.order ?? index }));
  const members = (data.members ?? []).filter(member => legacyMembers.get(member.id) !== member.name);
  const projects = (data.projects ?? []).filter(project => legacyProjects.get(project.id) !== project.name);
  return { ...data, tasks, members, projects, categories: [...existingCategories, ...missingCategories] };
}

const dueScore = (due?: string) => due === 'Today' ? 8 : due === 'Tomorrow' ? 6 : due === 'Friday' ? 4 : due === 'This week' ? 3 : 0;
const priorityScore = (priority?: Task['priority']) => priority === 'high' ? 7 : priority === 'medium' ? 3 : 0;
const orderScore = (task: Task) => Number.isFinite(task.order) ? task.order! : Number.MAX_SAFE_INTEGER;
export const priorityEngine = (tasks: Task[]) => tasks.filter(t => !t.completed && !t.snoozed).sort((a,b) => orderScore(a) - orderScore(b) || dueScore(b.due) + priorityScore(b.priority) + (b.energy === 'quick' ? 2 : 0) - dueScore(a.due) - priorityScore(a.priority) - (a.energy === 'quick' ? 2 : 0)).slice(0,3);
export const doneVoice = { complete: ["That's off your mind.", 'Tiny victory. Big exhale.', 'Done looks good on you.'], empty: "Nothing's on fire. Go enjoy the good bit.", capture: 'Got it. You can forget it now.' };
export function parseCapture(input: string): Omit<Task,'id'|'createdAt'|'completed'> { const lower=input.toLowerCase(); const due=lower.includes('tomorrow')?'Tomorrow':lower.includes('today')?'Today':lower.includes('friday')?'Friday':undefined; const priority=lower.includes('urgent')||lower.includes('asap')||due==='Today'?'high':due?'medium':undefined; const assignee=lower.includes('heather')?'heather':lower.includes('jemal')?'jemal':'household'; const category=lower.includes('global resilience')?'global-resilience':lower.includes('job')||lower.includes('resume')||lower.includes('interview')?'job-search':lower.includes('pick up')||lower.includes('buy')?'errands':lower.includes('school')||lower.includes('kids')?'family':lower.includes('book')||lower.includes('email')?'admin':'home'; const clean=input.replace(/\b(today|tomorrow|friday|for jemal|ask jemal to|for heather|ask heather to|urgent|asap)\b/gi,'').replace(/\s+/g,' ').trim(); return {title:clean.charAt(0).toUpperCase()+clean.slice(1),due,priority,category,assignee,energy:category==='errands'?'errand':'quick'}; }
