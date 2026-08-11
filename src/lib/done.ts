export type Member = { id: string; name: string; initial: string; color: string };
export type Category = { id: string; name: string; color: string; owner?: string };
export type Project = { id: string; name: string; emoji: string; color: string; completed: number; total: number };
export type Task = { id: string; title: string; note?: string; due?: string; category: string; assignee: string; project?: string; energy: 'quick' | 'focus' | 'errand'; priority?: 'low' | 'medium' | 'high'; completed: boolean; createdAt: string; snoozed?: boolean };
export type DoneData = { tasks: Task[]; projects: Project[]; members: Member[]; categories: Category[]; settings: { doneVoice: boolean; celebrations: boolean; quietHours: boolean } };
export const starterData: DoneData = {
  members: [{ id: 'you', name: 'You', initial: 'Y', color: '#39A852' }, { id: 'sam', name: 'Sam', initial: 'S', color: '#E8785E' }, { id: 'milo', name: 'Milo', initial: 'M', color: '#E8B84A' }],
  categories: [
    { id: 'home', name: 'Home', color: '#DDF0D9' },
    { id: 'family', name: 'Family', color: '#F9DED7' },
    { id: 'admin', name: 'Life admin', color: '#DFE7F3' },
    { id: 'errands', name: 'Errands', color: '#F5E9C8' },
    { id: 'job-search', name: 'Job Search', owner: 'Jemal', color: '#DCE9F7' },
    { id: 'global-resilience', name: 'Global Resilience', owner: 'Heather', color: '#E7DFF3' },
  ],
  projects: [{ id: 'trip', name: 'Summer in Lisbon', emoji: '✈️', color: '#DDF0D9', completed: 4, total: 9 }, { id: 'room', name: "Milo's big-kid room", emoji: '🪁', color: '#F9DED7', completed: 2, total: 7 }],
  tasks: [
    { id: '1', title: 'Book dentist appointments', note: 'Both kids, ideally after school', due: 'Today', category: 'family', assignee: 'you', energy: 'quick', completed: false, createdAt: '2026-08-18' },
    { id: '2', title: 'Send passport photos', due: 'Today', category: 'admin', assignee: 'sam', project: 'trip', energy: 'quick', completed: false, createdAt: '2026-08-17' },
    { id: '3', title: 'Order new cabinet hinge', due: 'This week', category: 'home', assignee: 'you', energy: 'errand', completed: false, createdAt: '2026-08-16' },
    { id: '4', title: "Pick up Nana's birthday gift", due: 'Friday', category: 'errands', assignee: 'sam', energy: 'errand', completed: false, createdAt: '2026-08-15' },
    { id: '5', title: 'Refill dog food', category: 'home', assignee: 'you', energy: 'quick', completed: false, createdAt: '2026-08-14' },
  ], settings: { doneVoice: true, celebrations: true, quietHours: true },
};

export function mergeStarterData(data: DoneData): DoneData {
  const existingCategories = data.categories ?? [];
  const missingCategories = starterData.categories.filter(category => !existingCategories.some(existing => existing.id === category.id));
  return { ...data, categories: [...existingCategories, ...missingCategories] };
}

const dueScore = (due?: string) => due === 'Today' ? 8 : due === 'Tomorrow' ? 6 : due === 'Friday' ? 4 : due === 'This week' ? 3 : 0;
const priorityScore = (priority?: Task['priority']) => priority === 'high' ? 7 : priority === 'medium' ? 3 : 0;
export const priorityEngine = (tasks: Task[]) => tasks.filter(t => !t.completed && !t.snoozed).sort((a,b) => dueScore(b.due) + priorityScore(b.priority) + (b.energy === 'quick' ? 2 : 0) - dueScore(a.due) - priorityScore(a.priority) - (a.energy === 'quick' ? 2 : 0)).slice(0,3);
export const doneVoice = { complete: ["That's off your mind.", 'Tiny victory. Big exhale.', 'Done looks good on you.'], empty: "Nothing's on fire. Go enjoy the good bit.", capture: 'Got it. You can forget it now.' };
export function parseCapture(input: string): Omit<Task,'id'|'createdAt'|'completed'> { const lower=input.toLowerCase(); const due=lower.includes('tomorrow')?'Tomorrow':lower.includes('today')?'Today':lower.includes('friday')?'Friday':undefined; const priority=lower.includes('urgent')||lower.includes('asap')||due==='Today'?'high':due?'medium':undefined; const assignee=lower.includes('heather')||lower.includes('sam')?'sam':'you'; const category=lower.includes('global resilience')?'global-resilience':lower.includes('job')||lower.includes('resume')||lower.includes('interview')?'job-search':lower.includes('pick up')||lower.includes('buy')?'errands':lower.includes('school')||lower.includes('kids')?'family':lower.includes('book')||lower.includes('email')?'admin':'home'; const clean=input.replace(/\b(today|tomorrow|friday|for sam|ask sam to|for heather|ask heather to|urgent|asap)\b/gi,'').replace(/\s+/g,' ').trim(); return {title:clean.charAt(0).toUpperCase()+clean.slice(1),due,priority,category,assignee,energy:category==='errands'?'errand':'quick'}; }
