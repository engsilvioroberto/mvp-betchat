# SPEC: Betchat

## Stack
- **Backend**: Python 3.13+ (FastAPI + Uvicorn)
- **Banco**: SQLite (SQLAlchemy + aiosqlite)
- **Frontend**: React 18 + TypeScript + Vite
- **PWA**: `public/manifest.json` manual
- **Design**: Duolingo-Style (cor primaria: `#4CAF50` — verde)
- **Ícones**: Emojis + Lucide SVG
- **Teste**: Cloudflare Tunnel (`cloudflared`)
- **Vite**: `server.allowedHosts: true` (obrigatório para tunnel)

---

## Modelo de Dados

### groups
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | Auto increment |
| nome | TEXT | Nome do grupo (ex: "Amigos do Zé") |
| created_at | TIMESTAMP | Data de criação |

### players
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | Auto increment |
| nome | TEXT | Nome de exibição |
| saldo | REAL | Saldo total (R$) |
| grupo_id | INTEGER FK → groups.id | Grupo ao qual pertence |
| created_at | TIMESTAMP | Data de criação |

### bets
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | Auto increment |
| grupo_id | INTEGER FK → groups.id | Grupo dono da bet |
| pergunta | TEXT | Ex: "Quantos caracteres serão enviados?" |
| margem | REAL | % de tolerância (ex: 0.20 = 20%) |
| valor_real | REAL | NULL até admin revelar |
| status | TEXT | `aberta` → `fechada` → `apurada` |
| data_abertura | TIMESTAMP | Início das apostas |
| data_fechamento | TIMESTAMP | Fim das apostas |
| pool_total | REAL | Total arrecadado na rodada |
| pool_acumulado | REAL | Saldo acumulado de rodadas anteriores |
| created_at | TIMESTAMP | |

### bets_participants (apostas individuais)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | Auto increment |
| bet_id | INTEGER FK → bets.id | |
| player_id | INTEGER FK → players.id | |
| valor_aposta | REAL | Quanto o jogador apostou (R$) |
| palpite | REAL | O palpite numérico |
| peso | REAL | Calculado após apuração (aposta × precisão²) |
| premio | REAL | Prêmio recebido (NULL até apurada) |
| created_at | TIMESTAMP | |

### transactions
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | INTEGER PK | Auto increment |
| player_id | INTEGER FK → players.id | |
| bet_id | INTEGER FK → bets.id | NULL para operações não-bet |
| tipo | TEXT | `aposta`, `premio`, `entrada`, `acumulado` |
| valor | REAL | Positivo = crédito, negativo = débito |
| created_at | TIMESTAMP | |

---

## Rotas da API

### Grupos
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/grupos` | Listar grupos do usuário |
| POST | `/api/grupos` | Criar novo grupo |
| GET | `/api/grupos/{id}` | Detalhe do grupo + players + bets recentes |

### Jogadores
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/jogadores/{id}` | Saldo + histórico de transações |
| POST | `/api/jogadores` | Criar jogador em um grupo |

### Bets
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/bets` | Listar bets (filtro por grupo) |
| GET | `/api/bets/{id}` | Detalhe da bet + palpites + odds |
| POST | `/api/bets` | Criar bet (admin define pergunta, margem, janela) |
| POST | `/api/bets/{id}/apostar` | Fazer aposta (palpite + valor) |
| POST | `/api/bets/{id}/fechar` | Fechar janela de apostas (admin) |
| POST | `/api/bets/{id}/revelar` | Revelar valor real + calcular resultados |
| GET | `/api/bets/{id}/resultados` | Ranking final da rodada |

### Health
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Ping |

---

## Algoritmo de Apuração (endpoint `POST /api/bets/{id}/revelar`)

```
pool_liquido = (pool_total + pool_acumulado) × 0.9  (taxa 10%)
taxa = (pool_total + pool_acumulado) × 0.1

Para cada participante i:
  erro_i = |palpite_i - valor_real| / valor_real
  se erro_i <= margem:
    precisao_i = 1 - erro_i / margem
    peso_i = aposta_i × precisao_i²
  senão:
    peso_i = 0

soma_pesos = soma de todos os pesos_i

Se soma_pesos > 0:
  Para cada participante com peso_i > 0:
    premio_i = (peso_i / soma_pesos) × pool_liquido
  saldo_acumular = pool_liquido - soma(premios)
Senão:
  saldo_acumular = pool_liquido (ninguém acertou, tudo acumula)

Atualizar bets.pool_acumulado = saldo_acumular
Status da bet → "apurada"
```

---

## Componentes do Frontend

| Componente | Rota | Descrição |
|------------|------|-----------|
| **HomePage** | `/` | Lista de grupos do jogador. Botão "Criar grupo" |
| **GrupoPage** | `/grupo/:id` | Timeline de bets, saldo do jogador, pool acumulado do grupo. Botão "Nova bet" (admin) |
| **BetPage** | `/bet/:id` | Detalhe da bet: pergunta, janela, palpites, **odds dinâmicas**, formulário de aposta |
| **ApostarForm** | *(dentro de BetPage)* | Input: valor da aposta (R$), input: palpite, botão "Apostar". Mostra odd estimada em tempo real |
| **ResultPage** | `/bet/:id/resultado` | Ranking final, quem ganhou/perdeu, odd efetiva de cada um, pool acumulado |
| **AdminPanel** | *(dentro de GrupoPage)* | Criar bet, fechar apostas, revelar valor real |
| **PerfilPage** | `/jogador/:id` | Saldo, histórico de transações, estatísticas |

---

## Fluxo de Telas (UX)

```
HomePage (lista grupos)
  └─ GrupoPage (timeline bets + saldo)
       ├─ BetPage (apostar)
       │    └─ ResultPage (ver resultado)
       └─ AdminPanel (criar/fechar/revelar)
```

---

## Regras de Layout
- **Mobile-first**: pensado pra 390×844 primeiro
- **Desktop**: container centralizado com max-width 480px
- **Duolingo-Style**: verde `#4CAF50`, cantos arredondados (12px cards, 24px header), botões CTA h=52px
- **Touch targets**: mínimo 44×44px
- **Tipografia**: clamp() ou rem (nunca px fixo)
- **Feedback visual**: animações suaves ao apostar, ao revelar resultado

---

## O que fica de fora do MVP
- **Autenticação/login**: qualquer um pode entrar com um nome (MVP sem senha)
- **Integração WhatsApp**: o app é 100% independente do WhatsApp
- **Pagamentos reais (Pix, carteira digital)**: saldo é fictício/simulado
- **Múltiplas bets simultâneas**: uma bet ativa por vez por grupo
- **Notificações push**: o jogador precisa voltar ao app pra ver o resultado
- **Tipos de aposta automáticos**: admin insere o valor real manualmente
- **Sistema de convite**: qualquer um com o link do grupo pode entrar