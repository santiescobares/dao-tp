"""Derivación al laboratorio: tipos de análisis, órdenes, muestras y su trazabilidad."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.excepciones import TrazabilidadInmutableError
from app.dominio.estados_muestra import (
    EstadoMuestra,
    Extraida,
    RegistroCambio,
    estado_muestra_desde,
)
from app.modelos.clinico import Atencion
from app.modelos.enums import MotivoRechazo, TipoMuestra
from app.modelos.organizacion import Profesional, Usuario

if TYPE_CHECKING:
    from app.modelos.envio import RemitoBiologico


class TipoAnalisis(Base):
    __tablename__ = "tipos_analisis"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True)
    tipo_muestra: Mapped[TipoMuestra]
    precio: Mapped[float]
    # Condiciones de transporte para que la muestra siga siendo viable
    temperatura_min: Mapped[float] = mapped_column(default=2)
    temperatura_max: Mapped[float] = mapped_column(default=8)
    horas_viabilidad: Mapped[int] = mapped_column(default=48)
    activo: Mapped[bool] = mapped_column(default=True)


class OrdenDerivacion(Base):
    """Orden emitida en una atención para enviar muestras al laboratorio central."""

    __tablename__ = "ordenes_derivacion"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True)
    atencion_id: Mapped[int] = mapped_column(ForeignKey("atenciones.id"))
    fecha_emision: Mapped[datetime] = mapped_column(default=datetime.now)
    urgente: Mapped[bool] = mapped_column(default=False)
    observaciones: Mapped[str | None] = mapped_column(Text)

    atencion: Mapped[Atencion] = relationship(back_populates="ordenes")
    muestras: Mapped[list["Muestra"]] = relationship(
        back_populates="orden", cascade="all, delete-orphan"
    )

    @property
    def estado(self) -> str:
        """Estado derivado del de sus muestras."""
        estados = [estado_muestra_desde(m.estado) for m in self.muestras]
        if estados and all(e.es_final for e in estados):
            return "FINALIZADA"
        if any(e.nombre != Extraida.nombre for e in estados):
            return "EN_CURSO"
        return "PENDIENTE"


class Muestra(Base):
    """Contexto del patrón State: delega cada operación en su estado actual."""

    __tablename__ = "muestras"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes_derivacion.id"))
    tipo_analisis_id: Mapped[int] = mapped_column(ForeignKey("tipos_analisis.id"))
    fecha_extraccion: Mapped[datetime]
    estado: Mapped[str] = mapped_column(String(20), default=Extraida.nombre)
    motivo_rechazo: Mapped[MotivoRechazo | None]
    remito_id: Mapped[int | None] = mapped_column(ForeignKey("remitos_biologicos.id"))

    orden: Mapped[OrdenDerivacion] = relationship(back_populates="muestras")
    tipo_analisis: Mapped[TipoAnalisis] = relationship()
    remito: Mapped["RemitoBiologico | None"] = relationship(back_populates="muestras")
    historial: Mapped[list["HistorialEstadoMuestra"]] = relationship(
        back_populates="muestra",
        order_by="[HistorialEstadoMuestra.fecha, HistorialEstadoMuestra.id]",
        cascade="save-update, merge",
    )
    resultado: Mapped["ResultadoAnalisis | None"] = relationship(
        back_populates="muestra", uselist=False
    )

    @classmethod
    def extraer(cls, codigo: str, tipo_analisis: TipoAnalisis, registro: RegistroCambio) -> "Muestra":
        """Crea la muestra en estado Extraída con su primer registro de trazabilidad."""
        muestra = cls(
            codigo=codigo,
            tipo_analisis=tipo_analisis,
            fecha_extraccion=registro.fecha,
            estado=Extraida.nombre,
        )
        muestra.historial.append(
            HistorialEstadoMuestra(
                estado_anterior=None,
                estado_nuevo=Extraida.nombre,
                fecha=registro.fecha,
                usuario_id=registro.usuario_id,
                observacion=registro.observacion or "Extracción de la muestra",
            )
        )
        return muestra

    @property
    def estado_actual(self) -> EstadoMuestra:
        return estado_muestra_desde(self.estado)

    @property
    def nombre_analisis(self) -> str:
        return self.tipo_analisis.nombre

    @property
    def tiene_resultado(self) -> bool:
        return self.resultado is not None

    def cambiar_estado(self, nuevo: EstadoMuestra, registro: RegistroCambio) -> None:
        """Único punto donde se modifica el estado: siempre deja rastro en el historial."""
        self.historial.append(
            HistorialEstadoMuestra(
                estado_anterior=self.estado,
                estado_nuevo=nuevo.nombre,
                fecha=registro.fecha,
                usuario_id=registro.usuario_id,
                observacion=registro.observacion,
            )
        )
        self.estado = nuevo.nombre

    # Operaciones delegadas al estado actual (patrón State)
    def empaquetar(self, registro: RegistroCambio) -> None:
        self.estado_actual.empaquetar(self, registro)

    def despachar(self, registro: RegistroCambio) -> None:
        self.estado_actual.despachar(self, registro)

    def recibir(self, registro: RegistroCambio) -> None:
        self.estado_actual.recibir(self, registro)

    def rechazar(self, motivo: MotivoRechazo, registro: RegistroCambio) -> None:
        self.estado_actual.rechazar(self, motivo, registro)

    def analizar(self, registro: RegistroCambio) -> None:
        self.estado_actual.analizar(self, registro)

    def fecha_de_estado(self, estado: str) -> datetime | None:
        """Fecha en la que la muestra entró al estado indicado (según el historial)."""
        for registro in self.historial:
            if registro.estado_nuevo == estado:
                return registro.fecha
        return None


class HistorialEstadoMuestra(Base):
    """Trazabilidad inmutable: solo se insertan registros, nunca se modifican."""

    __tablename__ = "historial_estados_muestra"

    id: Mapped[int] = mapped_column(primary_key=True)
    muestra_id: Mapped[int] = mapped_column(ForeignKey("muestras.id"))
    estado_anterior: Mapped[str | None] = mapped_column(String(20))
    estado_nuevo: Mapped[str] = mapped_column(String(20))
    fecha: Mapped[datetime]
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    observacion: Mapped[str | None] = mapped_column(Text)

    muestra: Mapped[Muestra] = relationship(back_populates="historial")
    usuario: Mapped[Usuario | None] = relationship()


@event.listens_for(HistorialEstadoMuestra, "before_update")
@event.listens_for(HistorialEstadoMuestra, "before_delete")
def _impedir_cambios_en_historial(_mapper, _conexion, _registro) -> None:
    raise TrazabilidadInmutableError(
        "La trazabilidad de estados de una muestra no puede modificarse ni eliminarse."
    )


class ResultadoAnalisis(Base):
    __tablename__ = "resultados_analisis"

    id: Mapped[int] = mapped_column(primary_key=True)
    muestra_id: Mapped[int] = mapped_column(ForeignKey("muestras.id"), unique=True)
    profesional_id: Mapped[int] = mapped_column(ForeignKey("profesionales.id"))
    fecha: Mapped[datetime] = mapped_column(default=datetime.now)
    valores: Mapped[str] = mapped_column(Text)
    conclusion: Mapped[str] = mapped_column(Text)
    observaciones: Mapped[str | None] = mapped_column(Text)

    muestra: Mapped[Muestra] = relationship(back_populates="resultado")
    profesional: Mapped[Profesional] = relationship()
