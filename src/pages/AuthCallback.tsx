import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

export default function AuthCallback() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || session) return;

    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) return;

    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) setError(exchangeError.message);
      else navigate('/', { replace: true });
    });
  }, [loading, navigate, session]);

  if (session) return <Navigate to="/" replace />;

  return <main className="flex min-h-screen items-center justify-center bg-background px-5">
    <div className="paper-card w-full max-w-md p-8 text-center">
      <div className="brand text-4xl">DONE<span>.</span></div>
      {error ? <><h1 className="mt-6 text-2xl">That link didn’t work.</h1><p className="mt-2 text-muted-foreground">{error}</p><button onClick={() => navigate('/login', { replace: true })} className="mt-6 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Back to sign in</button></> : <><h1 className="mt-6 text-2xl">Opening your family space…</h1><p className="mt-2 text-muted-foreground">You’ll be taken straight to your onboarding steps.</p></>}
    </div>
  </main>;
}
