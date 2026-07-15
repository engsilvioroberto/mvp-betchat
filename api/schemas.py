from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# --- Groups ---
class GroupCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)


class GroupOut(BaseModel):
    id: int
    nome: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Players ---
class PlayerCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    grupo_id: int


class PlayerOut(BaseModel):
    id: int
    nome: str
    saldo: float
    grupo_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- Bets ---
class BetCreate(BaseModel):
    grupo_id: int
    pergunta: str = Field(..., min_length=1)
    margem: float = Field(default=0.20, ge=0.01, le=1.0)
    data_fechamento: Optional[datetime] = None


class BetOut(BaseModel):
    id: int
    grupo_id: int
    pergunta: str
    margem: float
    valor_real: Optional[float] = None
    status: str
    data_abertura: datetime
    data_fechamento: Optional[datetime] = None
    pool_total: float
    pool_acumulado: float
    created_at: datetime

    class Config:
        from_attributes = True


# --- Apostas (participants) ---
class ApostaCreate(BaseModel):
    player_id: int
    valor_aposta: float = Field(..., gt=0)
    palpite: float = Field(...)


class ApostaOut(BaseModel):
    id: int
    bet_id: int
    player_id: int
    valor_aposta: float
    palpite: float
    peso: Optional[float] = None
    premio: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Resultado ---
class ResultadoItem(BaseModel):
    player_id: int
    player_nome: str
    aposta: float
    palpite: float
    erro: Optional[float] = None
    precisao: Optional[float] = None
    peso: Optional[float] = None
    premio: float
    odd: float


class ResultadoOut(BaseModel):
    bet_id: int
    pergunta: str
    valor_real: float
    margem: float
    pool_total: float
    pool_acumulado_antes: float
    taxa: float
    pool_liquido: float
    saldo_acumulado: float
    resultados: list[ResultadoItem]


# --- Transaction ---
class TransactionOut(BaseModel):
    id: int
    player_id: int
    bet_id: Optional[int] = None
    tipo: str
    valor: float
    created_at: datetime

    class Config:
        from_attributes = True


# --- Health ---
class HealthOut(BaseModel):
    status: str = "ok"