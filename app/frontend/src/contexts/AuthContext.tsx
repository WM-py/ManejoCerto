import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, TABLES } from '@/lib/supabase';
import { Profile } from '@/lib/types';

/**
 * Garante que o perfil do usuário exista com o nome da fazenda.
 * Roda no client (RLS permite gravar o próprio perfil), então funciona
 * independentemente de o trigger do banco preencher o nome_fazenda.
 */
async function ensureProfile(user: User) {
  const nomeFazendaMeta = (user.user_metadata?.nome_fazenda as string | undefined)?.trim();

  const { data: existing } = await supabase
    .from(TABLES.profiles)
    .select('id, nome_fazenda, trial_start, trial_end, plan, plan_status')
    .eq('id', user.id)
    .maybeSingle();

  // Perfil ausente: cria com o nome da fazenda (ou um padrão) e inicia o trial.
  if (!existing) {
    const trialStart = new Date().toISOString();
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from(TABLES.profiles).insert({
      id: user.id,
      nome_fazenda: nomeFazendaMeta || 'Minha Fazenda',
      trial_start: trialStart,
      trial_end: trialEnd,
      plan: 'trial',
      plan_status: 'trialing',
    });
    return;
  }

  // Perfil existe mas sem nome e temos o nome no metadata: completa.
  if (!existing.nome_fazenda && nomeFazendaMeta) {
    await supabase.from(TABLES.profiles).update({ nome_fazenda: nomeFazendaMeta }).eq('id', user.id);
  }
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from(TABLES.profiles)
    .select('id, nome_fazenda, created_at, trial_start, trial_end, plan, plan_status')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  return data as Profile | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, nomeFazenda?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setProfileLoading(true);

      if (currentSession?.user) {
        await ensureProfile(currentSession.user);
        const loadedProfile = await loadProfile(currentSession.user.id);
        setProfile(loadedProfile);
      } else {
        setProfile(null);
      }

      setLoading(false);
      setProfileLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && newSession?.user) {
          setProfileLoading(true);
          await ensureProfile(newSession.user);
          const loadedProfile = await loadProfile(newSession.user.id);
          setProfile(loadedProfile);
          setProfileLoading(false);
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setProfileLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, nomeFazenda?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: nomeFazenda ? { nome_fazenda: nomeFazenda } : undefined,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, loading, profileLoading, signUp, signIn, signOut, resetPassword, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}