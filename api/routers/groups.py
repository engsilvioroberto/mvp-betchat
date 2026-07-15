from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from database import Group, engine
from schemas import GroupCreate, GroupOut

router = APIRouter(prefix="/api/grupos", tags=["grupos"])


@router.get("", response_model=list[GroupOut])
def list_groups():
    with Session(engine) as session:
        groups = session.execute(select(Group).order_by(Group.created_at.desc())).scalars().all()
        return groups


@router.post("", response_model=GroupOut, status_code=201)
def create_group(data: GroupCreate):
    with Session(engine) as session:
        group = Group(nome=data.nome)
        session.add(group)
        session.commit()
        session.refresh(group)
        return group


@router.get("/{group_id}", response_model=GroupOut)
def get_group(group_id: int):
    with Session(engine) as session:
        group = session.get(Group, group_id)
        if not group:
            raise HTTPException(404, "Grupo não encontrado")
        return group