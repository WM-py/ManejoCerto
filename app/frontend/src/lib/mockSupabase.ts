/**
 * Cliente Supabase SIMULADO para o MODO PREVIEW (VITE_PREVIEW_MOCK=true).
 * Implementa o subconjunto da API usada pelo app (auth + query builder encadeável)
 * sobre um banco em memória. Código descartável — ver mockData.ts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildMockDB, MOCK_USER } from './mockData';

type Row = Record<string, any>;
type Filter = { type: 'eq' | 'neq' | 'gte' | 'lte' | 'gt' | 'lt' | 'in' | 'is'; col: string; val: any };

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`);

class MockQuery implements PromiseLike<any> {
  private filters: Filter[] = [];
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private headOnly = false;
  private wantCount = false;

  constructor(private db: Record<string, Row[]>, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op !== 'insert' && this.op !== 'update' && this.op !== 'delete') this.op = 'select';
    if (opts?.head) this.headOnly = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  insert(payload: any) { this.op = 'insert'; this.payload = payload; return this; }
  update(payload: any) { this.op = 'update'; this.payload = payload; return this; }
  delete() { this.op = 'delete'; return this; }

  eq(col: string, val: any) { this.filters.push({ type: 'eq', col, val }); return this; }
  neq(col: string, val: any) { this.filters.push({ type: 'neq', col, val }); return this; }
  gte(col: string, val: any) { this.filters.push({ type: 'gte', col, val }); return this; }
  lte(col: string, val: any) { this.filters.push({ type: 'lte', col, val }); return this; }
  gt(col: string, val: any) { this.filters.push({ type: 'gt', col, val }); return this; }
  lt(col: string, val: any) { this.filters.push({ type: 'lt', col, val }); return this; }
  in(col: string, vals: any[]) { this.filters.push({ type: 'in', col, val: vals }); return this; }
  is(col: string, val: any) { this.filters.push({ type: 'is', col, val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      const v = row[f.col];
      switch (f.type) {
        case 'eq': return v === f.val;
        case 'neq': return v !== f.val;
        case 'gte': return v >= f.val;
        case 'lte': return v <= f.val;
        case 'gt': return v > f.val;
        case 'lt': return v < f.val;
        case 'in': return (f.val as any[]).includes(v);
        case 'is': return f.val === null ? (v === null || v === undefined) : v === f.val;
        default: return true;
      }
    });
  }

  private ensureTable(): Row[] {
    if (!this.db[this.table]) this.db[this.table] = [];
    return this.db[this.table];
  }

  private run(): { data: any; error: any; count: number | null } {
    const table = this.ensureTable();
    let resultRows: Row[] = [];

    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      resultRows = items.map((it) => ({ id: it.id ?? uid(), created_at: new Date().toISOString(), ...it }));
      table.push(...resultRows);
    } else if (this.op === 'update') {
      resultRows = table.filter((r) => this.matches(r));
      resultRows.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      resultRows = table.filter((r) => this.matches(r));
      const remove = new Set(resultRows);
      this.db[this.table] = table.filter((r) => !remove.has(r));
    } else {
      resultRows = table.filter((r) => this.matches(r));
    }

    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      resultRows = [...resultRows].sort((a, b) => {
        if (a[col] < b[col]) return asc ? -1 : 1;
        if (a[col] > b[col]) return asc ? 1 : -1;
        return 0;
      });
    }
    if (this.limitN != null) resultRows = resultRows.slice(0, this.limitN);

    const count = this.wantCount ? resultRows.length : null;
    if (this.headOnly) return { data: null, error: null, count };

    if (this.mode === 'single') {
      if (resultRows.length === 0) return { data: null, error: { message: 'No rows found', code: 'PGRST116' }, count };
      return { data: resultRows[0], error: null, count };
    }
    if (this.mode === 'maybe') {
      return { data: resultRows[0] ?? null, error: null, count };
    }
    return { data: resultRows, error: null, count };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    } catch (err) {
      return Promise.resolve({ data: null, error: err, count: null }).then(onfulfilled, onrejected);
    }
  }
}

export function createMockClient() {
  const db = buildMockDB();
  const session = { user: MOCK_USER, access_token: 'mock-token', expires_at: Date.now() / 1000 + 3600 };

  return {
    from: (table: string) => new MockQuery(db, table),
    // RPC simulada: cobre as funções chamadas pelo app (ex.: mc_is_admin no menu).
    rpc: async (fn: string) => {
      switch (fn) {
        case 'mc_is_admin':
          return { data: true, error: null };
        case 'mc_has_active_access':
          return { data: true, error: null };
        // Sprint 0: no preview, criar_lote retorna um id fake; os demais são no-op.
        case 'app_34b6ab49dc_criar_lote_com_animais':
          return { data: uid(), error: null };
        default:
          return { data: null, error: null };
      }
    },
    storage: {
      from: () => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        remove: async () => ({ data: [], error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: 'https://example.com/comprovante-demo.pdf' }, error: null }),
      }),
    },
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        setTimeout(() => cb('SIGNED_IN', session), 0);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signInWithPassword: async () => ({ data: { session, user: MOCK_USER }, error: null }),
      signUp: async () => ({ data: { session, user: MOCK_USER }, error: null }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: { user: MOCK_USER }, error: null }),
    },
  };
}
