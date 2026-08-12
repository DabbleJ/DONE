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

const queryClient = new QueryClient();

function Gate({ children }: { children: React.ReactNode }) {
  const { session, demo, loading } = useSession();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="brand text-4xl">DONE<span>.</span></div></div>;
  return session || demo ? children : <Navigate to="/login" replace />;
}

function Home() {
  const { session } = useSession();
  const storageKey = `done-onboarding-v2-${session?.user.id ?? 'demo'}`;
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(storageKey) !== '1');
  return <DoneProvider><Index/><Onboarding open={showOnboarding} storageKey={storageKey} onComplete={() => setShowOnboarding(false)}/></DoneProvider>;
}

function AppRoutes() {
  const { session, demo } = useSession();
  return <Routes><Route path="/login" element={session || demo ? <Navigate to="/" replace /> : <Login />}/><Route path="/auth/callback" element={<AuthCallback/>}/><Route path="/" element={<Gate><Home/></Gate>}/><Route path="*" element={<NotFound/>}/></Routes>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Toaster/><Sonner/><BrowserRouter><SessionProvider><AppRoutes/></SessionProvider></BrowserRouter></TooltipProvider></QueryClientProvider>;
}
