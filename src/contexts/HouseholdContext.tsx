import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ArrowRight, Home, Link2, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HouseholdJoinOnboarding } from '@/components/HouseholdJoinOnboarding';
import { supabase } from '@/integrations/supabase/client';
import type { HouseholdRole } from '@/lib/done';
import { useSession } from './SessionContext';

export type Household = {
  id: string;
  name: string;
  projectId: string;
  role: HouseholdRole;
};

type HouseholdValue = {
  household: Household;
  households: Household[];
  switchHousehold: (id: string) => Promise<void>;
  createHousehold: (name: string) => Promise<Household>;
  joinHousehold: (reference: string) => Promise<Household>;
  leaveHousehold: (id: string, close: boolean) => Promise<void>;
};

type RpcHousehold = { id: string; name: string; project_id: string };

const HouseholdContext = createContext<HouseholdValue | null>(null);
const demoHousehold: Household = { id: 'demo', name: 'Demo household', projectId: 'DEMOHOME', role: 'owner' };

function rpcResult(data: unknown) {
  const value = Array.isArray(data) ? data[0] : data;
  return value as RpcHousehold | null;
}

function HouseholdSetup({ onReady }: { onReady: (joinedHousehold?: RpcHousehold) => Promise<void> }) {
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
    const result = rpcResult(data);
    if (requestError || !result) {
      setSubmitting(false);
      setError(mode === 'join' && requestError?.message.includes('not found') ? 'We couldn’t find that household. Check the DONE URL or project ID.' : requestError?.message ?? 'Something went wrong. Please try again.');
      return;
    }
    window.history.replaceState({}, '', '/');
    await onReady(mode === 'join' ? result : undefined);
    setSubmitting(false);
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
  const [households, setHouseholds] = useState<Household[]>(demo ? [demoHousehold] : []);
  const [household, setHousehold] = useState<Household | null>(demo ? demoHousehold : null);
  const [pendingJoin, setPendingJoin] = useState<Household | null>(null);
  const [loading, setLoading] = useState(!demo);

  const loadHouseholds = useCallback(async () => {
    if (demo) {
      setHouseholds([demoHousehold]);
      setHousehold(demoHousehold);
      setLoading(false);
      return;
    }
    if (!session) return;
    setLoading(true);
    const [{ data: memberships, error: membershipError }, { data: profile }] = await Promise.all([
      supabase.from('household_members').select('household_id, role').eq('user_id', session.user.id),
      supabase.from('profiles').select('active_household_id').eq('id', session.user.id).maybeSingle(),
    ]);
    if (membershipError || !memberships?.length) {
      setHouseholds([]);
      setHousehold(null);
      setLoading(false);
      return;
    }
    const { data: homes, error: homesError } = await supabase.from('households').select('id, name, project_id').in('id', memberships.map(item => item.household_id));
    if (homesError || !homes) {
      setHouseholds([]);
      setHousehold(null);
      setLoading(false);
      return;
    }
    const next = homes.map(home => ({
      id: home.id,
      name: home.name,
      projectId: home.project_id,
      role: memberships.find(item => item.household_id === home.id)?.role as Household['role'],
    }));
    const active = next.find(item => item.id === profile?.active_household_id) ?? next[0];
    if (active && active.id !== profile?.active_household_id) await supabase.rpc('set_active_household', { target_household_id: active.id });
    setHouseholds(next);
    setHousehold(active ?? null);
    setLoading(false);
  }, [demo, session]);

  useEffect(() => { void loadHouseholds(); }, [loadHouseholds]);

  const switchHousehold = async (id: string) => {
    if (demo) return;
    const next = households.find(item => item.id === id);
    if (!next) throw new Error('You do not belong to that household.');
    const { error } = await supabase.rpc('set_active_household', { target_household_id: id });
    if (error) throw error;
    setHousehold(next);
  };
  const createHousehold = async (name: string) => {
    const { data, error } = await supabase.rpc('create_household', { household_name: name.trim() });
    const result = rpcResult(data);
    if (error || !result) throw error ?? new Error('The home could not be created.');
    const next: Household = { id: result.id, name: result.name, projectId: result.project_id, role: 'owner' };
    setHouseholds(current => [...current.filter(item => item.id !== next.id), next]);
    setHousehold(next);
    return next;
  };
  const joinHousehold = async (reference: string): Promise<Household> => {
    const { data, error } = await supabase.rpc('join_household', { project_reference: reference.trim() });
    const result = rpcResult(data);
    if (error || !result) throw error ?? new Error('The home could not be joined.');
    const alreadyMember = households.some(item => item.id === result.id);
    const next: Household = { id: result.id, name: result.name, projectId: result.project_id, role: 'member' };
    await loadHouseholds();
    if (!alreadyMember) setPendingJoin(next);
    return next;
  };
  const leaveHousehold = async (id: string, close: boolean) => {
    const { error } = await supabase.rpc('leave_household', { target_household_id: id, close_household: close });
    if (error) throw error;
    await loadHouseholds();
  };
  const finishInitialSetup = async (joinedHousehold?: RpcHousehold) => {
    await loadHouseholds();
    if (joinedHousehold) setPendingJoin({ id: joinedHousehold.id, name: joinedHousehold.name, projectId: joinedHousehold.project_id, role: 'member' });
  };
  const initialName = session ? [session.user.user_metadata.first_name, session.user.user_metadata.last_name].filter(Boolean).join(' ') || session.user.user_metadata.full_name || session.user.email?.split('@')[0] || '' : '';

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="brand text-4xl">DONE<span>.</span></div></div>;
  if (pendingJoin) return <HouseholdJoinOnboarding household={pendingJoin} initialName={initialName} onComplete={() => setPendingJoin(null)}/>;
  if (!household) return <HouseholdSetup onReady={finishInitialSetup}/>;
  return <HouseholdContext.Provider value={{ household, households, switchHousehold, createHousehold, joinHousehold, leaveHousehold }}>{children}</HouseholdContext.Provider>;
}

export const useHousehold = () => {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('HouseholdProvider missing');
  return value;
};
