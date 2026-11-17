"""Procesos 1, 2 y 3: clientes, mascotas con historia clínica y atenciones."""
from datetime import date

from fastapi import APIRouter, status

from app.routers.dependencias import PersonalClinica, Sesion, UsuarioActual
from app.schemas.clinico import (
    AtencionEntrada,
    AtencionRegistrada,
    AtencionSalida,
    ClienteEntrada,
    ClienteSalida,
    HistoriaClinicaSalida,
    HistoriaEntrada,
    MascotaEntrada,
    MascotaSalida,
    VacunaPendiente,
)
from app.servicios.clinico import (
    ServicioAtenciones,
    ServicioClientes,
    ServicioMascotas,
    ServicioVacunacion,
)

router = APIRouter(tags=["Clínica"])


# ---------- Clientes ----------
@router.get("/clientes", response_model=list[ClienteSalida])
def listar_clientes(sesion: Sesion, _: UsuarioActual, q: str | None = None):
    return ServicioClientes(sesion).listar(q)


@router.get("/clientes/{cliente_id}", response_model=ClienteSalida)
def obtener_cliente(cliente_id: int, sesion: Sesion, _: UsuarioActual):
    return ServicioClientes(sesion).obtener(cliente_id)


@router.post("/clientes", response_model=ClienteSalida, status_code=status.HTTP_201_CREATED)
def crear_cliente(datos: ClienteEntrada, sesion: Sesion, _: PersonalClinica):
    return ServicioClientes(sesion).crear(datos)


@router.put("/clientes/{cliente_id}", response_model=ClienteSalida)
def actualizar_cliente(cliente_id: int, datos: ClienteEntrada, sesion: Sesion, _: PersonalClinica):
    return ServicioClientes(sesion).actualizar(cliente_id, datos)


@router.delete("/clientes/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cliente(cliente_id: int, sesion: Sesion, _: PersonalClinica):
    ServicioClientes(sesion).eliminar(cliente_id)


# ---------- Mascotas e historia clínica ----------
@router.get("/mascotas", response_model=list[MascotaSalida])
def listar_mascotas(
    sesion: Sesion, _: UsuarioActual, q: str | None = None, cliente_id: int | None = None
):
    return ServicioMascotas(sesion).listar(q, cliente_id)


@router.get("/mascotas/{mascota_id}", response_model=MascotaSalida)
def obtener_mascota(mascota_id: int, sesion: Sesion, _: UsuarioActual):
    return ServicioMascotas(sesion).obtener(mascota_id)


@router.post("/mascotas", response_model=MascotaSalida, status_code=status.HTTP_201_CREATED)
def crear_mascota(datos: MascotaEntrada, sesion: Sesion, _: PersonalClinica):
    return ServicioMascotas(sesion).crear(datos)


@router.put("/mascotas/{mascota_id}", response_model=MascotaSalida)
def actualizar_mascota(mascota_id: int, datos: MascotaEntrada, sesion: Sesion, _: PersonalClinica):
    return ServicioMascotas(sesion).actualizar(mascota_id, datos)


@router.put("/mascotas/{mascota_id}/historia", response_model=MascotaSalida)
def actualizar_historia(
    mascota_id: int, datos: HistoriaEntrada, sesion: Sesion, _: PersonalClinica
):
    return ServicioMascotas(sesion).actualizar_historia(mascota_id, datos)


@router.get("/mascotas/{mascota_id}/historia", response_model=HistoriaClinicaSalida)
def historia_clinica(mascota_id: int, sesion: Sesion, _: UsuarioActual):
    mascota = ServicioMascotas(sesion).obtener(mascota_id)
    return HistoriaClinicaSalida(
        mascota=MascotaSalida.model_validate(mascota),
        atenciones=[AtencionSalida.model_validate(a) for a in mascota.historia.atenciones],
        vacunas_aplicadas=mascota.vacunas_aplicadas,
        vacunas_pendientes=ServicioVacunacion().pendientes(mascota),
    )


@router.get("/mascotas/{mascota_id}/vacunas-pendientes", response_model=list[VacunaPendiente])
def vacunas_pendientes(mascota_id: int, sesion: Sesion, _: UsuarioActual):
    return ServicioVacunacion().pendientes(ServicioMascotas(sesion).obtener(mascota_id))


# ---------- Atenciones ----------
@router.get("/atenciones", response_model=list[AtencionSalida])
def listar_atenciones(
    sesion: Sesion,
    usuario: PersonalClinica,
    clinica_id: int | None = None,
    mascota_id: int | None = None,
    desde: date | None = None,
    hasta: date | None = None,
):
    return ServicioAtenciones(sesion).listar(usuario, clinica_id, mascota_id, desde, hasta)


@router.get("/atenciones/{atencion_id}", response_model=AtencionSalida)
def obtener_atencion(atencion_id: int, sesion: Sesion, usuario: PersonalClinica):
    servicio = ServicioAtenciones(sesion)
    atencion = servicio.obtener(atencion_id)
    servicio.verificar_acceso(atencion, usuario)
    return atencion


@router.post("/atenciones", response_model=AtencionRegistrada, status_code=status.HTTP_201_CREATED)
def registrar_atencion(datos: AtencionEntrada, sesion: Sesion, usuario: PersonalClinica):
    atencion, advertencias = ServicioAtenciones(sesion).registrar(datos, usuario)
    return AtencionRegistrada(
        atencion=AtencionSalida.model_validate(atencion), advertencias=advertencias
    )
