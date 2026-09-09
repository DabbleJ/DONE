import { Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDone } from '@/contexts/DoneContext';
import { isTaskPastTarget, rewardForTask } from '@/lib/done';

export function FamilyRewardNudge({ onOpenTask }: { onOpenTask: (taskId: string) => void }) {
  const { data } = useDone();
  const timezone = data.settings.timezone ?? 'America/Los_Angeles';
  const localHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  if (!data.settings.rewardNudges || (data.settings.quietHours && localHour >= 20)) return null;

  const overdue = [...data.tasks]
    .filter(task => isTaskPastTarget(task, data.projects, timezone))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const task = overdue[0];
  if (!task) return null;

  const reward = rewardForTask(task.id);
  const project = task.project ? data.projects.find(item => item.id === task.project) : undefined;

  return <section className="mb-7 overflow-hidden rounded-[1.75rem] border border-[#edc977] bg-[#fff3cf] shadow-[0_12px_28px_rgba(129,92,25,.08)] animate-in-soft" aria-labelledby="family-reward-title">
    <div className="flex items-center justify-between border-b border-[#edc977]/60 px-5 py-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#795717]"><Sparkles size={15} />A gentle family nudge</div>
      <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-[#795717]">{overdue.length} past target</span>
    </div>
    <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="text-sm font-bold text-[#8b6320]">Pick one finish line, then unlock…</p>
        <h2 id="family-reward-title" className="mt-1 text-2xl text-[#443114]">{reward.emoji} {reward.title}</h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#6d5327]">{reward.detail}</p>
        <div className="mt-4 rounded-2xl bg-white/65 p-3">
          <p className="truncate text-sm font-bold text-[#443114]">{task.title}</p>
          <p className="mt-0.5 text-xs text-[#80622e]">{project ? `${project.name} missed its target date` : `${task.due} has passed`} · No guilt, just a fresh little reason.</p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:flex-col">
        <div className="flex h-16 w-16 shrink-0 rotate-3 items-center justify-center rounded-3xl bg-white text-3xl shadow-sm" aria-hidden="true">{reward.emoji}</div>
        <Button onClick={() => onOpenTask(task.id)} className="h-11 flex-1 rounded-full bg-[#8b5d12] px-5 font-bold text-white hover:bg-[#704a0e] sm:flex-none"><Gift className="mr-2" size={17}/>Let’s do this one</Button>
      </div>
    </div>
  </section>;
}
