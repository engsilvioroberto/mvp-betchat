import { useState, useEffect } from 'react';
import { api, formatBRL, statusLabel } from '../api';
import type { Bet as BetType, Player as PlayerType, Aposta as ApostaType, OddsItem as OddsItemType } from '../api';

interface Props {
  betId: number;
  grupoId: number;
  grupoNome: string;
  player: PlayerType | null;
  onBack: () => void;
  onViewResult: (betId: number) => void;
}

export default function BetPage({ betId, grupoNome, player, onBack, onViewResult }: Props) {
  const [bet, setBet] = useState<BetType | null>(null);
  const [apostas, setApostas] = useState<ApostaType[]>([]);
  const [odds, setOdds] = useState<OddsItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [palpite, setPalpite] = useState('');
  const [valorAposta, setValorAposta] = useState('5');
  const [showRevelar, setShowRevelar] = useState(false);
  const [valorReal, setValorReal] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    const [b, a] = await Promise.all([
      api<BetType>(`/bets/${betId}`),
      api<ApostaType[]>(`/bets/${betId}/apostas`),
    ]);
    setBet(b);
    setApostas(a);

    if (b.status === 'aberta') {
      try {
        const o = await api<{ odds: OddsItemType[]; total_pool: number }>(`/bets/${betId}/odds`);
        setOdds(o.odds);
      } catch { /* no bets yet */ }
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [betId]);

  async function handleApostar() {
    setError('');
    setSuccess('');
    if (!player) { setError('Selecione um jogador primeiro'); return; }
    const val = parseFloat(valorAposta);
    const palp = parseFloat(palpite);
    if (isNaN(val) || val <= 0) { setError('Valor da aposta inválido'); return; }
    if (isNaN(palp)) { setError('Palpite inválido'); return; }
    if (val > player.saldo) { setError(`Saldo insuficiente. Você tem ${formatBRL(player.saldo)}`); return; }

    try {
      await api<ApostaType>(`/bets/${betId}/apostar`, {
        method: 'POST',
        body: JSON.stringify({ player_id: player.id, valor_aposta: val, palpite: palp }),
      });
      setSuccess('✅ Aposta registrada!');
      setPalpite('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleFechar() {
    await api<BetType>(`/bets/${betId}/fechar`, { method: 'POST' });
    load();
  }

  async function handleRevelar() {
    setError('');
    const vr = parseFloat(valorReal);
    if (isNaN(vr)) { setError('Valor real inválido'); return; }
    try {
      await api(`/bets/${betId}/revelar?valor_real=${vr}`, { method: 'POST' });
      setShowRevelar(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) return <div className="loading">Carregando...</div>;
  if (!bet) return <div className="loading">Bet não encontrada</div>;

  const minhaAposta = apostas.find(a => a.player_id === player?.id);
  const totalPool = bet.pool_total + bet.pool_acumulado;

  return (
    <div>
      <div className="header">
        <div className="header-row">
          <button className="back-btn" onClick={onBack}>←</button>
          <div style={{ flex: 1 }}>
            <h1>🎲 Rodada</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{grupoNome}</p>
          </div>
          <span className={`badge ${
            bet.status === 'aberta' ? 'badge-green' :
            bet.status === 'fechada' ? 'badge-yellow' : 'badge-blue'
          }`}>
            {statusLabel(bet.status)}
          </span>
        </div>
      </div>

      <div className="content">
        {/* Pergunta */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 500 }}>{bet.pergunta}</h3>
          {bet.status !== 'aberta' && bet.valor_real !== null && (
            <div className="card-row">
              <span>🎯 Valor real</span>
              <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--brand-hover)' }}>{bet.valor_real}</span>
            </div>
          )}
        </div>

        {/* Pool info */}
        <div className="status-bar">
          <div className="status-item">
            <div className="value">{formatBRL(bet.pool_total)}</div>
            <div className="label">Apostas</div>
          </div>
          {bet.pool_acumulado > 0 && (
            <div className="status-item">
              <div className="value warning">{formatBRL(bet.pool_acumulado)}</div>
              <div className="label">Acumulado</div>
            </div>
          )}
          <div className="status-item">
            <div className="value">{apostas.length}</div>
            <div className="label">Apostadores</div>
          </div>
          <div className="status-item">
            <div className="value">{(bet.margem * 100).toFixed(0)}%</div>
            <div className="label">Margem</div>
          </div>
          {totalPool > bet.pool_total && (
            <div className="status-item">
              <div className="value accent" style={{ fontSize: '0.95rem' }}>
                {formatBRL(totalPool)}
              </div>
              <div className="label">Pool total</div>
            </div>
          )}
        </div>

        {/* Odds */}
        {bet.status === 'aberta' && odds.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>📊 Odds</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-quaternary)' }}>tempo real</span>
            </div>
            <div className="odds-grid">
              {odds.map(o => (
                <div key={o.player_id} className="odds-chip" title={`${o.player_nome}: ${o.palpite}`}>
                  {o.player_nome} R${o.aposta} → {o.odd_estimada.toFixed(1)}×
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulário de aposta */}
        {bet.status === 'aberta' && player && (
          <div className="card slide-up">
            {minhaAposta ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: '1rem' }}>✅</span>
                  <span style={{ fontWeight: 500 }}>Você já apostou!</span>
                </div>
                <div className="card-row">
                  <span style={{ color: 'var(--text-tertiary)' }}>Palpite</span>
                  <span style={{ fontWeight: 500 }}>{minhaAposta.palpite}</span>
                </div>
                <div className="card-row">
                  <span style={{ color: 'var(--text-tertiary)' }}>Valor</span>
                  <span style={{ fontWeight: 500 }}>{formatBRL(minhaAposta.valor_aposta)}</span>
                </div>
              </>
            ) : (
              <>
                <h3>✍️ Fazer aposta</h3>
                <div className="input-group">
                  <label>Seu palpite</label>
                  <input className="input" type="number" placeholder="Ex: 2500" value={palpite}
                    onChange={e => setPalpite(e.target.value)} autoFocus />
                </div>
                <div className="input-group">
                  <label>Valor (R$)</label>
                  <input className="input" type="number" min="1" step="1" placeholder="Ex: 5"
                    value={valorAposta} onChange={e => setValorAposta(e.target.value)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  <span>Saldo: <strong style={{ color: 'var(--text-primary)' }}>{formatBRL(player.saldo)}</strong></span>
                  {parseFloat(valorAposta) > 0 && (
                    <span>Após: <strong style={{ color: player.saldo - parseFloat(valorAposta) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {formatBRL(player.saldo - parseFloat(valorAposta))}
                    </strong></span>
                  )}
                </div>
                <button className="btn btn-primary" onClick={handleApostar}
                  disabled={!palpite || !valorAposta || parseFloat(valorAposta) > player.saldo}>
                  🚀 Apostar
                </button>
              </>
            )}
          </div>
        )}

        {bet.status === 'aberta' && !player && (
          <div className="card">
            <div className="empty" style={{ padding: 16 }}>
              <div className="empty-icon" style={{ fontSize: '2rem' }}>👤</div>
              <h3>Selecione um jogador</h3>
              <p style={{ fontSize: '0.85rem', marginBottom: 8 }}>Volte ao grupo e escolha seu nome</p>
              <button className="btn btn-secondary" onClick={onBack} style={{ width: '100%' }}>
                ← Voltar ao grupo
              </button>
            </div>
          </div>
        )}

        {bet.status === 'aberta' && bet.pool_acumulado > 0 && (
          <div className="info-card warning">
            <span>📦</span>
            <div>
              <strong style={{ color: 'var(--warning)' }}>{formatBRL(bet.pool_acumulado)} acumulados</strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Será somado ao pool da rodada</p>
            </div>
          </div>
        )}

        {/* Admin panel */}
        {player && (
          <div className="card">
            <h3>⚙️ Admin</h3>
            {bet.status === 'aberta' && (
              <button className="btn btn-secondary" onClick={handleFechar} style={{ width: '100%' }}>
                🔒 Fechar Apostas
              </button>
            )}
            {bet.status === 'fechada' && (
              <>
                <button className="btn btn-primary" onClick={() => setShowRevelar(!showRevelar)} style={{ width: '100%' }}>
                  🎯 Revelar Resultado
                </button>
                {showRevelar && (
                  <div className="slide-up" style={{ marginTop: 12 }}>
                    <div className="input-group">
                      <label>Qual o valor real?</label>
                      <input className="input" type="number" placeholder="Ex: 2500" value={valorReal}
                        onChange={e => setValorReal(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleRevelar()} autoFocus />
                    </div>
                    <button className="btn btn-primary" onClick={handleRevelar} style={{ width: '100%' }}>
                      Calcular e Distribuir 🔄
                    </button>
                  </div>
                )}
              </>
            )}
            {bet.status === 'apurada' && (
              <button className="btn btn-primary" onClick={() => onViewResult(betId)} style={{ width: '100%' }}>
                📊 Ver Resultado
              </button>
            )}
          </div>
        )}

        {/* Apostas list */}
        {apostas.length > 0 && (
          <div className="card">
            <h3>📋 Apostas ({apostas.length})</h3>
            {apostas.map(a => (
              <div key={a.id} className="card-row">
                <span>Jogador #{a.player_id}</span>
                <span style={{ fontWeight: 500 }}>{formatBRL(a.valor_aposta)} → {a.palpite}</span>
              </div>
            ))}
          </div>
        )}

        {error && <div className="toast error" onClick={() => setError('')}>{error}</div>}
        {success && <div className="toast success" onClick={() => setSuccess('')}>{success}</div>}
      </div>
    </div>
  );
}