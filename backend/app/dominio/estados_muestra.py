"""Patrón State: ciclo de vida de una muestra biológica.

    EXTRAIDA ─► EMPAQUETADA ─► EN_TRANSITO ─► RECIBIDA ─► ANALIZADA
                                   │              │
                                   └──► RECHAZADA ◄┘

Cada estado concreto sabe qué operaciones admite. Si se pide una operación
que el estado no permite, se lanza TransicionInvalidaError. Así la regla
"no procesar una muestra con precinto roto" no depende de un if en el
servicio: una muestra Rechazada simplemente no sabe analizarse.

El contexto del patrón es la clase `Muestra` (app/modelos/laboratorio.py), que
guarda el nombre del estado en la BD y delega cada operación en su estado.
"""
from __future__ import annotations

from abc import ABC
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

from app.core.excepciones import TransicionInvalidaError
from app.modelos.enums import MotivoRechazo

if TYPE_CHECKING:
    from app.modelos.laboratorio import Muestra


@dataclass
class RegistroCambio:
    """Datos de auditoría de un cambio de estado: quién, cuándo y por qué."""

    usuario_id: int | None
    observacion: str | None = None
    fecha: datetime = field(default_factory=datetime.now)


class EstadoMuestra(ABC):
    """Estado abstracto. Por defecto ninguna operación está permitida."""

    nombre: str = ""
    descripcion: str = ""
    es_final: bool = False

    def empaquetar(self, muestra: Muestra, registro: RegistroCambio) -> None:
        self._no_permitido("empaquetar")

    def despachar(self, muestra: Muestra, registro: RegistroCambio) -> None:
        self._no_permitido("despachar")

    def recibir(self, muestra: Muestra, registro: RegistroCambio) -> None:
        self._no_permitido("recibir en el laboratorio")

    def rechazar(self, muestra: Muestra, motivo: MotivoRechazo, registro: RegistroCambio) -> None:
        self._no_permitido("rechazar")

    def analizar(self, muestra: Muestra, registro: RegistroCambio) -> None:
        self._no_permitido("registrar resultados de")

    def _no_permitido(self, accion: str) -> None:
        raise TransicionInvalidaError(
            f"No se puede {accion} una muestra en estado '{self.descripcion}'."
        )


class Extraida(EstadoMuestra):
    nombre = "EXTRAIDA"
    descripcion = "Extraída"

    def empaquetar(self, muestra, registro):
        muestra.cambiar_estado(Empaquetada(), registro)


class Empaquetada(EstadoMuestra):
    nombre = "EMPAQUETADA"
    descripcion = "Empaquetada"

    def despachar(self, muestra, registro):
        muestra.cambiar_estado(EnTransito(), registro)


class EnTransito(EstadoMuestra):
    nombre = "EN_TRANSITO"
    descripcion = "En tránsito"

    def recibir(self, muestra, registro):
        muestra.cambiar_estado(Recibida(), registro)

    def rechazar(self, muestra, motivo, registro):
        muestra.motivo_rechazo = motivo
        muestra.cambiar_estado(Rechazada(), registro)


class Recibida(EstadoMuestra):
    nombre = "RECIBIDA"
    descripcion = "Recibida"

    def analizar(self, muestra, registro):
        muestra.cambiar_estado(Analizada(), registro)

    def rechazar(self, muestra, motivo, registro):
        # El laboratorio puede descartar una muestra recibida que resulta no apta
        muestra.motivo_rechazo = motivo
        muestra.cambiar_estado(Rechazada(), registro)


class Analizada(EstadoMuestra):
    nombre = "ANALIZADA"
    descripcion = "Analizada"
    es_final = True


class Rechazada(EstadoMuestra):
    nombre = "RECHAZADA"
    descripcion = "Muestra rechazada"
    es_final = True

    def analizar(self, muestra, registro):
        motivo = muestra.motivo_rechazo.value if muestra.motivo_rechazo else "sin motivo"
        raise TransicionInvalidaError(
            f"La muestra {muestra.codigo} fue rechazada ({motivo}) y no puede procesarse."
        )


# Tabla para reconstruir el objeto estado a partir del texto guardado en la BD
ESTADOS_MUESTRA: dict[str, type[EstadoMuestra]] = {
    clase.nombre: clase
    for clase in (Extraida, Empaquetada, EnTransito, Recibida, Analizada, Rechazada)
}


def estado_muestra_desde(nombre: str) -> EstadoMuestra:
    return ESTADOS_MUESTRA[nombre]()
