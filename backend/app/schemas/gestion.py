"""Schemas de stock, agenda y facturación."""
from datetime import datetime, time

from pydantic import Field

from app.modelos.enums import EstadoTurno, TipoItem, TipoMovimiento, TipoTurno
from app.schemas.comun import Esquema
from app.schemas.organizacion import ClinicaResumen, ProfesionalResumen


# ---------- Insumos ----------
class InsumoEntrada(Esquema):
    clinica_id: int
    nombre: str = Field(min_length=2)
    unidad: str = Field(min_length=1)
    stock_minimo: float = Field(ge=0)
    activo: bool = True


class InsumoSalida(InsumoEntrada):
    id: int
    stock_actual: float
    bajo_minimo: bool
    clinica: ClinicaResumen


class MovimientoEntrada(Esquema):
    tipo: TipoMovimiento
    cantidad: float = Field(ge=0)
    motivo: str = Field(min_length=2)


class MovimientoSalida(Esquema):
    id: int
    tipo: TipoMovimiento
    cantidad: float
    stock_resultante: float
    fecha: datetime
    motivo: str
    atencion_id: int | None


# ---------- Agenda ----------
class HorarioEntrada(Esquema):
    profesional_id: int
    dia_semana: int = Field(ge=0, le=6)
    hora_desde: time
    hora_hasta: time


class HorarioSalida(HorarioEntrada):
    id: int


class TurnoEntrada(Esquema):
    profesional_id: int
    inicio: datetime
    fin: datetime
    tipo: TipoTurno
    motivo: str = Field(min_length=2)
    mascota_id: int | None = None
    muestra_id: int | None = None


class TurnoSalida(Esquema):
    id: int
    profesional_id: int
    profesional: ProfesionalResumen
    inicio: datetime
    fin: datetime
    tipo: TipoTurno
    estado: EstadoTurno
    motivo: str
    mascota_id: int | None
    mascota_nombre: str | None
    muestra_id: int | None
    muestra_codigo: str | None


# ---------- Facturación ----------
class ItemComprobanteSalida(Esquema):
    id: int
    concepto: str
    tipo: TipoItem
    cantidad: int
    precio_unitario: float
    subtotal: float


class ComprobanteSalida(Esquema):
    id: int
    numero: str
    fecha: datetime
    total: float
    atencion_id: int
    clinica: ClinicaResumen
    mascota: str
    responsable: str
    responsable_dni: str
    profesional: str
    tipo_atencion: str
    items: list[ItemComprobanteSalida]
