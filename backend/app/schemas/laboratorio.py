from datetime import datetime

from pydantic import Field

from app.modelos.enums import (
    EstadoConservadora,
    EstadoPrecinto,
    MotivoRechazo,
    TipoEventoEnvio,
    TipoMuestra,
)
from app.modelos.laboratorio import Muestra
from app.schemas.comun import Esquema
from app.schemas.organizacion import ClinicaResumen, ProfesionalResumen


# ---------- Muestras ----------
class MuestraSalida(Esquema):
    id: int
    codigo: str
    estado: str
    estado_descripcion: str
    es_final: bool
    motivo_rechazo: MotivoRechazo | None
    fecha_extraccion: datetime
    tipo_analisis_id: int
    nombre_analisis: str
    tipo_muestra: TipoMuestra
    temperatura_min: float
    temperatura_max: float
    horas_viabilidad: int
    orden_id: int
    orden_numero: str
    urgente: bool
    atencion_id: int
    mascota: str
    especie: str
    responsable: str
    clinica_id: int
    clinica: str
    remito_id: int | None
    remito_numero: str | None
    tiene_resultado: bool

    @classmethod
    def desde(cls, m: Muestra) -> "MuestraSalida":
        atencion = m.orden.atencion
        mascota = atencion.mascota
        estado = m.estado_actual
        return cls(
            id=m.id,
            codigo=m.codigo,
            estado=m.estado,
            estado_descripcion=estado.descripcion,
            es_final=estado.es_final,
            motivo_rechazo=m.motivo_rechazo,
            fecha_extraccion=m.fecha_extraccion,
            tipo_analisis_id=m.tipo_analisis_id,
            nombre_analisis=m.tipo_analisis.nombre,
            tipo_muestra=m.tipo_analisis.tipo_muestra,
            temperatura_min=m.tipo_analisis.temperatura_min,
            temperatura_max=m.tipo_analisis.temperatura_max,
            horas_viabilidad=m.tipo_analisis.horas_viabilidad,
            orden_id=m.orden_id,
            orden_numero=m.orden.numero,
            urgente=m.orden.urgente,
            atencion_id=atencion.id,
            mascota=mascota.nombre,
            especie=mascota.especie.nombre,
            responsable=mascota.responsable.nombre_completo,
            clinica_id=atencion.clinica_id,
            clinica=atencion.clinica.nombre,
            remito_id=m.remito_id,
            remito_numero=m.remito.numero if m.remito else None,
            tiene_resultado=m.resultado is not None,
        )


class RegistroHistorialSalida(Esquema):
    id: int
    estado_anterior: str | None
    estado_nuevo: str
    fecha: datetime
    usuario: str | None
    observacion: str | None


class ResultadoEntrada(Esquema):
    valores: str = Field(min_length=3)
    conclusion: str = Field(min_length=3)
    observaciones: str | None = None


class ResultadoSalida(Esquema):
    id: int
    fecha: datetime
    valores: str
    conclusion: str
    observaciones: str | None
    profesional: ProfesionalResumen


class RechazoMuestraEntrada(Esquema):
    motivo: MotivoRechazo
    observacion: str | None = None


# ---------- Conservadoras ----------
class ConservadoraEntrada(Esquema):
    codigo: str = Field(min_length=2)
    clinica_id: int
    descripcion: str
    capacidad: int = Field(ge=1)
    temperatura_min: float
    temperatura_max: float
    estado: EstadoConservadora = EstadoConservadora.DISPONIBLE


class ConservadoraSalida(ConservadoraEntrada):
    id: int
    clinica: ClinicaResumen


# ---------- Remitos y envío ----------
class RemitoEntrada(Esquema):
    conservadora_id: int
    muestra_ids: list[int] = Field(min_length=1)
    observaciones: str | None = None


class DespachoEntrada(Esquema):
    transportista: str = Field(min_length=2)
    ubicacion: str = Field(min_length=2)
    temperatura: float | None = None
    observacion: str | None = None


class EventoEnvioEntrada(Esquema):
    ubicacion: str = Field(min_length=2)
    responsable: str = Field(min_length=2)
    temperatura: float | None = None
    observacion: str | None = None


class EventoEnvioSalida(Esquema):
    id: int
    fecha: datetime
    tipo: TipoEventoEnvio
    ubicacion: str
    responsable: str
    temperatura: float | None
    fuera_de_rango: bool
    observacion: str | None


class RechazoIndividual(Esquema):
    muestra_id: int
    motivo: MotivoRechazo


class RecepcionEntrada(Esquema):
    estado_precinto: EstadoPrecinto
    codigo_precinto: str = Field(min_length=3)
    temperatura_llegada: float | None = None
    observaciones: str | None = None
    rechazos: list[RechazoIndividual] = []


class RecepcionSalida(Esquema):
    id: int
    fecha: datetime
    estado_precinto: EstadoPrecinto
    codigo_precinto_verificado: str
    temperatura_llegada: float | None
    aceptada: bool
    observaciones: str | None


class PrecintoSalida(Esquema):
    codigo: str
    estado: EstadoPrecinto
    fecha_colocacion: datetime
    fecha_verificacion: datetime | None


class ConservadoraResumen(Esquema):
    id: int
    codigo: str
    descripcion: str
    temperatura_min: float
    temperatura_max: float


class RemitoSalida(Esquema):
    id: int
    numero: str
    estado: str
    estado_descripcion: str
    clinica: ClinicaResumen
    laboratorio: str
    conservadora: ConservadoraResumen
    fecha_emision: datetime
    fecha_despacho: datetime | None
    fecha_recepcion: datetime | None
    horas_en_transito: float | None
    transportista: str | None
    observaciones: str | None
    emisor: str | None
    precinto: PrecintoSalida
    muestras: list[MuestraSalida]
    eventos: list[EventoEnvioSalida]
    recepcion: RecepcionSalida | None


class TrazabilidadSalida(Esquema):
    muestra: MuestraSalida
    profesional_solicitante: str
    fecha_atencion: datetime
    historial: list[RegistroHistorialSalida]
    remito: RemitoSalida | None
    resultado: ResultadoSalida | None
