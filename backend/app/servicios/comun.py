"""Utilidades compartidas por los servicios."""
import calendar
from datetime import date
from typing import TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.excepciones import NoEncontradoError, PermisoDenegadoError
from app.modelos.enums import Rol
from app.modelos.organizacion import Usuario

T = TypeVar("T")


def obtener_o_error(sesion: Session, modelo: type[T], id_: int, nombre: str) -> T:
    entidad = sesion.get(modelo, id_)
    if entidad is None:
        raise NoEncontradoError(f"No existe {nombre} con id {id_}.")
    return entidad


def generar_numero(sesion: Session, modelo: type, prefijo: str, ancho: int = 6) -> str:
    """Numeración correlativa simple: PREFIJO-000001, PREFIJO-000002, ..."""
    cantidad = sesion.scalar(select(func.count()).select_from(modelo)) or 0
    return f"{prefijo}-{cantidad + 1:0{ancho}d}"


def clinica_en_alcance(usuario: Usuario, clinica_id: int | None) -> int | None:
    """Un veterinario solo ve datos de su clínica; el resto puede filtrar libremente."""
    if usuario.rol == Rol.VETERINARIO:
        return usuario.clinica_id
    return clinica_id


def verificar_clinica(usuario: Usuario, clinica_id: int) -> None:
    if usuario.rol == Rol.VETERINARIO and usuario.clinica_id != clinica_id:
        raise PermisoDenegadoError("Solo podés operar sobre datos de tu clínica.")


def sumar_meses(fecha: date, meses: int) -> date:
    mes = fecha.month - 1 + meses
    anio = fecha.year + mes // 12
    mes = mes % 12 + 1
    dia = min(fecha.day, calendar.monthrange(anio, mes)[1])
    return date(anio, mes, dia)
