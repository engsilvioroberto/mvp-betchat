from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from database import Bet, BetParticipant, Player, Transaction, Group, engine
from schemas import BetCreate, BetOut, ApostaCreate, ApostaOut, ResultadoOut, ResultadoItem

router = APIRouter(prefix="/api/bets", tags=["bets"])


@router.get("", response_model=list[BetOut])
def list_bets(grupo_id: int | None = None):
    with Session(engine) as session:
        q = select(Bet)
        if grupo_id:
            q = q.where(Bet.grupo_id == grupo_id)
        bets = session.execute(q.order_by(Bet.created_at.desc())).scalars().all()
        return bets


@router.get("/{bet_id}", response_model=BetOut)
def get_bet(bet_id: int):
    with Session(engine) as session:
        bet = session.get(Bet, bet_id)
        if not bet:
            raise HTTPException(404, "Bet não encontrada")
        return bet


@router.post("", response_model=BetOut, status_code=201)
def create_bet(data: BetCreate):
    with Session(engine) as session:
        group = session.get(Group, data.grupo_id)
        if not group:
            raise HTTPException(404, "Grupo não encontrado")

        # Verifica se já existe bet aberta ativa no grupo
        ativa = session.execute(
            select(Bet).where(Bet.grupo_id == data.grupo_id, Bet.status.in_(["aberta", "fechada"]))
        ).scalars().first()
        if ativa:
            raise HTTPException(400, "Já existe uma bet ativa neste grupo. Encerre-a primeiro.")

        bet = Bet(
            grupo_id=data.grupo_id,
            pergunta=data.pergunta,
            margem=data.margem,
            data_fechamento=data.data_fechamento,
            pool_acumulado=group.pool_acumulado if hasattr(group, 'pool_acumulado') else 0.0,
        )
        session.add(bet)
        session.commit()
        session.refresh(bet)
        return bet


@router.get("/{bet_id}/apostas", response_model=list[ApostaOut])
def list_apostas(bet_id: int):
    with Session(engine) as session:
        bets = session.execute(
            select(BetParticipant).where(BetParticipant.bet_id == bet_id)
        ).scalars().all()
        return bets


@router.post("/{bet_id}/apostar", response_model=ApostaOut, status_code=201)
def fazer_aposta(bet_id: int, data: ApostaCreate):
    with Session(engine) as session:
        bet = session.get(Bet, bet_id)
        if not bet:
            raise HTTPException(404, "Bet não encontrada")
        if bet.status != "aberta":
            raise HTTPException(400, "Bet não está aberta para apostas")

        player = session.get(Player, data.player_id)
        if not player:
            raise HTTPException(404, "Jogador não encontrado")
        if player.grupo_id != bet.grupo_id:
            raise HTTPException(400, "Jogador não pertence a este grupo")
        if player.saldo < data.valor_aposta:
            raise HTTPException(400, "Saldo insuficiente")

        # Verifica se já apostou
        existente = session.execute(
            select(BetParticipant).where(
                BetParticipant.bet_id == bet_id,
                BetParticipant.player_id == data.player_id
            )
        ).scalars().first()
        if existente:
            raise HTTPException(400, "Você já apostou nesta bet")

        # Debita do saldo
        player.saldo -= data.valor_aposta
        bet.pool_total += data.valor_aposta

        # Cria aposta
        aposta = BetParticipant(
            bet_id=bet_id,
            player_id=data.player_id,
            valor_aposta=data.valor_aposta,
            palpite=data.palpite,
        )
        session.add(aposta)

        # Transação de débito
        tx = Transaction(
            player_id=data.player_id,
            bet_id=bet_id,
            tipo="aposta",
            valor=-data.valor_aposta,
        )
        session.add(tx)

        session.commit()
        session.refresh(aposta)
        return aposta


@router.post("/{bet_id}/fechar", response_model=BetOut)
def fechar_bet(bet_id: int):
    with Session(engine) as session:
        bet = session.get(Bet, bet_id)
        if not bet:
            raise HTTPException(404, "Bet não encontrada")
        if bet.status != "aberta":
            raise HTTPException(400, "Bet não está aberta")
        bet.status = "fechada"
        bet.data_fechamento = datetime.now(timezone.utc)
        session.commit()
        session.refresh(bet)
        return bet


@router.post("/{bet_id}/revelar", response_model=ResultadoOut)
def revelar_resultado(bet_id: int, valor_real: float):
    with Session(engine) as session:
        bet = session.get(Bet, bet_id)
        if not bet:
            raise HTTPException(404, "Bet não encontrada")
        if bet.status != "fechada":
            raise HTTPException(400, "Bet precisa estar fechada para revelar resultado")

        bet.valor_real = valor_real
        bet.status = "apurada"

        # Busca todas as apostas
        apostas = session.execute(
            select(BetParticipant).where(BetParticipant.bet_id == bet_id)
        ).scalars().all()

        # --- ALGORITMO PARI-MUTUEL ---
        margem = bet.margem
        pool_liquido = (bet.pool_total + bet.pool_acumulado) * 0.9
        taxa = (bet.pool_total + bet.pool_acumulado) * 0.1

        resultados = []
        soma_pesos = 0.0
        items = []

        for aposta in apostas:
            erro = abs(aposta.palpite - valor_real) / valor_real if valor_real != 0 else 0.0
            if erro <= margem and margem > 0:
                precisao = 1.0 - erro / margem
                if precisao < 0:
                    precisao = 0.0
                peso = aposta.valor_aposta * (precisao ** 2)
            else:
                precisao = 0.0
                peso = 0.0

            aposta.peso = peso
            aposta.premio = 0.0
            soma_pesos += peso

            items.append({
                "aposta": aposta,
                "erro": erro,
                "precisao": precisao,
                "peso": peso,
            })

        # Distribui
        saldo_acumular = pool_liquido
        for item in items:
            aposta = item["aposta"]
            if soma_pesos > 0 and item["peso"] > 0:
                premio = (item["peso"] / soma_pesos) * pool_liquido
                aposta.premio = round(premio, 2)

                # Credita no saldo do jogador
                player = session.get(Player, aposta.player_id)
                if player:
                    player.saldo += aposta.premio

                # Transação de prêmio
                tx = Transaction(
                    player_id=aposta.player_id,
                    bet_id=bet_id,
                    tipo="premio",
                    valor=aposta.premio,
                )
                session.add(tx)

                saldo_acumular -= aposta.premio

        # Se ninguém acertou, tudo acumula
        if soma_pesos == 0:
            saldo_acumular = pool_liquido

        bet.pool_acumulado = round(saldo_acumular, 2)

        # Monta resultado
        for item in items:
            aposta = item["aposta"]
            player = session.get(Player, aposta.player_id)
            odd = round(aposta.premio / aposta.valor_aposta, 2) if aposta.premio and aposta.valor_aposta > 0 else 0.0
            resultados.append(ResultadoItem(
                player_id=aposta.player_id,
                player_nome=player.nome if player else "?",
                aposta=aposta.valor_aposta,
                palpite=aposta.palpite,
                erro=round(item["erro"], 4),
                precisao=round(item["precisao"], 4),
                peso=round(item["peso"], 4),
                premio=round(aposta.premio or 0, 2),
                odd=odd,
            ))

        # Ordena por prêmio decrescente
        resultados.sort(key=lambda r: r.premio, reverse=True)

        session.commit()

        return ResultadoOut(
            bet_id=bet.id,
            pergunta=bet.pergunta,
            valor_real=valor_real,
            margem=bet.margem,
            pool_total=bet.pool_total,
            pool_acumulado_antes=bet.pool_acumulado - saldo_acumular,
            taxa=round(taxa, 2),
            pool_liquido=round(pool_liquido, 2),
            saldo_acumulado=round(saldo_acumular, 2),
            resultados=resultados,
        )


@router.get("/{bet_id}/resultados", response_model=ResultadoOut)
def get_resultados(bet_id: int):
    """Retorna os resultados já calculados de uma bet apurada."""
    with Session(engine) as session:
        bet = session.get(Bet, bet_id)
        if not bet:
            raise HTTPException(404, "Bet não encontrada")
        if bet.status != "apurada":
            raise HTTPException(400, "Bet ainda não foi apurada")

        apostas = session.execute(
            select(BetParticipant).where(BetParticipant.bet_id == bet_id)
        ).scalars().all()

        resultados = []
        for aposta in apostas:
            player = session.get(Player, aposta.player_id)
            erro = abs(aposta.palpite - bet.valor_real) / bet.valor_real if bet.valor_real else 0
            odd = round(aposta.premio / aposta.valor_aposta, 2) if aposta.premio and aposta.valor_aposta > 0 else 0.0
            resultados.append(ResultadoItem(
                player_id=aposta.player_id,
                player_nome=player.nome if player else "?",
                aposta=aposta.valor_aposta,
                palpite=aposta.palpite,
                erro=round(erro, 4),
                precisao=round(aposta.peso / (aposta.valor_aposta ** 0.5) if aposta.valor_aposta > 0 and aposta.peso else 0, 4),
                peso=round(aposta.peso or 0, 4),
                premio=round(aposta.premio or 0, 2),
                odd=odd,
            ))

        resultados.sort(key=lambda r: r.premio, reverse=True)

        pool_liquido = (bet.pool_total + bet.pool_acumulado) * 0.9

        return ResultadoOut(
            bet_id=bet.id,
            pergunta=bet.pergunta,
            valor_real=bet.valor_real or 0,
            margem=bet.margem,
            pool_total=bet.pool_total,
            pool_acumulado_antes=bet.pool_acumulado,
            taxa=round((bet.pool_total + bet.pool_acumulado) * 0.1, 2),
            pool_liquido=round(pool_liquido, 2),
            saldo_acumulado=bet.pool_acumulado,
            resultados=resultados,
        )


@router.get("/{bet_id}/odds")
def get_odds(bet_id: int):
    """Retorna odds estimadas para cada palpite (dinâmico durante apostas)."""
    with Session(engine) as session:
        bet = session.get(Bet, bet_id)
        if not bet:
            raise HTTPException(404, "Bet não encontrada")
        if bet.status != "aberta":
            raise HTTPException(400, "Bet não está mais aberta")

        apostas = session.execute(
            select(BetParticipant).where(BetParticipant.bet_id == bet_id)
        ).scalars().all()

        if not apostas:
            return {"odds": [], "total_pool": 0}

        # Agrupa palpites próximos (dentro de 10% um do outro)
        # Para cada aposta, estima odd como: pool_total / soma_apostas_perto_do_palpite
        odds = []
        for a in apostas:
            soma_perto = a.valor_aposta
            for b in apostas:
                if a.id != b.id:
                    diff = abs(a.palpite - b.palpite) / max(a.palpite, b.palpite, 1)
                    if diff <= 0.10:
                        soma_perto += b.valor_aposta

            odd_est = round(bet.pool_total / soma_perto, 2) if soma_perto > 0 else 1.0
            player = session.get(Player, a.player_id)
            odds.append({
                "player_id": a.player_id,
                "player_nome": player.nome if player else "?",
                "palpite": a.palpite,
                "aposta": a.valor_aposta,
                "odd_estimada": odd_est,
            })

        return {"odds": odds, "total_pool": bet.pool_total}