from pydantic import Field

from app.modelos.enums import TipoMuestra
from app.schemas.comun import Esquema


class EspecieEntrada(Esquema):
    nombre: str = Field(min_length=2, max_length=40)


class EspecieSalida(EspecieEntrada):
    id: int


class VacunaEntrada(Esquema):
    nombre: str = Field(min_length=2)
    especie_id: int
    obligatoria: bool = True
    edad_minima_semanas: int = Field(ge=0, default=8)
    refuerzo_meses: int | None = Field(default=None, ge=1)
    precio: float = Field(ge=0, default=0)


class VacunaSalida(VacunaEntrada):
    id: int
    especie: EspecieSalida


class TipoAnalisisEntrada(Esquema):
    nombre: str = Field(min_length=2)
    tipo_muestra: TipoMuestra
    precio: float = Field(ge=0)
    temperatura_min: float
    temperatura_max: float
    horas_viabilidad: int = Field(ge=1)
    activo: bool = True


class TipoAnalisisSalida(TipoAnalisisEntrada):
    id: int
