import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, TABLES } from '@/lib/supabase';

/**
 * Garante que o perfil do usuário exista com o nome da fazenda.
 * Roda no client (RLS permite gravar o próprio perfil), então funciona
 * independentemente de o trigger do banco preencher o nome_fazenda.
 */
async function ensureProfile(user: User) {
  const nomeFazendaMeta = (user.user_metadata?.nome_fazenda as string | undefined)?.trim();

  const { data: existing } = await supabase
    .from(TABLES.profiles)
    .select('id, nome_fazenda')
    .eq('id', user.id)
    .maybeSingle();

  // Perfil ausente: cria com o nome da fazenda (ou um padrão).
  if (!existing) {
    await supabase.from(TABLES.profiles).insert({
      id: user.id,
      nome_fazenda: nomeFazendaMeta || 'Minha Fazenda',
    });
    return;
  }

  // Perfil existe mas sem nome e temos o nome no metadata: completa.
  if (!existing.nome_fazenda && nomeFazendaMeta) {
    await supabase.from(TABLES.profiles).update({ nome_fazenda: nomeFazendaMeta }).eq('id', user.id);
  }
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        // Ao confirmar o cadastro / primeiro login, garante o perfil.
        if (event === 'SIGNED_IN' && newSession?.user) {
          ensureProfile(newSession.user).catch(() => {/* silencioso */});
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
      value={{ session, user, loading, signUp, signIn, signOut, resetPassword, updatePassword }}
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