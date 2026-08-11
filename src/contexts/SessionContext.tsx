import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type SessionValue = { session: Session | null; loading: boolean; demo: boolean; startDemo: () => void; signOut: () => Promise<void> };
const SessionContext = createContext<SessionValue | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session,setSession]=useState<Session|null>(null); const [loading,setLoading]=useState(true); const [demo,setDemo]=useState(()=>sessionStorage.getItem('done-demo')==='1');
  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)}); const {data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false)}); return()=>data.subscription.unsubscribe(); },[]);
  const startDemo=()=>{sessionStorage.setItem('done-demo','1');setDemo(true)};
  const signOut=async()=>{sessionStorage.removeItem('done-demo');setDemo(false);await supabase.auth.signOut()};
  return <SessionContext.Provider value={{session,loading,demo,startDemo,signOut}}>{children}</SessionContext.Provider>;
}
export const useSession=()=>{const value=useContext(SessionContext);if(!value)throw new Error('SessionProvider missing');return value};
