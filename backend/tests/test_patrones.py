"""Pruebas de los patrones State, Strategy y Singleton."""
from datetime import datetime

import pytest

from app.core.config import Configuracion
from app.core.database import BaseDeDatos
from app.core.excepciones import TransicionInvalidaError, TrazabilidadInmutableError
from app.dominio.estados_muestra import RegistroCambio, estado_muestra_desde
from app.dominio.tarifas import TarifaConsulta, TarifaControl, TarifaUrgencia, estrategia_para
from app.modelos.clinico import Atencion
from app.modelos.enums import MotivoRechazo, TipoAtencion
from app.modelos.laboratorio import Muestra
from tests.conftest import registrar_atencion_con_analisis, registro


# ---------- State ----------
def test_ciclo_de_vida_completo_de_una_muestra(sesion, datos):
    atencion, _ = registrar_atencion_con_analisis(sesion, datos, [datos.hemograma])
    muestra = atencion.ordenes[0].muestras[0]
    assert muestra.estado == "EXTRAIDA"

    for paso in (muestra.empaquetar, muestra.despachar, muestra.recibir, muestra.analizar):
        paso(registro())
    sesion.commit()

    assert muestra.estado == "ANALIZADA"
    estados = [h.estado_nuevo for h in muestra.historial]
    assert estados == ["EXTRAIDA", "EMPAQUETADA", "EN_TRANSITO", "RECIBIDA", "ANALIZADA"]


@pytest.mark.parametrize("estado, operacion", [
    ("EXTRAIDA", "despachar"),
    ("EXTRAIDA", "analizar"),
    ("EMPAQUETADA", "recibir"),
    ("EN_TRANSITO", "analizar"),
    ("ANALIZADA", "empaquetar"),
])
def test_transiciones_invalidas_se_rechazan(estado, operacion):
    muestra = Muestra(codigo="M-1", estado=estado, fecha_extraccion=datetime.now())
    with pytest.raises(TransicionInvalidaError):
        getattr(muestra, operacion)(registro())
    assert muestra.estado == estado


def test_muestra_rechazada_no_puede_procesarse():
    muestra = Muestra(codigo="M-1", estado="EN_TRANSITO", fecha_extraccion=datetime.now())
    muestra.rechazar(MotivoRechazo.PRECINTO_ROTO, registro())
    assert muestra.estado == "RECHAZADA"
    assert estado_muestra_desde(muestra.estado).es_final
    with pytest.raises(TransicionInvalidaError, match="rechazada"):
        muestra.analizar(registro())


def test_historial_de_estados_es_inmutable(sesion, datos):
    atencion, _ = registrar_atencion_con_analisis(sesion, datos, [datos.hemograma])
    primer_registro = atencion.ordenes[0].muestras[0].historial[0]
    primer_registro.observacion = "intento de adulterar"
    with pytest.raises(TrazabilidadInmutableError):
        sesion.commit()
    sesion.rollback()

    with pytest.raises(TrazabilidadInmutableError):
        sesion.delete(primer_registro)
        sesion.commit()


# ---------- Strategy ----------
def _atencion(tipo: TipoAtencion, hora: int) -> Atencion:
    return Atencion(tipo=tipo, fecha=datetime(2026, 11, 10, hora, 0), motivo="x")


def test_cada_tipo_de_atencion_usa_su_estrategia():
    assert isinstance(estrategia_para(TipoAtencion.CONSULTA), TarifaConsulta)
    assert isinstance(estrategia_para(TipoAtencion.CONTROL), TarifaControl)
    assert isinstance(estrategia_para(TipoAtencion.URGENCIA), TarifaUrgencia)


def test_importes_de_cada_estrategia():
    base = Configuracion().precio_base_atencion
    assert estrategia_para(TipoAtencion.CONSULTA).calcular(_atencion(TipoAtencion.CONSULTA, 10)).subtotal == base
    assert estrategia_para(TipoAtencion.CONTROL).calcular(_atencion(TipoAtencion.CONTROL, 10)).subtotal == base * 0.8
    diurna = estrategia_para(TipoAtencion.URGENCIA).calcular(_atencion(TipoAtencion.URGENCIA, 15))
    nocturna = estrategia_para(TipoAtencion.URGENCIA).calcular(_atencion(TipoAtencion.URGENCIA, 23))
    assert diurna.subtotal == base * 1.5
    assert nocturna.subtotal == base * 1.8
    assert "nocturna" in nocturna.concepto


# ---------- Singleton ----------
def test_configuracion_es_unica():
    assert Configuracion() is Configuracion()


def test_base_de_datos_es_unica(base_temporal):
    assert BaseDeDatos() is base_temporal
    assert BaseDeDatos("sqlite:///otra.db") is base_temporal  # no se crea una segunda instancia


def test_registro_cambio_tiene_fecha_por_defecto():
    assert isinstance(RegistroCambio(None).fecha, datetime)
