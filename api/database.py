import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func

# Default: SQLite local. Set DATABASE_URL env var for PostgreSQL (Supabase)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///betchat.db")

# Detect database type
raw_url = DATABASE_URL

# Handle +aiosqlite suffix used in some local setups
if raw_url.startswith("sqlite+aiosqlite"):
    raw_url = raw_url.replace("+aiosqlite", "")

# If PostgreSQL and no explicit dialect, use pg8000 (pure Python, works on Vercel)
if raw_url.startswith("postgresql://") and "+" not in raw_url.replace("postgresql+", "____"):
    raw_url = raw_url.replace("postgresql://", "postgresql+pg8000://")

is_sqlite = raw_url.startswith("sqlite")
if is_sqlite:
    engine = create_engine(
        raw_url,
        echo=False,
        connect_args={"check_same_thread": False},
    )
else:
    # PostgreSQL (Supabase) — single-connection pool for serverless
    engine = create_engine(
        raw_url,
        echo=False,
        pool_size=1,
        max_overflow=0,
        pool_pre_ping=True,
    )


class Base(DeclarativeBase):
    pass


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(100), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    players = relationship("Player", back_populates="group", cascade="all, delete-orphan")
    bets = relationship("Bet", back_populates="group", cascade="all, delete-orphan")


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(100), nullable=False)
    saldo = Column(Float, default=100.0)
    grupo_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    group = relationship("Group", back_populates="players")
    participations = relationship("BetParticipant", back_populates="player", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="player", cascade="all, delete-orphan")


class Bet(Base):
    __tablename__ = "bets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    grupo_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    pergunta = Column(Text, nullable=False)
    margem = Column(Float, default=0.20)
    valor_real = Column(Float, nullable=True)
    status = Column(String(20), default="aberta")  # aberta, fechada, apurada
    data_abertura = Column(DateTime, server_default=func.now())
    data_fechamento = Column(DateTime, nullable=True)
    pool_total = Column(Float, default=0.0)
    pool_acumulado = Column(Float, default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    group = relationship("Group", back_populates="bets")
    participants = relationship("BetParticipant", back_populates="bet", cascade="all, delete-orphan")


class BetParticipant(Base):
    __tablename__ = "bets_participants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bet_id = Column(Integer, ForeignKey("bets.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    valor_aposta = Column(Float, nullable=False)
    palpite = Column(Float, nullable=False)
    peso = Column(Float, nullable=True)
    premio = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    bet = relationship("Bet", back_populates="participants")
    player = relationship("Player", back_populates="participations")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    bet_id = Column(Integer, ForeignKey("bets.id"), nullable=True)
    tipo = Column(String(20), nullable=False)  # aposta, premio, entrada, acumulado
    valor = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    player = relationship("Player", back_populates="transactions")


_db_initialized = False


def init_db():
    """Initialize database tables. Safe to call multiple times."""
    global _db_initialized
    if _db_initialized:
        return
    Base.metadata.create_all(bind=engine)
    _db_initialized = True