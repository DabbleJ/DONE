import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CloudDownload, ListChecks, PenLine, SkipForward, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { NotionSettings } from '@/components/NotionSettings';
import { useDone } from '@/contexts/DoneContext';
import { parseCapture, type Task } from '@/lib/done';

type Path = 'choice' | 'guided' | 'free' | 'priority' | 'notion' | 'complete';
type PendingTask = Omit<Task, 'id' | 'createdAt' | 'completed'>;

const prompts: Record<string, { question: string; hint: string }> = {
  home: { question: 'What would make home feel lighter?', hint: 'A repair, a tidy-up, something to order…' },
  family: { question: 'What does the family need next?', hint: 'Appointments, school things, plans, people to call…' },
  admin: { question: 'What life admin is hovering?', hint: 'Forms, renewals, emails, bookings…' },
  errands: { question: 'What needs picking up or dropping off?', hint: 'Shopping, returns, parcels, prescriptions…' },
  'job-search': { question: 'What would move Jemal’s job search forward?', hint: 'An application, follow-up, résumé update…' },
  'global-resilience': { question: 'What needs attention in Heather’s Global Resilience work?', hint: 'A meeting, brief, decision or follow-up…' },
};

export function Onboarding({ open, storageKey, onComplete }: { open: boolean; storageKey: string; onComplete: () => void }) {
  const { data, addTask } = useDone();
  const [path, setPath] = useState<Path>('choice');
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [entry, setEntry] = useState('');
  const [pending, setPending] = useState<PendingTask | null>(null);
  const [returnPath, setReturnPath] = useState<'guided' | 'free'>('free');
  const [addedCount, setAddedCount] = useState(0);
  const category = data.categories[categoryIndex];

  if (!open) return null;

  const finish = () => {
    localStorage.setItem(storageKey, '1');
    onComplete();
  };

  const nextCategory = () => {
    setEntry('');
    if (categoryIndex >= data.categories.length - 1) setPath('complete');
    else setCategoryIndex(index => index + 1);
  };

  const saveTask = (task: PendingTask, priority?: Task['priority']) => {
    addTask({ ...task, priority: priority ?? task.priority, id: crypto.randomUUID(), completed: false, createdAt: new Date().toISOString() });
    setAddedCount(count => count + 1);
  };

  const submitEntry = (mode: 'guided' | 'free') => {
    if (!entry.trim()) return;
    const parsed = parseCapture(entry);
    const task: PendingTask = mode === 'guided' ? { ...parsed, category: category.id } : parsed;
    setEntry('');
    if (!task.priority && !task.due) {
      setPending(task);
      setReturnPath(mode);
      setPath('priority');
      return;
    }
    saveTask(task);
    if (mode === 'guided') nextCategory();
  };

  const choosePriority = (priority: Task['priority']) => {
    if (pending) saveTask(pending, priority);
    setPending(null);
    if (returnPath === 'guided') {
      setPath('guided');
      nextCategory();
    } else {
      setPath('free');
    }
  };

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
    <div className="mx-auto flex min-h-full max-w-2xl flex-col px-5 pb-10 pt-6 sm:px-8 sm:pt-10">
      <header className="flex items-center justify-between">
        <div className="brand text-3xl">DONE<span>.</span></div>
        {path !== 'choice' && path !== 'complete' && <button onClick={() => setPath('choice')} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-muted-foreground hover:bg-muted"><ArrowLeft size={16}/> Start over</button>}
      </header>

      {path === 'choice' && <div className="my-auto py-10 animate-in-soft">
        <p className="eyebrow text-primary">A calm start</p>
        <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl">How would you like to<br/><em>empty your head?</em></h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">There’s no perfect setup. Pick the way that feels easiest right now—you can add everything else later.</p>
        <div className="mt-8 grid gap-3">
          <button onClick={() => setPath('notion')} className="paper-card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background"><CloudDownload/></span><span className="flex-1"><strong className="text-lg">Bring things in from Notion</strong><span className="mt-1 block text-sm text-muted-foreground">Best if your lists already live there.</span></span><ArrowRight className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></button>
          <button onClick={() => { setCategoryIndex(0); setPath('guided'); }} className="paper-card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><ListChecks/></span><span className="flex-1"><strong className="text-lg">Guide me category by category</strong><span className="mt-1 block text-sm text-muted-foreground">One gentle prompt at a time, with Skip always available.</span></span><ArrowRight className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></button>
          <button onClick={() => setPath('free')} className="paper-card group flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f8ddd4] text-[#b4523f]"><PenLine/></span><span className="flex-1"><strong className="text-lg">Let me type freely</strong><span className="mt-1 block text-sm text-muted-foreground">Write naturally. DONE. will sort the category.</span></span><ArrowRight className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary"/></button>
        </div>
        <button onClick={finish} className="mx-auto mt-7 block rounded-full px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground">I’ll do this later</button>
      </div>}

      {path === 'guided' && category && <div className="my-auto py-10 animate-in-soft">
        <div className="mb-8"><div className="mb-3 flex items-center justify-between text-xs font-bold text-muted-foreground"><span>{categoryIndex + 1} of {data.categories.length}</span><span>{category.name}{category.owner ? ` · ${category.owner}` : ''}</span></div><Progress value={(categoryIndex + 1) / data.categories.length * 100} className="h-2"/></div>
        <div className="inline-flex rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: category.color }}>{category.name}</div>
        <h1 className="mt-5 text-4xl leading-tight sm:text-5xl">{prompts[category.id]?.question ?? `Anything to remember for ${category.name}?`}</h1>
        <p className="mt-3 text-muted-foreground">{prompts[category.id]?.hint}</p>
        <textarea autoFocus value={entry} onChange={event => setEntry(event.target.value)} className="mt-8 min-h-36 w-full resize-none rounded-[1.75rem] border-2 bg-card p-5 text-lg outline-none transition focus:border-primary" placeholder="Type one thing…"/>
        <div className="mt-4 flex gap-3"><Button onClick={nextCategory} variant="outline" className="h-12 flex-1 rounded-full font-bold"><SkipForward className="mr-2" size={17}/>Skip</Button><Button onClick={() => submitEntry('guided')} disabled={!entry.trim()} className="h-12 flex-1 rounded-full font-bold">Save & continue<ArrowRight className="ml-2" size={17}/></Button></div>
        <p className="mt-4 text-center text-xs text-muted-foreground">Add a day or “urgent” if you know it. Otherwise, we’ll ask once.</p>
      </div>}

      {path === 'free' && <div className="my-auto py-10 animate-in-soft">
        <p className="eyebrow text-primary">Free entry</p><h1 className="mt-3 text-4xl leading-tight sm:text-5xl">Say it naturally.<br/><em>We’ll sort it.</em></h1>
        <p className="mt-3 text-muted-foreground">Try “Follow up on the interview tomorrow” or “Global Resilience briefing for Heather.”</p>
        <textarea autoFocus value={entry} onChange={event => setEntry(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitEntry('free'); } }} className="mt-8 min-h-40 w-full resize-none rounded-[1.75rem] border-2 bg-card p-5 text-lg outline-none transition focus:border-primary" placeholder="What’s on your mind?"/>
        <Button onClick={() => submitEntry('free')} disabled={!entry.trim()} className="mt-4 h-12 w-full rounded-full font-bold">Add this thought<ArrowRight className="ml-2" size={17}/></Button>
        <div className="mt-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">{addedCount ? `${addedCount} added so far` : 'Add as many as you like'}</span><button onClick={() => setPath('complete')} className="rounded-full px-4 py-2 text-sm font-bold text-primary">{addedCount ? 'I’m finished' : 'Skip for now'}</button></div>
      </div>}

      {path === 'priority' && pending && <div className="my-auto py-10 text-center animate-in-soft">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fff0d4] text-2xl">?</div><p className="eyebrow mt-6 text-primary">One quick question</p><h1 className="mx-auto mt-3 max-w-lg text-4xl leading-tight">When does this need your attention?</h1><p className="mx-auto mt-3 max-w-md text-muted-foreground">“{pending.title}” didn’t include a clear time, so we won’t guess.</p>
        <div className="mx-auto mt-8 grid max-w-md gap-3"><button onClick={() => choosePriority('high')} className="paper-card p-4 text-left font-bold hover:border-primary">Now <span className="ml-2 font-normal text-muted-foreground">— important or time-sensitive</span></button><button onClick={() => choosePriority('medium')} className="paper-card p-4 text-left font-bold hover:border-primary">Soon <span className="ml-2 font-normal text-muted-foreground">— keep it moving</span></button><button onClick={() => choosePriority('low')} className="paper-card p-4 text-left font-bold hover:border-primary">Whenever <span className="ml-2 font-normal text-muted-foreground">— safe in the backlog</span></button></div>
      </div>}

      {path === 'notion' && <div className="my-auto py-10 animate-in-soft"><p className="eyebrow text-primary">Bring your list with you</p><h1 className="mt-3 text-4xl leading-tight sm:text-5xl">Connect Notion,<br/><em>then choose what comes over.</em></h1><p className="mt-3 max-w-lg text-muted-foreground">DONE. only imports. It won’t change or delete anything in your Notion workspace.</p><NotionSettings/><div className="mt-5 flex justify-end"><Button onClick={() => setPath('complete')} className="h-12 rounded-full px-6 font-bold">Continue<ArrowRight className="ml-2" size={17}/></Button></div></div>}

      {path === 'complete' && <div className="my-auto py-10 text-center animate-in-soft"><div className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-secondary"><Check className="text-primary" size={72} strokeWidth={3}/><span className="absolute right-0 top-2 text-3xl">✦</span><span className="absolute bottom-1 left-0 text-3xl">☀️</span></div><p className="eyebrow mt-7 text-primary">That’s plenty</p><h1 className="mt-3 text-4xl sm:text-5xl">You’re ready to be<br/><em>DONE.</em></h1><p className="mx-auto mt-4 max-w-md text-lg text-muted-foreground">We’ll keep the whole list and show you just the next few things that matter.</p><Button onClick={finish} className="mt-8 h-12 rounded-full px-8 text-base font-bold">Show me my Big 3<Sparkles className="ml-2" size={18}/></Button></div>}
    </div>
  </div>;
}
