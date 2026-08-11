import { useEffect, useRef, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { ArrowRight, Check, Eye, EyeOff, Gift, PawPrint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

export default function Login(){
  const { startDemo } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const authRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePasswordInputs = () => {
      authRef.current?.querySelectorAll<HTMLInputElement>('input[name="password"]').forEach((input) => {
        input.type = showPassword ? 'text' : 'password';
      });
    };

    updatePasswordInputs();
    const observer = new MutationObserver(updatePasswordInputs);
    if (authRef.current) observer.observe(authRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [showPassword]);

  return <main className="min-h-screen bg-background px-5 py-8 lg:grid lg:grid-cols-2 lg:gap-20 lg:px-16">
  <section className="mx-auto flex max-w-xl flex-col justify-between lg:mx-0">
    <div><div className="brand text-5xl">DONE<span>.</span></div><p className="mt-2 text-sm font-bold uppercase tracking-[.22em] text-muted-foreground">Do. Organize. Now. Enjoy.</p></div>
    <div className="my-10"><div className="relative mx-auto h-60 max-w-sm rounded-[2.5rem] bg-[#e9f4e6] p-7 rotate-[-1deg]">
      <div className="absolute right-7 top-7 rounded-full bg-white p-3 shadow-sm"><PawPrint className="text-primary"/></div><div className="absolute left-10 top-12 rotate-[-8deg] text-4xl">✈️</div><div className="absolute bottom-10 left-8 rounded-full bg-[#f8ddd4] p-3"><Gift className="text-[#d7654d]"/></div>
      <div className="absolute inset-x-20 top-16 rotate-2 rounded-3xl bg-[#fffdf6] p-5 shadow-[0_10px_30px_rgba(43,48,39,.1)]"><div className="mb-4 h-2 w-20 rounded bg-foreground/15"/>{[1,2,3].map(i=><div key={i} className="mb-3 flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full ${i===1?'bg-primary text-white':'border-2 border-foreground/20'}`}>{i===1&&<Check size={15}/>}</span><span className="h-2 flex-1 rounded bg-foreground/10"/></div>)}</div>
      <span className="absolute bottom-7 right-10 text-3xl rotate-12">🦷</span></div>
      <h1 className="mt-10 text-4xl font-semibold leading-[1.05] sm:text-5xl">One calm place for<br/><em>all the family stuff.</em></h1><p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">Empty your head. DONE. keeps the whole lot, then shows you only what matters now.</p></div>
  </section>
  <section className="mx-auto flex w-full max-w-md items-center"><div className="w-full rounded-[2rem] border bg-card p-6 shadow-[0_22px_70px_rgba(47,51,43,.10)] sm:p-9"><h2 className="text-2xl font-semibold">Let’s make life lighter.</h2><p className="mb-6 mt-1 text-muted-foreground">Sign in or create your family space.</p><div ref={authRef}><Auth supabaseClient={supabase} providers={[]} appearance={{theme:ThemeSupa,variables:{default:{colors:{brand:'#39A852',brandAccent:'#2f9045'},radii:{borderRadiusButton:'999px',buttonBorderRadius:'999px',inputBorderRadius:'14px'}}}}} theme="light"/></div><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-pressed={showPassword} className="mt-3 flex items-center gap-2 rounded-full px-2 py-1 text-sm font-bold text-muted-foreground transition hover:text-foreground">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>} {showPassword?'Hide password':'Show password'}</button><div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>or explore first<span className="h-px flex-1 bg-border"/></div><Button onClick={startDemo} variant="outline" className="h-12 w-full rounded-full border-foreground/20 font-bold">Try the family demo <ArrowRight className="ml-2" size={17}/></Button></div></section>
</main>}
