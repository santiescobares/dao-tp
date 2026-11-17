"""Transporte seguro de muestras: conservadoras, remitos, precintos, cadena de envío y recepción."""
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.excepciones import TrazabilidadInmutableError
from app.dominio.estados_muestra import RegistroCambio
from app.dominio.estados_remito import EstadoRemito, Preparado, estado_remito_desde
from app.modelos.enums import (
    EstadoConservadora,
    EstadoPrecinto,
    MotivoRechazo,
    TipoEventoEnvio,
)
from app.modelos.laboratorio import Muestra
from app.modelos.organizacion import Clinica, Laboratorio, Usuario


class Conservadora(Base):
    """Contenedor isotérmico reutilizable (forma parte del stock de la clínica)."""

    __tablename__ = "conservadoras"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True)
    clinica_id: Mapped[int] = mapped_column(ForeignKey("clinicas.id"))
    descripcion: Mapped[str] = mapped_column(String(100))
    capacidad: Mapped[int]
    temperatura_min: Mapped[float] = mapped_column(default=2)
    temperatura_max: Mapped[float] = mapped_column(default=8)
    estado: Mapped[EstadoConservadora] = mapped_column(default=EstadoConservadora.DISPONIBLE)

    clinica: Mapped[Clinica] = relationship()


class RemitoBiologico(Base):
    """Contexto del patrón State del remito: agrupa las muestras de una conservadora."""

    __tablename__ = "remitos_biologicos"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True)
    clinica_id: Mapped[int] = mapped_column(ForeignKey("clinicas.id"))
    laboratorio_id: Mapped[int] = mapped_column(ForeignKey("laboratorios.id"))
    conservadora_id: Mapped[int] = mapped_column(ForeignKey("conservadoras.id"))
    usuario_emisor_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    fecha_emision: Mapped[datetime] = mapped_column(default=datetime.now)
    fecha_despacho: Mapped[datetime | None]
    fecha_recepcion: Mapped[datetime | None]
    estado: Mapped[str] = mapped_column(String(20), default=Preparado.nombre)
    transportista: Mapped[str | None] = mapped_column(String(100))
    observaciones: Mapped[str | None] = mapped_column(Text)

    clinica: Mapped[Clinica] = relationship()
    laboratorio: Mapped[Laboratorio] = relationship()
    conservadora: Mapped[Conservadora] = relationship()
    usuario_emisor: Mapped[Usuario | None] = relationship()
    muestras: Mapped[list[Muestra]] = relationship(back_populates="remito")
    precinto: Mapped["PrecintoSanitario"] = relationship(back_populates="remito", uselist=False)
    eventos: Mapped[list["EventoEnvio"]] = relationship(
        back_populates="remito", order_by="[EventoEnvio.fecha, EventoEnvio.id]"
    )
    recepcion: Mapped["RecepcionLaboratorio | None"] = relationship(
        back_populates="remito", uselist=False
    )

    @property
    def estado_actual(self) -> EstadoRemito:
        return estado_remito_desde(self.estado)

    def cambiar_estado(self, nuevo: EstadoRemito) -> None:
        self.estado = nuevo.nombre

    # Operaciones delegadas al estado actual (patrón State)
    def despachar(self, registro: RegistroCambio) -> None:
        self.estado_actual.despachar(self, registro)

    def validar_evento_envio(self) -> None:
        self.estado_actual.validar_evento_envio(self)

    def recibir(self, registro: RegistroCambio, rechazos: dict[int, MotivoRechazo]) -> None:
        self.estado_actual.recibir(self, registro, rechazos)

    def rechazar(self, motivo: MotivoRechazo, registro: RegistroCambio) -> None:
        self.estado_actual.rechazar(self, motivo, registro)

    @property
    def horas_en_transito(self) -> float | None:
        if self.fecha_despacho and self.fecha_recepcion:
            return round((self.fecha_recepcion - self.fecha_despacho).total_seconds() / 3600, 1)
        return None


class PrecintoSanitario(Base):
    """Precinto que sella la conservadora. Si llega roto, se rechaza todo el remito."""

    __tablename__ = "precintos_sanitarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True)
    remito_id: Mapped[int] = mapped_column(ForeignKey("remitos_biologicos.id"), unique=True)
    fecha_colocacion: Mapped[datetime] = mapped_column(default=datetime.now)
    estado: Mapped[EstadoPrecinto] = mapped_column(default=EstadoPrecinto.INTACTO)
    fecha_verificacion: Mapped[datetime | None]
    verificado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))

    remito: Mapped[RemitoBiologico] = relationship(back_populates="precinto")
    verificado_por: Mapped[Usuario | None] = relationship()


class EventoEnvio(Base):
    """Eslabón de la cadena de custodia entre la clínica y el laboratorio."""

    __tablename__ = "eventos_envio"

    id: Mapped[int] = mapped_column(primary_key=True)
    remito_id: Mapped[int] = mapped_column(ForeignKey("remitos_biologicos.id"))
    fecha: Mapped[datetime] = mapped_column(default=datetime.now)
    tipo: Mapped[TipoEventoEnvio]
    ubicacion: Mapped[str] = mapped_column(String(150))
    responsable: Mapped[str] = mapped_column(String(100))
    temperatura: Mapped[float | None]
    fuera_de_rango: Mapped[bool] = mapped_column(default=False)
    observacion: Mapped[str | None] = mapped_column(Text)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))

    remito: Mapped[RemitoBiologico] = relationship(back_populates="eventos")


@event.listens_for(EventoEnvio, "before_update")
@event.listens_for(EventoEnvio, "before_delete")
def _impedir_cambios_en_cadena(_mapper, _conexion, _registro) -> None:
    raise TrazabilidadInmutableError("Los eventos de la cadena de envío no pueden modificarse.")


class RecepcionLaboratorio(Base):
    __tablename__ = "recepciones_laboratorio"

    id: Mapped[int] = mapped_column(primary_key=True)
    remito_id: Mapped[int] = mapped_column(ForeignKey("remitos_biologicos.id"), unique=True)
    fecha: Mapped[datetime] = mapped_column(default=datetime.now)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    estado_precinto: Mapped[EstadoPrecinto]
    codigo_precinto_verificado: Mapped[str] = mapped_column(String(30))
    temperatura_llegada: Mapped[float | None]
    aceptada: Mapped[bool]
    observaciones: Mapped[str | None] = mapped_column(Text)

    remito: Mapped[RemitoBiologico] = relationship(back_populates="recepcion")
    usuario: Mapped[Usuario | None] = relationship()
