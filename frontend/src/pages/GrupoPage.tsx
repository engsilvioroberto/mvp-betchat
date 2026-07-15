import { useState, useEffect } from 'react';
import { api, formatBRL, statusLabel } from '../api';
import type { Bet, Player } from '../api';

interface Props {
  groupId: number;
  groupNome: string;
  currentPlayer: Player | null;
  onSetPlayer: (p: Player) => void;
  onBack: () => void;
  onSelectBet: (betId: number) => void;
}

export default function GrupoPage({ groupId, groupNome, currentPlayer, onSetPlayer, onBack, onSelectBet }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBet, setShowCreateBet] = useState(false);
  const [showNewPlayer, setShowNewPlayer] = useState(false);
  const [betPergunta, setBetPergunta] = useState('');
  const [betMargem, setBetMargem] = useState('20');
  const [playerNome, setPlayerNome] = useState('');
  const [betError, setBetError] = useState('');

  async function load() {
    setLoading(true);
    const [p, b] = await Promise.all([
      api<Player[]>('/jogadores?grupo_id=' + groupId),
      api<Bet[]>('/bets?grupo_id=' + groupId),
    ]);
    setPlayers(p);
    setBets(b);
    setLoading(false);
  }

  useEffect(() => { load(); }, [groupId]);

  useEffect(() => {
    if (currentPlayer && currentPlayer.grupo_id === groupId) {
      // already selected
    } else if (players.length > 0) {
      const stored = localStorage.getItem('betchat_player_' + groupId);
      if (stored) {
        const found = players.find(p => p.id === parseInt(stored));
        if (found) { onSetPlayer(found); return; }
      }
    }
  }, [players, groupId]);

  async function handleCreateBet() {
    if (!betPergunta.trim()) return;
    setBetError('');
    const margem = parseFloat(betMargem) / 100;
    try {
      const bet = await api<Bet>('/bets', {
        method: 'POST',
        body: JSON.stringify({ grupo_id: groupId, pergunta: betPergunta.trim(), margem }),
      });
      setBets([bet, ...bets]);
      setBetPergunta('');
      setShowCreateBet(false);
    } catch (e: any) {
      setBetError(e.message);
      setTimeout(() => setBetError(''), 5000);
    }
  }

  async function handleNewPlayer() {
    if (!playerNome.trim()) return;
    const p = await api<Player>('/jogadores', {
      method: 'POST',
      body: JSON.stringify({ nome: playerNome.trim(), grupo_id: groupId }),
    });
    setPlayers([...players, p]);
    onSetPlayer(p);
    localStorage.setItem('betchat_player_' + groupId, String(p.id));
    setPlayerNome('');
    setShowNewPlayer(false);
  }

  function selectPlayer(p: Player) {
    onSetPlayer(p);
    localStorage.setItem('betchat_player_' + groupId, String(p.id));
  }

  const poolTotal = bets.reduce((s, b) => s + b.pool_total, 0);
  const poolAcumulado = bets.reduce((s, b) => s + b.pool_acumulado, 0);

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div>
      <div className="header">
        <div className="header-row">
          <button className="back-btn" onClick={onBack}>←</button>
          <div style={{ flex: 1 }}>
            <h1>👥 {groupNome}</h1>
            {currentPlayer && (
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                {currentPlayer.nome} · <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatBRL(currentPlayer.saldo)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="content">
        <div className="status-bar">
          <div className="status-item">
            <div className="value">{formatBRL(poolTotal)}</div>
            <div className="label">Pool</div>
          </div>
          <div className="status-item">
            <div className={'value' + (poolAcumulado > 0 ? ' warning' : '')}>
              {formatBRL(poolAcumulado)}
            </div>
            <div className="label">Acumulado</div>
          </div>
          <div className="status-item">
            <div className="value">{players.length}</div>
            <div className="label">Jogadores</div>
          </div>
          <div className="status-item">
            <div className="value">{bets.length}</div>
            <div className="label">Rodadas</div>
          </div>
        </div>

        <div className="card">
          <h3>🎮 Quem está jogando?</h3>
          {players.length === 0 ? (
            <>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '8px 0 12px' }}>
                Nenhum jogador ainda. Crie seu personagem!
              </p>
              <button className="btn btn-primary" onClick={() => setShowNewPlayer(true)}>
                Criar Jogador 🚀
              </button>
            </>
          ) : (
            <>
              <div className="player-row">
                {players.map(p => (
                  <button
                    key={p.id}
                    className={'player-chip' + (currentPlayer?.id === p.id ? ' active' : '')}
                    onClick={() => selectPlayer(p)}
                  >
                    {p.nome} {formatBRL(p.saldo)}
                  </button>
                ))}
                <button className="player-chip" onClick={() => setShowNewPlayer(true)}>
                  + Novo
                </button>
              </div>
            </>
          )}
          {showNewPlayer && (
            <div className="slide-up" style={{ marginTop: 12 }}>
              <div className="input-group">
                <label>Seu nome</label>
                <input className="input" placeholder="Ex: Silvio" value={playerNome}
                  onChange={e => setPlayerNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNewPlayer()} autoFocus />
              </div>
              <button className="btn btn-primary" onClick={handleNewPlayer}>Entrar 🚀</button>
            </div>
          )}
        </div>

        {currentPlayer && (
          <>
            {bets.some(b => b.status === 'aberta') && (
              <div className="status-msg info">
                🟢 Já existe uma rodada aberta! Encerre-a antes de criar uma nova.
              </div>
            )}

            <button className="btn btn-primary" onClick={() => {
              if (bets.some(b => b.status === 'aberta')) {
                setBetError('Há uma rodada aberta! Feche-a primeiro.');
                setTimeout(() => setBetError(''), 5000);
                return;
              }
              setShowCreateBet(!showCreateBet);
            }}>
              {showCreateBet ? '✕ Cancelar' : '🎲 Nova Rodada'}
            </button>

            {betError && (
              <div className="toast error" style={{ position: 'static', transform: 'none' }}>{betError}</div>
            )}

            {showCreateBet && (
              <div className="card slide-up">
                <h3>Nova Rodada</h3>
                {poolAcumulado > 0 && (
                  <div className="info-card warning">
                    📦 Saldo acumulado: {formatBRL(poolAcumulado)} — será adicionado ao pool!
                  </div>
                )}
                <div className="input-group">
                  <label>Pergunta</label>
                  <input className="input" placeholder="Ex: Quantos caracteres serão enviados?"
                    value={betPergunta} onChange={e => setBetPergunta(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Margem de tolerância (%)</label>
                  <input className="input" type="number" min="1" max="100"
                    value={betMargem} onChange={e => setBetMargem(e.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={handleCreateBet} disabled={!betPergunta.trim()}>
                  Criar Rodada 🚀
                </button>
              </div>
            )}
          </>
        )}

        <h3 style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Rodadas ({bets.length})
        </h3>

        {bets.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎲</div>
            <h3>Nenhuma rodada ainda</h3>
            <p>Crie a primeira rodada de apostas</p>
          </div>
        ) : (
          bets.map(b => (
            <div
              key={b.id}
              className={'card clickable' + (b.status === 'aberta' ? ' bet-active' : '')}
              onClick={() => onSelectBet(b.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, flex: 1, fontSize: '0.9rem' }}>{b.pergunta}</span>
                <span className={'badge ' + (
                  b.status === 'aberta' ? 'badge-green' :
                  b.status === 'fechada' ? 'badge-yellow' : 'badge-blue'
                )}>
                  {statusLabel(b.status)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--muted)' }}>
                <span>💰 {formatBRL(b.pool_total)}</span>
                {b.pool_acumulado > 0 && <span>📦 {formatBRL(b.pool_acumulado)}</span>}
                <span>🎯 {(b.margem * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}