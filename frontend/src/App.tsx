import { useState, useCallback } from 'react';
import HomePage from './pages/HomePage';
import GrupoPage from './pages/GrupoPage';
import BetPage from './pages/BetPage';
import ResultPage from './pages/ResultPage';
import DevPanel from './components/DevPanel';
import type { Player } from './api';
import { api } from './api';
import './styles/app.css';

type Screen =
  | { type: 'home' }
  | { type: 'grupo'; id: number; nome: string }
  | { type: 'bet'; id: number; grupoId: number; grupoNome: string }
  | { type: 'resultado'; id: number; grupoId: number; grupoNome: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'home' });
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  const goToGrupo = useCallback((id: number, nome: string) => {
    setScreen({ type: 'grupo', id, nome });
  }, []);

  const goToBet = useCallback((betId: number, grupoId: number, grupoNome: string) => {
    setScreen({ type: 'bet', id: betId, grupoId, grupoNome });
  }, []);

  const goToResultado = useCallback((betId: number, grupoId: number, grupoNome: string) => {
    setScreen({ type: 'resultado', id: betId, grupoId, grupoNome });
  }, []);

  // DevPanel: selecionar jogador de simulação
  const handleDevSelectPlayer = useCallback(async (playerId: number, grupoId: number) => {
    try {
      const p = await api<Player>(`/jogadores/${playerId}`);
      setCurrentPlayer(p);
      localStorage.setItem('betchat_player_' + grupoId, String(p.id));
    } catch { /* ignore */ }
  }, []);

  function renderScreen() {
    switch (screen.type) {
      case 'home':
        return <HomePage onSelectGroup={(id, nome) => goToGrupo(id, nome)} />;

      case 'grupo':
        return (
          <GrupoPage
            groupId={screen.id}
            groupNome={screen.nome}
            currentPlayer={currentPlayer}
            onSetPlayer={setCurrentPlayer}
            onBack={() => setScreen({ type: 'home' })}
            onSelectBet={(betId) => goToBet(betId, screen.id, screen.nome)}
          />
        );

      case 'bet':
        return (
          <BetPage
            betId={screen.id}
            grupoId={screen.grupoId}
            grupoNome={screen.grupoNome}
            player={currentPlayer}
            onBack={() => goToGrupo(screen.grupoId, screen.grupoNome)}
            onViewResult={(betId) => goToResultado(betId, screen.grupoId, screen.grupoNome)}
          />
        );

      case 'resultado':
        return (
          <ResultPage
            betId={screen.id}
            grupoId={screen.grupoId}
            grupoNome={screen.grupoNome}
            onBack={() => goToGrupo(screen.grupoId, screen.grupoNome)}
          />
        );
    }
  }

  return (
    <div className="app">
      {renderScreen()}
      <DevPanel
        onNavigateToGroup={goToGrupo}
        onNavigateToBet={goToBet}
        onSelectPlayer={handleDevSelectPlayer}
      />
    </div>
  );
}