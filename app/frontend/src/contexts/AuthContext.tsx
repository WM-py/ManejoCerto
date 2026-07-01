import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseReady, TABLES } from '@/lib/supabase';
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
  signUp: (email: string, password: string, nomeFazenda?: string, metadata?: Record<string, string>) => Promise<{ error: Error | null }>;
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

  // 1) Sessão inicial + inscrição em mudanças de auth.
  //    IMPORTANTE: o callback do onAuthStateChange é SÍNCRONO (só atualiza estado).
  //    Chamar queries do Supabase aqui dentro causa deadlock do lock de auth
  //    (a query nunca resolve e o app trava no "Carregando..."). O carregamento
  //    do perfil fica no effect 2, disparado por mudança de user.id.
  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!active) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        if (!currentSession?.user) {
          setProfile(null);
          setProfileLoading(false);
        }
      })
      .catch((error) => {
        console.error('Falha ao obter sessão:', error);
        if (!active) return;
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        setProfileLoading(false);
      });

    let subscription: { unsubscribe: () => void } | null = null;
    if (supabaseReady) {
      const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        if (!newSession?.user) {
          setProfile(null);
          setProfileLoading(false);
        }
      });
      subscription = data.subscription;
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  // 2) Carrega o perfil quando o usuário muda — FORA do callback de auth (sem deadlock).
  //    Failsafe: nunca deixa profileLoading preso por mais de 8s.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);

    const failsafe = setTimeout(() => {
      if (active) setProfileLoading(false);
    }, 8000);

    (async () => {
      try {
        if (user) await ensureProfile(user);
        const loadedProfile = await loadProfile(uid);
        if (active) setProfile(loadedProfile);
      } catch (error) {
        console.error('Falha ao carregar perfil:', error);
        if (active) setProfile(null);
      } finally {
        if (active) setProfileLoading(false);
        clearTimeout(failsafe);
      }
    })();

    return () => {
      active = false;
      clearTimeout(failsafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const signUp = async (email: string, password: string, nomeFazenda?: string, metadata?: Record<string, string>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          ...(nomeFazenda ? { nome_fazenda: nomeFazenda } : {}),
          ...metadata,
        },
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