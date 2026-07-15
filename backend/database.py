import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///betchat.db")

engine = create_engine(DATABASE_URL.replace("+aiosqlite", ""), echo=False)


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
    saldo = Column(Float, default=100.0)  # saldo inicial fictício
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


def init_db():
    Base.metadata.create_all(bind=engine)