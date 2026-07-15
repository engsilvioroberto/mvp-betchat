import { useState, useRef, useEffect, useCallback } from 'react';
import { api, formatBRL } from '../api';
import type { SimulateResult, TickResult } from '../api';

interface Props {
  onNavigateToGroup: (groupId: number, grupoNome: string) => void;
  onNavigateToBet: (betId: number, grupoId: number, grupoNome: string) => void;
  onSelectPlayer: (playerId: number, grupoId: number) => void;
}

export default function DevPanel({ onNavigateToGroup, onNavigateToBet, onSelectPlayer }: Props) {
  const [open, setOpen] = useState(false);
  const [sim, setSim] = useState<SimulateResult | null>(null);
  const [tick, setTick] = useState<TickResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [duracao, setDuracao] = useState(15); // segundos
  const [numPlayers, setNumPlayers] = useState(10);
  const [numParticipants, setNumParticipants] = useState(8);
  const [betPergunta] = useState('Quantos caracteres serão enviados?');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleGenerate() {
    const result = await api<SimulateResult>('/simulate/generate', {
      method: 'POST',
      body: JSON.stringify({
        grupo_nome: '🔬 Simulação',
        bet_pergunta: betPergunta,
        num_players: numPlayers,
        num_participants: numParticipants,
        margem: 0.20,
      }),
    });
    setSim(result);
    setTick(null);
    setProgresso(0);
    setSelectedPlayerId(null);
  }

  async function handleStartSimulation() {
    if (!sim) return;
    setSimulating(true);
    setProgresso(0);
    startTimeRef.current = Date.now();

    // Primeiro fecha a bet
    await api(`/bets/${sim.bet_id}/fechar`, { method: 'POST' });

    // Timer de tick
    const tickInterval = 100; // ms
    timerRef.current = setInterval(async () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const prog = Math.min(elapsed / duracao, 1);
      setProgresso(prog);

      try {
        const result = await api<TickResult>(
          `/simulate/tick/${sim.bet_id}?progresso=${prog}&valor_alvo=${sim.valor_alvo}`
        );
        setTick(result);
      } catch { /* ignore */ }

      if (prog >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        setSimulating(false);
        setProgresso(1);
        // Auto-revela
        await api(`/bets/${sim.bet_id}/revelar?valor_real=${sim.valor_alvo}`, { method: 'POST' });
        // F5 tick final
        const result = await api<TickResult>(
          `/simulate/tick/${sim.bet_id}?progresso=1&valor_alvo=${sim.valor_alvo}`
        );
        setTick(result);
      }
    }, tickInterval);
  }

  const handleStop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSimulating(false);
  }, []);

  const items = tick?.items || [];
  const selectedPlayer = selectedPlayerId
    ? items.find(i => i.player_id === selectedPlayerId)
    : null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 999,
          width: 48, height: 48, borderRadius: '50%', border: 'none',
          background: 'var(--brand)', color: 'white', fontSize: '1.2rem',
          cursor: 'pointer', boxShadow: 'var(--shadow-md)',
          transition: 'all var(--transition)',
        }}
        onMouseOver={e => (e.currentTarget.style.background = 'var(--brand-hover)')}
        onMouseOut={e => (e.currentTarget.style.background = 'var(--brand)')}
        title="Painel de Desenvolvimento"
      >
        🔬
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-panel)', width: '100%', maxWidth: 520,
        maxHeight: '90vh', borderRadius: '16px 16px 0 0',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border-default)',
        borderBottom: 'none',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--bg-elevated)', color: 'var(--text-primary)',
          padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <strong style={{ fontSize: '0.9rem', letterSpacing: '-0.01em' }}>🔬 Painel Dev</strong>
          <button onClick={() => { setOpen(false); handleStop(); }}
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-sans)' }}>
            ✕ Fechar
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: 'auto', flex: 1, color: 'var(--text-primary)' }}>
          {/* Gerador */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>🎲 Gerar Simulação</h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Jogadores</label>
                <input type="number" min="3" max="25" value={numPlayers}
                  onChange={e => setNumPlayers(parseInt(e.target.value) || 10)}
                  style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', padding: '0 8px' }} />
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Participantes</label>
                <input type="number" min="2" max="25" value={numParticipants}
                  onChange={e => setNumParticipants(parseInt(e.target.value) || 8)}
                  style={{ width: '100%', height: 36, borderRadius: 6, border: '1px solid var(--border-default)', background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', padding: '0 8px' }} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleGenerate} style={{ height: 44 }}>
              🚀 Gerar {numPlayers} jogadores, {numParticipants} apostas
            </button>
          </div>

          {sim && (
            <>
              <div style={{ background: 'var(--brand-light)', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                ✅ Bet #{sim.bet_id} · {sim.total_players} jogadores · {sim.total_participants} apostaram
                · Pool: {formatBRL(sim.pool_total)} · Alvo: {sim.valor_alvo}
                <br />
                <button className="btn btn-small btn-secondary" style={{ marginTop: 6 }}
                  onClick={() => {
                    onNavigateToGroup(sim.grupo_id, sim.grupo_nome);
                    setOpen(false);
                  }}>
                  👥 Ir pro grupo
                </button>
                {' '}
                <button className="btn btn-small btn-secondary"
                  onClick={() => {
                    onNavigateToBet(sim.bet_id, sim.grupo_id, sim.grupo_nome);
                    setOpen(false);
                  }}>
                  🎲 Ir pra bet
                </button>
              </div>

              {/* Simulação */}
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ marginBottom: 8 }}>⏱️ Simular Passagem do Tempo</h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>Duração:</span>
                  <input type="number" min="5" max="120" value={duracao}
                    onChange={e => setDuracao(parseInt(e.target.value) || 15)}
                    style={{ width: 60, height: 32, borderRadius: 6, border: '1px solid #ddd', padding: '0 8px', textAlign: 'center' }}
                    disabled={simulating} />
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>seg</span>
                </div>

                {!simulating ? (
                  progresso === 1 ? (
                    <button className="btn btn-primary" onClick={handleStartSimulation} style={{ height: 44 }}>
                      🔄 Simular novamente
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={handleStartSimulation} style={{ height: 44 }}>
                      ▶️ Iniciar Simulação
                    </button>
                  )
                ) : (
                  <button className="btn btn-danger" onClick={handleStop} style={{ height: 44 }}>
                    ⏹️ Parar
                  </button>
                )}
              </div>

              {/* Barra de progresso */}
              {progresso > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#666', marginBottom: 4 }}>
                    <span>⏱️ {(duracao * (1 - progresso)).toFixed(1)}s restantes</span>
                    <span>{(progresso * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 8, background: '#E0E0E0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progresso * 100}%`, background: progresso >= 1 ? '#4CAF50' : '#FF9800', borderRadius: 4, transition: 'width 0.1s linear' }} />
                  </div>
                  {tick && (
                    <div style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: 4, color: 'var(--text-secondary)' }}>
                      🎯 Valor atual: <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{tick.valor_atual}</strong> / {tick.valor_alvo}
                    </div>
                  )}
                </div>
              )}

              {/* Seletor de jogador */}
              {items.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ marginBottom: 6 }}>👤 Ver como jogador:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {items.map(i => (
                      <button key={i.player_id}
                        className={`btn btn-small ${selectedPlayerId === i.player_id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setSelectedPlayerId(i.player_id);
                          onSelectPlayer(i.player_id, sim.grupo_id);
                        }}
                        style={{ fontSize: '0.75rem', padding: '2px 8px', height: 30 }}>
                        {i.player_nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabela de odds em tempo real */}
              {items.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: 6 }}>
                    📊 Ranking em tempo real
                    {selectedPlayer && (
                      <span style={{ fontWeight: 400, fontSize: '0.85rem', color: '#666', marginLeft: 8 }}>
                        — destacando <strong>{selectedPlayer.player_nome}</strong>
                      </span>
                    )}
                  </h4>
                  <div style={{ maxHeight: 300, overflow: 'auto', borderRadius: 8, border: '1px solid #E0E0E0' }}>
                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#F5F5F5', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>#</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Jogador</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Palpite</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Erro</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Odd</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Prêmio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((i, idx) => {
                          const isSelected = i.player_id === selectedPlayerId;
                          return (
                            <tr key={i.player_id}
                              style={{
                                background: isSelected ? '#E8F5E9' : idx % 2 === 0 ? '#FAFAFA' : 'white',
                                fontWeight: isSelected ? 700 : 400,
                                transition: 'background 0.3s',
                              }}>
                              <td style={{ padding: '4px 8px' }}>{idx + 1}</td>
                              <td style={{ padding: '4px 8px' }}>{i.player_nome}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{i.palpite}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: i.erro > 0.2 ? '#e53935' : '#43A047' }}>
                                {(i.erro * 100).toFixed(1)}%
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: i.odd_estimada >= 1 ? '#388E3C' : '#E65100' }}>
                                {i.odd_estimada.toFixed(2)}×
                              </td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: i.premio_estimado > 0 ? '#388E3C' : '#999' }}>
                                {i.premio_estimado > 0 ? formatBRL(i.premio_estimado) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#999', marginTop: 4 }}>
                    Atualiza a cada 100ms · Odds mudam conforme o valor real se aproxima do alvo
                  </p>
                </div>
              )}

              {/* Botão ver resultado final */}
              {progresso >= 1 && (
                <button className="btn btn-primary" style={{ marginTop: 12 }}
                  onClick={() => {
                    onNavigateToBet(sim.bet_id, sim.grupo_id, sim.grupo_nome);
                    setOpen(false);
                  }}>
                  📊 Ver Resultado Final
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}