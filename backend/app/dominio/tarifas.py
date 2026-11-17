"""Patrón Strategy: cálculo del importe de una atención según su tipo.

El servicio de facturación no sabe cómo se cobra cada tipo de atención:
le pide a `estrategia_para(tipo)` la estrategia adecuada y la usa. Agregar
un tipo nuevo (por ejemplo, "domicilio") es sumar una clase, sin tocar el
servicio.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

from app.core.config import Configuracion
from app.modelos.enums import TipoAtencion, TipoItem

if TYPE_CHECKING:
    from app.modelos.clinico import Atencion


@dataclass
class LineaComprobante:
    concepto: str
    tipo: TipoItem
    precio_unitario: float
    cantidad: int = 1

    @property
    def subtotal(self) -> float:
        return round(self.precio_unitario * self.cantidad, 2)


class EstrategiaTarifa(ABC):
    @abstractmethod
    def calcular(self, atencion: Atencion) -> LineaComprobante:
        """Devuelve la línea del comprobante correspondiente a la atención."""


class TarifaConsulta(EstrategiaTarifa):
    def calcular(self, atencion):
        precio = Configuracion().precio_base_atencion
        return LineaComprobante("Consulta médica", TipoItem.CONSULTA, precio)


class TarifaControl(EstrategiaTarifa):
    """Los controles periódicos tienen una bonificación sobre el precio base."""

    def calcular(self, atencion):
        config = Configuracion()
        precio = config.precio_base_atencion * (1 - config.descuento_control)
        porcentaje = int(config.descuento_control * 100)
        return LineaComprobante(
            f"Control periódico ({porcentaje}% bonificado)", TipoItem.CONTROL, precio
        )


class TarifaUrgencia(EstrategiaTarifa):
    """Las urgencias tienen recargo, mayor si se atienden en horario nocturno."""

    def calcular(self, atencion):
        config = Configuracion()
        hora = atencion.fecha.hour
        nocturna = hora >= config.hora_inicio_nocturno or hora < config.hora_fin_nocturno
        recargo = config.recargo_urgencia_nocturna if nocturna else config.recargo_urgencia
        precio = config.precio_base_atencion * (1 + recargo)
        detalle = "nocturna" if nocturna else "diurna"
        return LineaComprobante(
            f"Urgencia {detalle} (+{int(recargo * 100)}%)", TipoItem.URGENCIA, precio
        )


_ESTRATEGIAS: dict[TipoAtencion, EstrategiaTarifa] = {
    TipoAtencion.CONSULTA: TarifaConsulta(),
    TipoAtencion.CONTROL: TarifaControl(),
    TipoAtencion.URGENCIA: TarifaUrgencia(),
}


def estrategia_para(tipo: TipoAtencion) -> EstrategiaTarifa:
    return _ESTRATEGIAS[tipo]
