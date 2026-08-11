import { useState } from 'react';
import { ArrowDownToLine, Check, ExternalLink, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useDone } from '@/contexts/DoneContext';
import { useSession } from '@/contexts/SessionContext';
import type { Task } from '@/lib/done';
import { toast } from 'sonner';

type DataSource = { id: string; title: string; url?: string };
type NotionItem = { id: string; title: string; completed: boolean; dueDate?: string; category?: string; assignee?: string };

async function getFunctionError(error: unknown) {
  if (error && typeof error === 'object' && 'context' in error) {
    try {
      const payload = await (error as { context: Response }).context.json();
      if (payload?.error) return String(payload.error);
    } catch {
      // The standard message below is clearer than a response parsing error.
    }
  }
  return error instanceof Error ? error.message : 'Notion could not respond.';
}

export function NotionSettings() {
  const { data, addTasks } = useDone();
  const { session, demo } = useSession();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem('done-notion-source') ?? '');
  const [selectedName, setSelectedName] = useState(() => localStorage.getItem('done-notion-source-name') ?? '');
  const [loading, setLoading] = useState<'connect' | 'import' | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);

  const connect = async () => {
    if (!session) return;
    setLoading('connect');
    setSetupNeeded(false);
    const { data: result, error } = await supabase.functions.invoke('notion-sync', { body: { action: 'list' } });
    if (error) {
      const message = await getFunctionError(error);
      setSetupNeeded(message.toLowerCase().includes('setup') || message.toLowerCase().includes('configured'));
      toast.error(message);
    } else {
      const nextSources = (result?.dataSources ?? []) as DataSource[];
      setSources(nextSources);
      if (nextSources.length === 0) toast.info('Share a Notion data source with the DONE. integration, then try again.');
      else toast.success(`${nextSources.length} shared Notion ${nextSources.length === 1 ? 'source' : 'sources'} found.`);
    }
    setLoading(null);
  };

  const selectSource = (sourceId: string) => {
    const source = sources.find(item => item.id === sourceId);
    setSelectedId(sourceId);
    setSelectedName(source?.title ?? 'Notion tasks');
    localStorage.setItem('done-notion-source', sourceId);
    localStorage.setItem('done-notion-source-name', source?.title ?? 'Notion tasks');
  };

  const importTasks = async () => {
    if (!session || !selectedId) return;
    setLoading('import');
    const { data: result, error } = await supabase.functions.invoke('notion-sync', { body: { action: 'import', dataSourceId: selectedId } });
    if (error) {
      toast.error(await getFunctionError(error));
      setLoading(null);
      return;
    }

    const items = (result?.items ?? []) as NotionItem[];
    const mapped: Task[] = items.map(item => {
      const categoryName = item.category?.toLowerCase() ?? '';
      const category = data.categories.find(candidate => candidate.name.toLowerCase() === categoryName)
        ?? data.categories.find(candidate => categoryName.includes(candidate.name.toLowerCase()))
        ?? data.categories.find(candidate => candidate.id === 'admin')!;
      const assigneeName = item.assignee?.toLowerCase() ?? '';
      const assignee = assigneeName.includes('heather') ? 'sam' : 'you';
      const due = item.dueDate
        ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(item.dueDate))
        : undefined;
      return {
        id: `notion:${item.id}`,
        title: item.title,
        completed: item.completed,
        due,
        category: category.id,
        assignee,
        energy: category.id === 'job-search' || category.id === 'global-resilience' ? 'focus' : 'quick',
        createdAt: new Date().toISOString(),
      };
    });
    const existingIds = new Set(data.tasks.map(task => task.id));
    const newCount = mapped.filter(task => !existingIds.has(task.id)).length;
    addTasks(mapped);
    toast.success(newCount ? `${newCount} Notion ${newCount === 1 ? 'task' : 'tasks'} brought into DONE.` : 'Everything is already up to date.');
    setLoading(null);
  };

  return <div className="mt-4 overflow-hidden rounded-[1.75rem] border bg-card shadow-[0_8px_30px_rgba(45,50,39,.06)]">
    <div className="flex items-start gap-4 bg-[#f1eee8] p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-lg font-black text-background">N</div>
      <div className="flex-1">
        <div className="flex items-center gap-2"><p className="font-bold">Notion</p>{selectedId && <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"><Check size={11}/> Connected</span>}</div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Bring shared household tasks into DONE. without exposing your Notion token.</p>
      </div>
    </div>
    <div className="p-5">
      {demo ? <div className="rounded-2xl bg-muted p-4 text-sm"><p className="font-bold">Sign in to connect Notion</p><p className="mt-1 text-muted-foreground">The demo stays local, so integrations are disabled here.</p></div> : <>
        {selectedId && sources.length === 0 && <div className="mb-4 flex items-center justify-between rounded-2xl bg-secondary/70 p-4"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Importing from</p><p className="mt-1 font-bold">{selectedName}</p></div><Check className="text-primary"/></div>}
        {sources.length > 0 && <label className="mb-4 block text-sm font-bold">Shared data source<select value={selectedId} onChange={event => selectSource(event.target.value)} className="mt-2 h-12 w-full rounded-2xl border bg-background px-4 font-normal outline-none ring-primary focus:ring-2"><option value="">Choose one…</option>{sources.map(source => <option key={source.id} value={source.id}>{source.title}</option>)}</select></label>}
        {setupNeeded && <div className="mb-4 rounded-2xl bg-[#fff0d4] p-4 text-sm"><p className="font-bold">One-time setup needed</p><p className="mt-1 text-muted-foreground">Create a Notion internal integration, copy its secret, and add it to DONE.’s server secrets as <code className="font-bold">NOTION_API_KEY</code>.</p><a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-foreground underline">Open Notion integrations <ExternalLink size={14}/></a></div>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={connect} variant="outline" disabled={loading !== null} className="h-11 flex-1 rounded-full font-bold">{loading === 'connect' ? <Loader2 className="mr-2 animate-spin" size={17}/> : selectedId ? <RefreshCw className="mr-2" size={17}/> : <Sparkles className="mr-2" size={17}/>} {selectedId ? 'Refresh connection' : 'Find shared sources'}</Button>
          {selectedId && <Button onClick={importTasks} disabled={loading !== null} className="h-11 flex-1 rounded-full font-bold">{loading === 'import' ? <Loader2 className="mr-2 animate-spin" size={17}/> : <ArrowDownToLine className="mr-2" size={17}/>} Sync now</Button>}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Import only: DONE. won’t edit or delete anything in Notion.</p>
      </>}
    </div>
  </div>;
}
