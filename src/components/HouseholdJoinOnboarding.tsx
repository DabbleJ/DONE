import { useState } from 'react';
import { ArrowRight, Check, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Household } from '@/contexts/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import type { Pronouns } from '@/lib/done';

const pronounOptions: Pronouns[] = ['she/her', 'he/him', 'them/they'];

export function HouseholdJoinOnboarding({ household, initialName, onComplete }: { household: Household; initialName: string; onComplete: () => void }) {
  const [name, setName] = useState(initialName);
  const [pronouns, setPronouns] = useState<Pronouns | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const cleanName = name.trim();
    if (!cleanName || !pronouns || submitting) return;
    setSubmitting(true);
    setError('');
    const { error: requestError } = await supabase.rpc('complete_household_join', {
      target_household_id: household.id,
      display_name: cleanName,
      preferred_pronouns: pronouns,
    });
    if (requestError) {
      setError(requestError.message ?? 'We could not finish setting up your household profile.');
      setSubmitting(false);
      return;
    }
    sessionStorage.setItem(`done-open-us-household-${household.id}`, '1');
    onComplete();
  };

  return <main className="min-h-screen bg-background px-5 py-8 sm:py-12">
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl flex-col">
      <header className="brand text-3xl">DONE<span>.</span></header>
      <section className="my-auto py-10 animate-in-soft">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-secondary text-primary"><Users size={28}/></div>
        <p className="eyebrow mt-7 text-primary">Welcome to {household.name}</p>
        <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl">First, who just<br/><em>walked through the door?</em></h1>
        <p className="mt-4 text-lg text-muted-foreground">Add the name and pronouns you’d like this household to see. No awkward name tags required.</p>

        <div className="paper-card mt-8 space-y-6 p-6 sm:p-8">
          <div><label htmlFor="join-display-name" className="text-sm font-bold">Your name</label><Input id="join-display-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="What should everyone call you?" maxLength={60} className="mt-2 h-12 rounded-2xl bg-background px-4"/></div>
          <div><p className="text-sm font-bold">Your preferred pronouns</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{pronounOptions.map(option => <button key={option} type="button" aria-pressed={pronouns === option} onClick={() => setPronouns(option)} className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${pronouns === option ? 'border-primary bg-secondary text-primary' : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>{pronouns === option && <Check size={16} strokeWidth={3}/>} {option}</button>)}</div></div>
          {error && <p role="alert" className="rounded-2xl bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}
          <Button onClick={submit} disabled={!name.trim() || !pronouns || submitting} className="h-12 w-full rounded-full text-base font-bold">{submitting ? <><Loader2 className="mr-2 animate-spin" size={18}/>Joining the home team…</> : <>Meet the household<ArrowRight className="ml-2" size={18}/></>}</Button>
        </div>
      </section>
    </div>
  </main>;
}
