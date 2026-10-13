import { TaskList, taskLists } from '@/lib/done';

export function TaskListPicker({ value, onChange }: { value: TaskList; onChange: (value: TaskList) => void }) {
  return <fieldset>
    <legend className="text-sm font-bold">Productive AF tag</legend>
    <p className="mt-1 text-xs text-muted-foreground">One list per task. Categories and projects stay the same.</p>
    <div className="mt-2 flex flex-wrap gap-2">{taskLists.map(list => <button key={list.id} type="button" aria-pressed={value === list.id} onClick={() => onChange(list.id)} className={`rounded-full border px-3 py-2 text-sm font-bold transition ${value === list.id ? 'border-primary bg-secondary text-primary' : 'bg-background text-foreground hover:border-primary/50'}`}><span aria-hidden="true">{list.emoji}</span> {list.label}</button>)}</div>
  </fieldset>;
}
