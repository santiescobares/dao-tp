"""Datos maestros. Leer: cualquier usuario autenticado. Modificar: solo ADMIN."""
from fastapi import APIRouter, status

from app.modelos.enums import TipoProfesional
from app.routers.dependencias import Sesion, SoloAdmin, UsuarioActual
from app.schemas.catalogos import (
    EspecieEntrada,
    EspecieSalida,
    TipoAnalisisEntrada,
    TipoAnalisisSalida,
    VacunaEntrada,
    VacunaSalida,
)
from app.schemas.organizacion import (
    ClinicaEntrada,
    ClinicaSalida,
    ProfesionalEntrada,
    ProfesionalSalida,
    UsuarioEntrada,
    UsuarioSalida,
)
from app.servicios.administracion import ServicioAdministracion

router = APIRouter(tags=["Administración"])
CREADO = status.HTTP_201_CREATED


@router.get("/clinicas", response_model=list[ClinicaSalida])
def listar_clinicas(sesion: Sesion, _: UsuarioActual):
    return ServicioAdministracion(sesion).listar_clinicas()


@router.post("/clinicas", response_model=ClinicaSalida, status_code=CREADO)
def crear_clinica(datos: ClinicaEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).crear_clinica(datos)


@router.put("/clinicas/{clinica_id}", response_model=ClinicaSalida)
def actualizar_clinica(clinica_id: int, datos: ClinicaEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).actualizar_clinica(clinica_id, datos)


@router.get("/profesionales", response_model=list[ProfesionalSalida])
def listar_profesionales(
    sesion: Sesion,
    _: UsuarioActual,
    tipo: TipoProfesional | None = None,
    clinica_id: int | None = None,
):
    return ServicioAdministracion(sesion).listar_profesionales(tipo, clinica_id)


@router.post("/profesionales", response_model=ProfesionalSalida, status_code=CREADO)
def crear_profesional(datos: ProfesionalEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).crear_profesional(datos)


@router.put("/profesionales/{profesional_id}", response_model=ProfesionalSalida)
def actualizar_profesional(
    profesional_id: int, datos: ProfesionalEntrada, sesion: Sesion, _: SoloAdmin
):
    return ServicioAdministracion(sesion).actualizar_profesional(profesional_id, datos)


@router.get("/usuarios", response_model=list[UsuarioSalida])
def listar_usuarios(sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).listar_usuarios()


@router.post("/usuarios", response_model=UsuarioSalida, status_code=CREADO)
def crear_usuario(datos: UsuarioEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).crear_usuario(datos)


@router.put("/usuarios/{usuario_id}", response_model=UsuarioSalida)
def actualizar_usuario(usuario_id: int, datos: UsuarioEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).actualizar_usuario(usuario_id, datos)


@router.get("/especies", response_model=list[EspecieSalida])
def listar_especies(sesion: Sesion, _: UsuarioActual):
    return ServicioAdministracion(sesion).listar_especies()


@router.post("/especies", response_model=EspecieSalida, status_code=CREADO)
def crear_especie(datos: EspecieEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).crear_especie(datos)


@router.get("/vacunas", response_model=list[VacunaSalida])
def listar_vacunas(sesion: Sesion, _: UsuarioActual, especie_id: int | None = None):
    return ServicioAdministracion(sesion).listar_vacunas(especie_id)


@router.post("/vacunas", response_model=VacunaSalida, status_code=CREADO)
def crear_vacuna(datos: VacunaEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).crear_vacuna(datos)


@router.put("/vacunas/{vacuna_id}", response_model=VacunaSalida)
def actualizar_vacuna(vacuna_id: int, datos: VacunaEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).actualizar_vacuna(vacuna_id, datos)


@router.get("/tipos-analisis", response_model=list[TipoAnalisisSalida])
def listar_tipos_analisis(sesion: Sesion, _: UsuarioActual, solo_activos: bool = False):
    return ServicioAdministracion(sesion).listar_tipos_analisis(solo_activos)


@router.post("/tipos-analisis", response_model=TipoAnalisisSalida, status_code=CREADO)
def crear_tipo_analisis(datos: TipoAnalisisEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAdministracion(sesion).crear_tipo_analisis(datos)


@router.put("/tipos-analisis/{tipo_id}", response_model=TipoAnalisisSalida)
def actualizar_tipo_analisis(
    tipo_id: int, datos: TipoAnalisisEntrada, sesion: Sesion, _: SoloAdmin
):
    return ServicioAdministracion(sesion).actualizar_tipo_analisis(tipo_id, datos)
