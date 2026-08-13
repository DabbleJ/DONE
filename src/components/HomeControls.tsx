import { useState } from 'react';
import { HousePlus, KeyRound, Loader2, LogOut, Repeat2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';

type HomeAction = 'join' | 'add' | 'move' | 'account' | null;
type Destination = 'join' | 'create';

export function HomeControls() {
  const { household, createHousehold, joinHousehold, leaveHousehold } = useHousehold();
  const { demo, signOut } = useSession();
  const [action, setAction] = useState<HomeAction>(null);
  const [destination, setDestination] = useState<Destination>('join');
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [keepCurrent, setKeepCurrent] = useState(true);
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setAction(null);
    setDestination('join');
    setReference('');
    setName('');
    setKeepCurrent(true);
    setConfirmation('');
  };
  const messageFor = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

  const submitHome = async () => {
    const isJoin = action === 'join' || destination === 'join';
    const value = isJoin ? reference.trim() : name.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const oldHome = household;
      const next = isJoin ? await joinHousehold(value) : await createHousehold(value);
      if (action === 'move' && !keepCurrent && oldHome.id !== next.id) {
        await leaveHousehold(oldHome.id, oldHome.role === 'owner');
      }
      toast.success(action === 'move' ? `Boxes unpacked. ${next.name} is now home.` : `${next.name} is ready.`);
      reset();
    } catch (error) {
      toast.error(messageFor(error, 'That home move hit a loose floorboard. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const closeAccount = async () => {
    if (confirmation !== 'CLOSE' || submitting) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('close-account', { body: {} });
    if (error || data?.error) {
      toast.error(data?.error ?? 'Your account could not be closed. Please try again.');
      setSubmitting(false);
      return;
    }
    await signOut();
    toast.success('Your DONE. account has been closed. Take care out there.');
  };

  return <section className="mt-8">
    <div className="mb-3"><p className="eyebrow text-primary">Homes in DONE.</p><h2 className="mt-1 text-2xl">Your keys, your call</h2><p className="mt-1 text-sm text-muted-foreground">One home or a whole keyring—switch without mixing the laundry lists.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <button onClick={() => setAction('join')} className="paper-card flex items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><KeyRound size={20}/></span><span><strong className="block">Join another home</strong><span className="mt-1 block text-sm text-muted-foreground">Use a project ID or invite link.</span></span></button>
      <button onClick={() => { setDestination('create'); setAction('add'); }} className="paper-card flex items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0d4] text-[#85611d]"><HousePlus size={20}/></span><span><strong className="block">Add a 2nd home</strong><span className="mt-1 block text-sm text-muted-foreground">Fresh walls, same handy account.</span></span></button>
      <button onClick={() => setAction('move')} className="paper-card flex items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e8e1f3] text-[#624b82]"><Repeat2 size={20}/></span><span><strong className="block">Move homes</strong><span className="mt-1 block text-sm text-muted-foreground">No cardboard boxes required.</span></span></button>
      <button onClick={() => setAction('account')} disabled={demo} className="paper-card flex items-start gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-destructive/40 disabled:cursor-not-allowed disabled:opacity-50"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><Trash2 size={20}/></span><span><strong className="block">Close DONE. account</strong><span className="mt-1 block text-sm text-muted-foreground">Permanent, unlike that mystery drawer.</span></span></button>
    </div>

    <Dialog open={action === 'join' || action === 'add' || action === 'move'} onOpenChange={open => { if (!open) reset(); }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[2rem] bg-card sm:max-w-lg"><DialogHeader><div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">{action === 'move' ? <Repeat2/> : action === 'add' ? <HousePlus/> : <KeyRound/>}</div><DialogTitle className="text-3xl">{action === 'move' ? 'On the move?' : action === 'add' ? 'Add another front door' : 'Join another home'}</DialogTitle><DialogDescription>{action === 'move' ? 'Tell us where you’re headed, then decide what to do with this set of keys.' : action === 'add' ? 'Create a separate home with its own people, tasks and projects.' : 'Paste the full invite URL or enter the 8-character project ID.'}</DialogDescription></DialogHeader>
      <div className="space-y-5 pt-2">
        {action === 'move' && <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5"><button onClick={() => setDestination('join')} className={`rounded-xl px-3 py-2 text-sm font-bold ${destination === 'join' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Join a home</button><button onClick={() => setDestination('create')} className={`rounded-xl px-3 py-2 text-sm font-bold ${destination === 'create' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Create a home</button></div>}
        {(action === 'join' || destination === 'join') ? <div><label htmlFor="home-reference" className="text-sm font-bold">DONE URL or project ID</label><Input id="home-reference" autoFocus value={reference} onChange={event => setReference(event.target.value)} placeholder="AB12CD34 or https://…/join/AB12CD34" maxLength={300} className="mt-2 h-12 rounded-2xl bg-background px-4"/></div> : <div><label htmlFor="new-home-name" className="text-sm font-bold">New household name</label><Input id="new-home-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. The cabin" maxLength={80} className="mt-2 h-12 rounded-2xl bg-background px-4"/></div>}
        {action === 'move' && <div><p className="text-sm font-bold">What about {household.name}?</p><div className="mt-2 space-y-2"><button onClick={() => setKeepCurrent(true)} className={`w-full rounded-2xl border p-4 text-left ${keepCurrent ? 'border-primary bg-secondary' : 'bg-background'}`}><strong className="text-sm">Keep access</strong><span className="mt-1 block text-xs text-muted-foreground">Keep this home on your keyring and switch back anytime.</span></button><button onClick={() => setKeepCurrent(false)} className={`w-full rounded-2xl border p-4 text-left ${!keepCurrent ? 'border-primary bg-secondary' : 'bg-background'}`}><strong className="text-sm">{household.role === 'owner' ? 'Close this home after moving' : 'Leave this home after moving'}</strong><span className="mt-1 block text-xs text-muted-foreground">{household.role === 'owner' ? 'This permanently closes the home for everyone and removes its shared data.' : 'You’ll leave this home; its other members and data stay put.'}</span></button></div></div>}
        <Button onClick={submitHome} disabled={submitting || !(action === 'join' || destination === 'join' ? reference.trim() : name.trim())} className="h-12 w-full rounded-full text-base font-bold">{submitting && <Loader2 className="mr-2 animate-spin" size={18}/>} {action === 'move' ? 'Move me gently' : action === 'add' ? 'Create second home' : 'Join home'}</Button>
      </div>
    </DialogContent></Dialog>

    <Dialog open={action === 'account'} onOpenChange={open => { if (!open) reset(); }}><DialogContent className="rounded-[2rem] bg-card sm:max-w-md"><DialogHeader><div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"><LogOut/></div><DialogTitle className="text-3xl">Close your account?</DialogTitle><DialogDescription>This permanently deletes your sign-in and closes every home you own for all members. Homes you only joined will remain for everyone else.</DialogDescription></DialogHeader><div className="space-y-4 pt-2"><div className="rounded-2xl bg-[#fff0d4] p-4 text-sm text-[#6f5119]"><strong>This cannot be undone.</strong> Export anything you want to keep before turning in the keys.</div><div><label htmlFor="close-confirmation" className="text-sm font-bold">Type CLOSE to confirm</label><Input id="close-confirmation" autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value.toUpperCase())} maxLength={5} className="mt-2 h-12 rounded-2xl bg-background px-4"/></div><Button variant="destructive" onClick={closeAccount} disabled={confirmation !== 'CLOSE' || submitting} className="h-12 w-full rounded-full text-base font-bold">{submitting && <Loader2 className="mr-2 animate-spin" size={18}/>} Permanently close account</Button></div></DialogContent></Dialog>
  </section>;
}
