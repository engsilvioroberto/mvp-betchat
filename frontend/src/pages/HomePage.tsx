import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Group } from '../api';

interface Props {
  onSelectGroup: (id: number, nome: string) => void;
}

export default function HomePage({ onSelectGroup }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [nome, setNome] = useState('');

  useEffect(() => {
    api<Group[]>('/grupos')
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!nome.trim()) return;
    const g = await api<Group>('/grupos', {
      method: 'POST',
      body: JSON.stringify({ nome: nome.trim() }),
    });
    setGroups([g, ...groups]);
    setNome('');
    setShowCreate(false);
    onSelectGroup(g.id, g.nome);
  }

  if (loading) return <div className="loading">Carregando...</div>;

  return (
    <div>
      <div className="header">
        <h1>🎲 Betchat</h1>
        <p>Mercado de previsão do seu grupo</p>
      </div>

      <div className="content">
        <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Cancelar' : '➕ Novo Grupo'}
        </button>

        {showCreate && (
          <div className="card slide-up">
            <h3>Criar grupo</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
              Crie um grupo para começar a fazer apostas com seus amigos
            </p>
            <div className="input-group">
              <label>Nome do grupo</label>
              <input
                className="input"
                placeholder="Ex: Amigos do Zé"
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" onClick={handleCreate} disabled={!nome.trim()}>
              Criar Grupo 🚀
            </button>
          </div>
        )}

        {groups.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🏟️</div>
            <h3>Nenhum grupo ainda</h3>
            <p>Crie um grupo para começar a apostar</p>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              Seus grupos ({groups.length})
            </h3>
            {groups.map(g => (
              <div
                key={g.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectGroup(g.id, g.nome)}
              >
                <div className="card-row">
                  <span style={{ fontSize: '1.1rem' }}>👥 <strong>{g.nome}</strong></span>
                  <span className="badge badge-green" style={{ fontSize: '0.85rem' }}>Entrar →</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}