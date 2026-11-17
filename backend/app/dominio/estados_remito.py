"""Patrón State: ciclo de vida del remito biológico.

    PREPARADO ─► EN_TRANSITO ─► RECIBIDO
                     │
                     └────────► RECHAZADO  (precinto sanitario roto)

El remito es el contenedor lógico de las muestras que viajan en una
conservadora. Al cambiar de estado, propaga el cambio a cada una de sus
muestras, que a su vez validan la transición con su propio State.
"""
from __future__ import annotations

from abc import ABC
from typing import TYPE_CHECKING

from app.core.excepciones import ErrorNegocio, TransicionInvalidaError
from app.dominio.estados_muestra import RegistroCambio
from app.modelos.enums import MotivoRechazo

if TYPE_CHECKING:
    from app.modelos.envio import RemitoBiologico


class EstadoRemito(ABC):
    nombre: str = ""
    descripcion: str = ""
    es_final: bool = False

    def despachar(self, remito: RemitoBiologico, registro: RegistroCambio) -> None:
        self._no_permitido("despachar")

    def validar_evento_envio(self, remito: RemitoBiologico) -> None:
        self._no_permitido("registrar eventos de envío en")

    def recibir(
        self,
        remito: RemitoBiologico,
        registro: RegistroCambio,
        rechazos: dict[int, MotivoRechazo],
    ) -> None:
        self._no_permitido("recibir")

    def rechazar(
        self, remito: RemitoBiologico, motivo: MotivoRechazo, registro: RegistroCambio
    ) -> None:
        self._no_permitido("rechazar")

    def _no_permitido(self, accion: str) -> None:
        raise TransicionInvalidaError(
            f"No se puede {accion} un remito en estado '{self.descripcion}'."
        )


class Preparado(EstadoRemito):
    nombre = "PREPARADO"
    descripcion = "Preparado"

    def despachar(self, remito, registro):
        if not remito.muestras:
            raise ErrorNegocio("El remito no contiene muestras.")
        for muestra in remito.muestras:
            muestra.despachar(registro)
        remito.fecha_despacho = registro.fecha
        remito.cambiar_estado(EnTransitoRemito())


class EnTransitoRemito(EstadoRemito):
    nombre = "EN_TRANSITO"
    descripcion = "En tránsito"

    def validar_evento_envio(self, remito):
        pass  # en tránsito se pueden registrar puntos de control

    def recibir(self, remito, registro, rechazos):
        # Precinto intacto: cada muestra se recibe, salvo las rechazadas puntualmente
        for muestra in remito.muestras:
            if muestra.id in rechazos:
                muestra.rechazar(rechazos[muestra.id], registro)
            else:
                muestra.recibir(registro)
        remito.fecha_recepcion = registro.fecha
        remito.cambiar_estado(Recibido())

    def rechazar(self, remito, motivo, registro):
        # Precinto roto: se rechaza todo el contenido de la conservadora
        for muestra in remito.muestras:
            muestra.rechazar(motivo, registro)
        remito.fecha_recepcion = registro.fecha
        remito.cambiar_estado(Rechazado())


class Recibido(EstadoRemito):
    nombre = "RECIBIDO"
    descripcion = "Recibido"
    es_final = True


class Rechazado(EstadoRemito):
    nombre = "RECHAZADO"
    descripcion = "Rechazado"
    es_final = True


ESTADOS_REMITO: dict[str, type[EstadoRemito]] = {
    clase.nombre: clase for clase in (Preparado, EnTransitoRemito, Recibido, Rechazado)
}


def estado_remito_desde(nombre: str) -> EstadoRemito:
    return ESTADOS_REMITO[nombre]()
