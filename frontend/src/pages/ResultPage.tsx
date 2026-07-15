import { useState, useEffect } from 'react';
import { api, formatBRL } from '../api';
import type { Resultado } from '../api';

interface Props {
  betId: number;
  grupoId: number;
  grupoNome: string;
  onBack: () => void;
}

export default function ResultPage({ betId, grupoNome, onBack }: Props) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Resultado>(`/bets/${betId}/resultados`)
      .then(setResultado)
      .finally(() => setLoading(false));
  }, [betId]);

  if (loading) return <div className="loading">Carregando...</div>;
  if (!resultado) return <div className="loading">Resultado não encontrado</div>;

  const totalGanho = resultado.resultados.reduce((s, r) => s + r.premio, 0);

  return (
    <div>
      <div className="header">
        <div className="header-row">
          <button className="back-btn" onClick={onBack}>←</button>
          <div style={{ flex: 1 }}>
            <h1>📊 Resultado</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{grupoNome}</p>
          </div>
        </div>
      </div>

      <div className="content">
        {/* Pergunta + valor real */}
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 500, marginBottom: 4 }}>{resultado.pergunta}</h3>
          <div className="card-row" style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 8, paddingTop: 12 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>🎯 Valor real</span>
            <span style={{ fontWeight: 700, fontSize: '1.3rem', color: 'var(--brand-hover)' }}>{resultado.valor_real}</span>
          </div>
          <div className="card-row" style={{ paddingTop: 4 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>📐 Margem</span>
            <span>{(resultado.margem * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Pool breakdown */}
        <div className="card">
          <h3>💰 Distribuição</h3>
          <div className="card-row">
            <span>Pool arrecadado</span>
            <span style={{ fontWeight: 500 }}>{formatBRL(resultado.pool_total)}</span>
          </div>
          {resultado.pool_acumulado_antes > 0.01 && (
            <div className="card-row">
              <span>📦 Acumulado</span>
              <span style={{ fontWeight: 500, color: 'var(--warning)' }}>{formatBRL(resultado.pool_acumulado_antes)}</span>
            </div>
          )}
          <div className="card-row" style={{ fontWeight: 600, borderTop: '1px solid var(--border-strong)', paddingTop: 12, marginTop: 4 }}>
            <span>Pool bruto</span>
            <span>{formatBRL(resultado.pool_total + resultado.pool_acumulado_antes)}</span>
          </div>
          <div className="card-row">
            <span>🏦 Taxa (10%)</span>
            <span style={{ color: 'var(--danger)' }}>−{formatBRL(resultado.taxa)}</span>
          </div>
          <div className="card-row" style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--success)' }}>
            <span>💰 Distribuído</span>
            <span>{formatBRL(resultado.pool_liquido)}</span>
          </div>
        </div>

        {/* Acumulado */}
        {resultado.saldo_acumulado > 0.01 && (
          <div className="info-card warning">
            <span style={{ fontSize: '1.2rem' }}>📦</span>
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'var(--warning)' }}>{formatBRL(resultado.saldo_acumulado)} acumulados</strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                Não foi totalmente distribuído — vai para a próxima rodada!
              </p>
            </div>
          </div>
        )}

        {resultado.saldo_acumulado <= 0.01 && resultado.resultados.length > 0 && (
          <div className="info-card success">
            <span>✅</span>
            <div>
              <strong style={{ color: 'var(--success)' }}>Pool totalmente distribuído!</strong>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>Nada acumulado</p>
            </div>
          </div>
        )}

        {/* Ranking */}
        <h3 style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          🏆 Ranking
        </h3>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {resultado.resultados.length === 0 ? (
            <div className="empty" style={{ padding: 24 }}>
              <div className="empty-icon">😅</div>
              <h3>Ninguém acertou!</h3>
              <p>Todos os palpites ficaram fora da margem. Acumula tudo!</p>
            </div>
          ) : (
            resultado.resultados.map((r, i) => {
              const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
              const ganhou = r.premio > r.aposta;
              return (
                <div key={r.player_id} className="result-item">
                  <div className={`result-rank ${rankClass}`}>{i + 1}</div>
                  <div className="result-info">
                    <div className="result-nome">
                      {r.player_nome}
                      <span className="odd-tag">{r.odd.toFixed(2)}×</span>
                    </div>
                    <div className="result-detail">
                      {formatBRL(r.aposta)} · Palpite: {r.palpite}
                      {r.erro !== null && r.erro !== undefined && (
                        <> · Erro: {(r.erro * 100).toFixed(1)}%</>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`result-premio ${r.premio > 0 ? 'positive' : 'zero'}`}>
                      {r.premio > 0 ? formatBRL(r.premio) : '—'}
                    </div>
                    {r.premio > 0 && (
                      <div style={{ fontSize: '0.7rem', color: ganhou ? 'var(--success)' : 'var(--text-tertiary)' }}>
                        {ganhou ? '+' : ''}{formatBRL(r.premio - r.aposta)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="card" style={{ textAlign: 'center', padding: '12px 16px' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-quaternary)' }}>
            Distribuído: {formatBRL(totalGanho)} de {formatBRL(resultado.pool_liquido)}
          </p>
        </div>

        <button className="btn btn-secondary" onClick={onBack} style={{ width: '100%' }}>
          ← Voltar ao grupo
        </button>
      </div>
    </div>
  );
}