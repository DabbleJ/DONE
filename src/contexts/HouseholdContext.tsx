import { createContext, useContext, useEffect, useState } from 'react';
import { ArrowRight, Home, Link2, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './SessionContext';

type Household = {
  id: string;
  name: string;
  projectId: string;
  role: 'owner' | 'member';
};

type HouseholdValue = {
  household: Household;
};

const HouseholdContext = createContext<HouseholdValue | null>(null);

function HouseholdSetup({ onReady }: { onReady: (household: Household) => void }) {
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');
  const [name, setName] = useState('');
  const pathProjectId = window.location.pathname.match(/^\/join\/([^/]+)/i)?.[1] ?? '';
  const [reference, setReference] = useState(pathProjectId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pathProjectId) setMode('join');
  }, [pathProjectId]);

  const submit = async () => {
    const value = mode === 'create' ? name.trim() : reference.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError('');
    const functionName = mode === 'create' ? 'create_household' : 'join_household';
    const args = mode === 'create' ? { household_name: value } : { project_reference: value };
    const { data, error: requestError } = await supabase.rpc(functionName, args);
    setSubmitting(false);
    const result = Array.isArray(data) ? data[0] : data;
    if (requestError || !result) {
      setError(mode === 'join' && requestError?.message.includes('not found') ? 'We couldn’t find that household. Check the DONE URL or project ID.' : requestError?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    window.history.replaceState({}, '', '/');
    onReady({ id: result.id, name: result.name, projectId: result.project_id, role: mode === 'create' ? 'owner' : 'member' });
  };

  return <main className="min-h-screen bg-background px-5 py-8 sm:py-12">
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl flex-col">
      <header className="brand text-3xl">DONE<span>.</span></header>
      <section className="my-auto py-10 animate-in-soft">
        <p className="eyebrow text-primary">Your shared space</p>
        <h1 className="mt-3 text-4xl leading-[1.05] sm:text-5xl">Where does your<br/><em>household live?</em></h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">Create a fresh home for your lists, or join the people already getting things DONE.</p>

        {mode === 'choice' && <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button onClick={() => setMode('create')} className="paper-card group p-6 text-left transition hover:-translate-y-1 hover:border-primary/40"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary"><Home/></span><strong className="mt-5 block text-xl">Create a household</strong><span className="mt-2 block text-sm text-muted-foreground">Start a new shared DONE. home and invite people later.</span><ArrowRight className="mt-5 text-primary transition group-hover:translate-x-1"/></button>
          <button onClick={() => setMode('join')} className="paper-card group p-6 text-left transition hover:-translate-y-1 hover:border-primary/40"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8ddd4] text-[#a64937]"><Users/></span><strong className="mt-5 block text-xl">Join an existing home</strong><span className="mt-2 block text-sm text-muted-foreground">Use a shared DONE URL or the household project ID.</span><ArrowRight className="mt-5 text-primary transition group-hover:translate-x-1"/></button>
        </div>}

        {mode !== 'choice' && <div className="paper-card mt-8 p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">{mode === 'create' ? <Home/> : <Link2/>}</div>
          <h2 className="mt-5 text-2xl">{mode === 'create' ? 'Name your household' : 'Join your household'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{mode === 'create' ? 'You can keep it simple—“The Smiths” or “Our home” works.' : 'Paste the full invite URL or enter the 8-character project ID.'}</p>
          <label htmlFor="household-value" className="mt-6 block text-sm font-bold">{mode === 'create' ? 'Household name' : 'DONE URL or project ID'}</label>
          <Input id="household-value" autoFocus value={mode === 'create' ? name : reference} onChange={event => mode === 'create' ? setName(event.target.value) : setReference(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submit(); }} placeholder={mode === 'create' ? 'e.g. The Smith household' : 'AB12CD34 or https://…/join/AB12CD34'} maxLength={mode === 'create' ? 80 : 300} className="mt-2 h-12 rounded-2xl bg-background px-4"/>
          {error && <p role="alert" className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p>}
          <div className="mt-6 flex gap-3"><Button variant="outline" onClick={() => { setMode('choice'); setError(''); }} className="h-12 flex-1 rounded-full font-bold">Back</Button><Button onClick={submit} disabled={submitting || !(mode === 'create' ? name.trim() : reference.trim())} className="h-12 flex-1 rounded-full font-bold">{submitting && <Loader2 className="mr-2 animate-spin" size={17}/>} {mode === 'create' ? 'Create home' : 'Join home'}</Button></div>
        </div>}
      </section>
    </div>
  </main>;
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { session, demo } = useSession();
  const [household, setHousehold] = useState<Household | null>(demo ? { id: 'demo', name: 'Demo household', projectId: 'DEMOHOME', role: 'owner' } : null);
  const [loading, setLoading] = useState(!demo);

  useEffect(() => {
    if (demo) {
      setHousehold({ id: 'demo', name: 'Demo household', projectId: 'DEMOHOME', role: 'owner' });
      setLoading(false);
      return;
    }
    if (!session) return;
    let active = true;
    setLoading(true);
    supabase.from('household_members').select('household_id, role').eq('user_id', session.user.id).maybeSingle().then(async ({ data: membership }) => {
      if (!active) return;
      if (!membership) {
        setHousehold(null);
        setLoading(false);
        return;
      }
      const { data: home } = await supabase.from('households').select('id, name, project_id').eq('id', membership.household_id).single();
      if (!active) return;
      setHousehold(home ? { id: home.id, name: home.name, projectId: home.project_id, role: membership.role as Household['role'] } : null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [demo, session]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="brand text-4xl">DONE<span>.</span></div></div>;
  if (!household) return <HouseholdSetup onReady={setHousehold}/>;
  return <HouseholdContext.Provider value={{ household }}>{children}</HouseholdContext.Provider>;
}

export const useHousehold = () => {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('HouseholdProvider missing');
  return value;
};
