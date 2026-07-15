import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from database import Group, Player, Bet, BetParticipant, Transaction, engine
from schemas import BetOut, PlayerOut

router = APIRouter(prefix="/api/simulate", tags=["simulate"])

NOMES = [
    "Ana", "Bruno", "Carla", "Diego", "Elena",
    "Felipe", "Gabriela", "Henrique", "Isabela", "João",
    "Karina", "Lucas", "Marina", "Nelson", "Olivia",
    "Paulo", "Renata", "Sergio", "Tatiane", "Ulisses",
    "Vanessa", "William", "Xavier", "Yara", "Zeca",
]


@router.post("/generate")
def generate_simulation(
    grupo_nome: str = "Simulação",
    bet_pergunta: str = "Quantos caracteres serão enviados?",
    num_players: int = 10,
    num_participants: int = 8,
    margem: float = 0.20,
):
    if num_participants > num_players:
        raise HTTPException(400, "num_participants não pode ser maior que num_players")
    if num_players > 25:
        num_players = 25

    with Session(engine) as session:
        # 1. Cria grupo
        group = Group(nome=grupo_nome)
        session.add(group)
        session.flush()

        # 2. Cria N jogadores com saldo aleatório
        selected_names = random.sample(NOMES, num_players)
        players = []
        for nome in selected_names:
            saldo_inicial = round(random.uniform(50, 200), 2)
            p = Player(nome=nome, saldo=saldo_inicial, grupo_id=group.id)
            session.add(p)
            session.flush()
            # Transaction de entrada
            tx = Transaction(player_id=p.id, bet_id=None, tipo="entrada", valor=saldo_inicial)
            session.add(tx)
            players.append(p)

        # 3. Define um valor alvo aleatório
        valor_alvo = round(random.uniform(500, 5000), 0)

        # 4. Cria bet
        bet = Bet(
            grupo_id=group.id,
            pergunta=bet_pergunta,
            margem=margem,
            status="aberta",
        )
        session.add(bet)
        session.flush()

        # 5. M participantes fazem apostas
        participantes = random.sample(players, num_participants)
        bets_created = []
        for p in participantes:
            valor_aposta = round(random.uniform(5, 50), 0)
            if p.saldo < valor_aposta:
                valor_aposta = min(valor_aposta, p.saldo * 0.8)

            # Palpite variando em torno do valor alvo (±30%)
            variacao = random.uniform(-0.30, 0.30)
            palpite = round(valor_alvo * (1 + variacao), 0)

            # Debita
            p.saldo -= valor_aposta
            bet.pool_total += valor_aposta

            aposta = BetParticipant(
                bet_id=bet.id,
                player_id=p.id,
                valor_aposta=valor_aposta,
                palpite=palpite,
            )
            session.add(aposta)
            session.flush()

            tx = Transaction(
                player_id=p.id,
                bet_id=bet.id,
                tipo="aposta",
                valor=-valor_aposta,
            )
            session.add(tx)

            bets_created.append({
                "player_id": p.id,
                "player_nome": p.nome,
                "valor_aposta": valor_aposta,
                "palpite": palpite,
            })

        session.commit()

        return {
            "grupo_id": group.id,
            "grupo_nome": group.nome,
            "bet_id": bet.id,
            "bet_pergunta": bet.pergunta,
            "valor_alvo": valor_alvo,
            "margem": margem,
            "pool_total": bet.pool_total,
            "players": [
                {"id": p.id, "nome": p.nome, "saldo": p.saldo}
                for p in players
            ],
            "apostas": bets_created,
            "total_players": num_players,
            "total_participants": num_participants,
        }


@router.get("/tick/{bet_id}")
def simulate_tick(bet_id: int, progresso: float = 0.5, valor_alvo: float = 2500):
    """
    Simula em que ponto o valor real está (progresso de 0 a 1).
    Retorna as odds atuais como se o valor real fosse `valor_atual`.
    """
    if not 0 <= progresso <= 1:
        raise HTTPException(400, "progresso deve estar entre 0 e 1")
    
    # Valor atual é progresso do progresso em relação ao alvo
    valor_atual = round(valor_alvo * progresso, 2)

    with Session(engine) as session:
        bet = session.get(Bet, bet_id)
        if not bet:
            raise HTTPException(404, "Bet não encontrada")

        apostas = session.execute(
            select(BetParticipant).where(BetParticipant.bet_id == bet_id)
        ).scalars().all()

        # Calcula como se esse fosse o resultado parcial
        margem = bet.margem
        items = []
        soma_pesos = 0.0

        for aposta in apostas:
            erro = abs(aposta.palpite - valor_atual) / valor_atual if valor_atual != 0 else 0
            if erro <= margem and margem > 0:
                precisao = 1.0 - erro / margem
                if precisao < 0:
                    precisao = 0.0
                peso = aposta.valor_aposta * (precisao ** 2)
            else:
                precisao = 0.0
                peso = 0.0

            soma_pesos += peso

            player = session.get(Player, aposta.player_id)
            items.append({
                "player_id": aposta.player_id,
                "player_nome": player.nome if player else "?",
                "aposta": aposta.valor_aposta,
                "palpite": aposta.palpite,
                "erro": round(erro, 4),
                "precisao": round(precisao, 4),
                "peso": round(peso, 4),
                "premio_estimado": 0,
                "odd_estimada": 0,
            })

        # Calcula prêmios estimados
        pool_liquido = (bet.pool_total + bet.pool_acumulado) * 0.9
        for item in items:
            if soma_pesos > 0 and item["peso"] > 0:
                premio = (item["peso"] / soma_pesos) * pool_liquido
                item["premio_estimado"] = round(premio, 2)
                item["odd_estimada"] = round(premio / item["aposta"], 2) if item["aposta"] > 0 else 0

        # Ordena por peso
        items.sort(key=lambda x: x["peso"], reverse=True)

        return {
            "bet_id": bet_id,
            "valor_atual": valor_atual,
            "valor_alvo": valor_alvo,
            "progresso": round(progresso, 4),
            "pool_liquido": round(pool_liquido, 2),
            "items": items,
        }