import { useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Onboarding } from '@/components/Onboarding';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AuthCallback from './pages/AuthCallback';
import Index from './pages/Index';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import { SessionProvider, useSession } from './contexts/SessionContext';
import { DoneProvider } from './contexts/DoneContext';
import { HouseholdProvider, useHousehold } from './contexts/HouseholdContext';

const queryClient = new QueryClient();

function Gate({ children }: { children: React.ReactNode }) {
  const { session, demo, loading } = useSession();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="brand text-4xl">DONE<span>.</span></div></div>;
  const joinPath = window.location.pathname.startsWith('/join/') ? window.location.pathname : '';
  return session || demo ? children : <Navigate to={joinPath ? `/login?invited=1&next=${encodeURIComponent(joinPath)}` : '/login'} replace />;
}

function Home() {
  const { session } = useSession();
  const { household } = useHousehold();
  const storageKey = `done-onboarding-v2-${session?.user.id ?? 'demo'}`;
  const [showOnboarding, setShowOnboarding] = useState(() => household.role === 'owner' && localStorage.getItem(storageKey) !== '1');
  return <DoneProvider key={household.id}><Index/><Onboarding open={showOnboarding} storageKey={storageKey} onComplete={() => setShowOnboarding(false)}/></DoneProvider>;
}

function AppRoutes() {
  const { session, demo } = useSession();
  const home = <Gate><HouseholdProvider><Home/></HouseholdProvider></Gate>;
  return <Routes><Route path="/login" element={session || demo ? <Navigate to="/" replace /> : <Login />}/><Route path="/auth/callback" element={<AuthCallback/>}/><Route path="/" element={home}/><Route path="/join/:projectId" element={home}/><Route path="*" element={<NotFound/>}/></Routes>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Toaster/><Sonner/><BrowserRouter><SessionProvider><AppRoutes/></SessionProvider></BrowserRouter></TooltipProvider></QueryClientProvider>;
}
