"""Reportes de gestión y tablero de inicio."""
from datetime import date, timedelta

from fastapi import APIRouter

from app.routers.dependencias import Sesion, UsuarioActual
from app.servicios.comun import clinica_en_alcance
from app.servicios.reportes import FiltroReporte, ServicioReportes

router = APIRouter(prefix="/reportes", tags=["Reportes"])


def _filtro(usuario, desde: date | None, hasta: date | None, clinica_id: int | None) -> FiltroReporte:
    hasta = hasta or date.today()
    desde = desde or hasta - timedelta(days=180)
    # Un veterinario solo ve los reportes de su clínica
    return FiltroReporte(desde, hasta, clinica_en_alcance(usuario, clinica_id))


@router.get("/tablero")
def tablero(sesion: Sesion, usuario: UsuarioActual):
    return ServicioReportes(sesion).tablero(clinica_en_alcance(usuario, None))


@router.get("/atenciones")
def atenciones_y_derivaciones(
    sesion: Sesion, usuario: UsuarioActual,
    desde: date | None = None, hasta: date | None = None, clinica_id: int | None = None,
):
    return ServicioReportes(sesion).atenciones_y_derivaciones(_filtro(usuario, desde, hasta, clinica_id))


@router.get("/rechazos")
def rechazos_por_transporte(
    sesion: Sesion, usuario: UsuarioActual,
    desde: date | None = None, hasta: date | None = None, clinica_id: int | None = None,
):
    return ServicioReportes(sesion).rechazos_por_transporte(_filtro(usuario, desde, hasta, clinica_id))


@router.get("/tiempos")
def tiempos(
    sesion: Sesion, usuario: UsuarioActual,
    desde: date | None = None, hasta: date | None = None, clinica_id: int | None = None,
):
    return ServicioReportes(sesion).tiempos_de_transito_y_procesamiento(
        _filtro(usuario, desde, hasta, clinica_id)
    )


@router.get("/facturacion")
def facturacion(
    sesion: Sesion, usuario: UsuarioActual,
    desde: date | None = None, hasta: date | None = None, clinica_id: int | None = None,
):
    return ServicioReportes(sesion).facturacion(_filtro(usuario, desde, hasta, clinica_id))


@router.get("/tratamientos-vacunas")
def tratamientos_y_vacunas(
    sesion: Sesion, usuario: UsuarioActual,
    desde: date | None = None, hasta: date | None = None, clinica_id: int | None = None,
):
    return ServicioReportes(sesion).tratamientos_y_vacunas(_filtro(usuario, desde, hasta, clinica_id))
