const API = '';

export interface Group {
  id: number;
  nome: string;
  created_at: string;
}

export interface Player {
  id: number;
  nome: string;
  saldo: number;
  grupo_id: number;
  created_at: string;
}

export interface Bet {
  id: number;
  grupo_id: number;
  pergunta: string;
  margem: number;
  valor_real: number | null;
  status: string;
  data_abertura: string;
  data_fechamento: string | null;
  pool_total: number;
  pool_acumulado: number;
  created_at: string;
}

export interface Aposta {
  id: number;
  bet_id: number;
  player_id: number;
  valor_aposta: number;
  palpite: number;
  peso: number | null;
  premio: number | null;
  created_at: string;
}

export interface ResultadoItem {
  player_id: number;
  player_nome: string;
  aposta: number;
  palpite: number;
  erro: number | null;
  precisao: number | null;
  peso: number | null;
  premio: number;
  odd: number;
}

export interface Resultado {
  bet_id: number;
  pergunta: string;
  valor_real: number;
  margem: number;
  pool_total: number;
  pool_acumulado_antes: number;
  taxa: number;
  pool_liquido: number;
  saldo_acumulado: number;
  resultados: ResultadoItem[];
}

export interface SimulateResult {
  grupo_id: number;
  grupo_nome: string;
  bet_id: number;
  bet_pergunta: string;
  valor_alvo: number;
  margem: number;
  pool_total: number;
  players: { id: number; nome: string; saldo: number }[];
  apostas: { player_id: number; player_nome: string; valor_aposta: number; palpite: number }[];
  total_players: number;
  total_participants: number;
}

export interface TickItem {
  player_id: number;
  player_nome: string;
  aposta: number;
  palpite: number;
  erro: number;
  precisao: number;
  peso: number;
  premio_estimado: number;
  odd_estimada: number;
}

export interface TickResult {
  bet_id: number;
  valor_atual: number;
  valor_alvo: number;
  progresso: number;
  pool_liquido: number;
  items: TickItem[];
}

export interface Transaction {
  id: number;
  player_id: number;
  bet_id: number | null;
  tipo: string;
  valor: number;
  created_at: string;
}

export interface OddsItem {
  player_id: number;
  player_nome: string;
  palpite: number;
  aposta: number;
  odd_estimada: number;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Erro na requisição');
  }
  return res.json();
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    aberta: '🟢 Aberta',
    fechada: '🟡 Fechada',
    apurada: '🔵 Apurada',
  };
  return map[status] || status;
}