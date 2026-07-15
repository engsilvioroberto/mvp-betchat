from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from database import Player, Transaction, engine, Group
from schemas import PlayerCreate, PlayerOut, TransactionOut

router = APIRouter(prefix="/api/jogadores", tags=["jogadores"])


@router.get("", response_model=list[PlayerOut])
def list_players(grupo_id: int | None = None):
    with Session(engine) as session:
        q = select(Player)
        if grupo_id:
            q = q.where(Player.grupo_id == grupo_id)
        players = session.execute(q.order_by(Player.nome)).scalars().all()
        return players


@router.post("", response_model=PlayerOut, status_code=201)
def create_player(data: PlayerCreate):
    with Session(engine) as session:
        group = session.get(Group, data.grupo_id)
        if not group:
            raise HTTPException(404, "Grupo não encontrado")

        player = Player(nome=data.nome, grupo_id=data.grupo_id, saldo=100.0)
        session.add(player)
        session.flush()
        session.refresh(player)

        # transaction de entrada inicial
        tx = Transaction(player_id=player.id, bet_id=None, tipo="entrada", valor=100.0)
        session.add(tx)
        session.commit()

        # Recarrega para evitar detached error
        session.refresh(player)

        return {
            "id": player.id,
            "nome": player.nome,
            "saldo": player.saldo,
            "grupo_id": player.grupo_id,
            "created_at": player.created_at.isoformat() if player.created_at else None,
        }


@router.get("/{player_id}", response_model=PlayerOut)
def get_player(player_id: int):
    with Session(engine) as session:
        player = session.get(Player, player_id)
        if not player:
            raise HTTPException(404, "Jogador não encontrado")
        return player


@router.get("/{player_id}/transacoes", response_model=list[TransactionOut])
def get_transactions(player_id: int):
    with Session(engine) as session:
        txs = session.execute(
            select(Transaction)
            .where(Transaction.player_id == player_id)
            .order_by(Transaction.created_at.desc())
        ).scalars().all()
        return txs