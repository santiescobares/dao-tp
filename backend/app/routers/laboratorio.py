"""Procesos 4 a 7: empaquetado, envío, recepción, resultados y trazabilidad."""
from fastapi import APIRouter, status

from app.routers.dependencias import (
    PersonalClinica,
    PersonalLaboratorio,
    Sesion,
    SoloLaboratorista,
    UsuarioActual,
)
from app.schemas.laboratorio import (
    DespachoEntrada,
    EventoEnvioEntrada,
    MuestraSalida,
    RecepcionEntrada,
    RechazoMuestraEntrada,
    RemitoEntrada,
    RemitoSalida,
    ResultadoEntrada,
    TrazabilidadSalida,
)
from app.servicios.envios import ServicioRemitos, remito_a_salida
from app.servicios.laboratorio import ServicioMuestras

router = APIRouter(tags=["Laboratorio y envíos"])


# ---------- Muestras ----------
@router.get("/muestras", response_model=list[MuestraSalida])
def listar_muestras(
    sesion: Sesion,
    usuario: UsuarioActual,
    estado: str | None = None,
    clinica_id: int | None = None,
    q: str | None = None,
):
    muestras = ServicioMuestras(sesion).listar(usuario, estado, clinica_id, q)
    return [MuestraSalida.desde(m) for m in muestras]


@router.get("/muestras/{muestra_id}/trazabilidad", response_model=TrazabilidadSalida)
def trazabilidad(muestra_id: int, sesion: Sesion, usuario: UsuarioActual):
    return ServicioMuestras(sesion).trazabilidad(muestra_id, usuario)


@router.post("/muestras/{muestra_id}/resultado", response_model=MuestraSalida)
def registrar_resultado(
    muestra_id: int, datos: ResultadoEntrada, sesion: Sesion, usuario: SoloLaboratorista
):
    return MuestraSalida.desde(ServicioMuestras(sesion).registrar_resultado(muestra_id, datos, usuario))


@router.post("/muestras/{muestra_id}/rechazar", response_model=MuestraSalida)
def rechazar_muestra(
    muestra_id: int, datos: RechazoMuestraEntrada, sesion: Sesion, usuario: PersonalLaboratorio
):
    muestra = ServicioMuestras(sesion).rechazar(muestra_id, datos.motivo, datos.observacion, usuario)
    return MuestraSalida.desde(muestra)


# ---------- Remitos biológicos ----------
@router.get("/remitos", response_model=list[RemitoSalida])
def listar_remitos(
    sesion: Sesion, usuario: UsuarioActual, estado: str | None = None, clinica_id: int | None = None
):
    return [remito_a_salida(r) for r in ServicioRemitos(sesion).listar(usuario, estado, clinica_id)]


@router.get("/remitos/{remito_id}", response_model=RemitoSalida)
def obtener_remito(remito_id: int, sesion: Sesion, usuario: UsuarioActual):
    return remito_a_salida(ServicioRemitos(sesion).obtener(remito_id, usuario))


@router.post("/remitos", response_model=RemitoSalida, status_code=status.HTTP_201_CREATED)
def empaquetar(datos: RemitoEntrada, sesion: Sesion, usuario: PersonalClinica):
    return remito_a_salida(ServicioRemitos(sesion).crear(datos, usuario))


@router.post("/remitos/{remito_id}/despachar", response_model=RemitoSalida)
def despachar(remito_id: int, datos: DespachoEntrada, sesion: Sesion, usuario: PersonalClinica):
    return remito_a_salida(ServicioRemitos(sesion).despachar(remito_id, datos, usuario))


@router.post("/remitos/{remito_id}/eventos", response_model=RemitoSalida)
def registrar_evento(
    remito_id: int, datos: EventoEnvioEntrada, sesion: Sesion, usuario: UsuarioActual
):
    return remito_a_salida(ServicioRemitos(sesion).registrar_evento(remito_id, datos, usuario))


@router.post("/remitos/{remito_id}/recepcion", response_model=RemitoSalida)
def recibir(remito_id: int, datos: RecepcionEntrada, sesion: Sesion, usuario: PersonalLaboratorio):
    return remito_a_salida(ServicioRemitos(sesion).recibir(remito_id, datos, usuario))
