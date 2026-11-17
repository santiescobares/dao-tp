"""Comprobantes, stock (conservadoras e insumos) y agenda de profesionales."""
from datetime import date, datetime

from fastapi import APIRouter, status

from app.routers.dependencias import PersonalClinica, Sesion, SoloAdmin, UsuarioActual
from app.schemas.gestion import (
    ComprobanteSalida,
    HorarioEntrada,
    HorarioSalida,
    InsumoEntrada,
    InsumoSalida,
    MovimientoEntrada,
    MovimientoSalida,
    TurnoEntrada,
    TurnoSalida,
)
from app.schemas.laboratorio import ConservadoraEntrada, ConservadoraSalida
from app.servicios.agenda import ServicioAgenda
from app.servicios.comun import clinica_en_alcance
from app.servicios.facturacion import ServicioFacturacion, comprobante_a_salida
from app.servicios.stock import ServicioStock

router = APIRouter(tags=["Gestión"])


# ---------- Comprobantes (proceso 7) ----------
@router.post(
    "/atenciones/{atencion_id}/comprobante",
    response_model=ComprobanteSalida,
    status_code=status.HTTP_201_CREATED,
)
def emitir_comprobante(atencion_id: int, sesion: Sesion, usuario: PersonalClinica):
    return comprobante_a_salida(ServicioFacturacion(sesion).emitir(atencion_id, usuario))


@router.get("/comprobantes", response_model=list[ComprobanteSalida])
def listar_comprobantes(
    sesion: Sesion,
    usuario: PersonalClinica,
    clinica_id: int | None = None,
    desde: date | None = None,
    hasta: date | None = None,
):
    comprobantes = ServicioFacturacion(sesion).listar(usuario, clinica_id, desde, hasta)
    return [comprobante_a_salida(c) for c in comprobantes]


@router.get("/comprobantes/{comprobante_id}", response_model=ComprobanteSalida)
def obtener_comprobante(comprobante_id: int, sesion: Sesion, usuario: PersonalClinica):
    return comprobante_a_salida(ServicioFacturacion(sesion).obtener(comprobante_id, usuario))


# ---------- Conservadoras ----------
@router.get("/conservadoras", response_model=list[ConservadoraSalida])
def listar_conservadoras(
    sesion: Sesion, usuario: UsuarioActual, clinica_id: int | None = None, estado: str | None = None
):
    return ServicioStock(sesion).listar_conservadoras(usuario, clinica_id, estado)


@router.post("/conservadoras", response_model=ConservadoraSalida, status_code=status.HTTP_201_CREATED)
def crear_conservadora(datos: ConservadoraEntrada, sesion: Sesion, usuario: PersonalClinica):
    return ServicioStock(sesion).crear_conservadora(datos, usuario)


@router.put("/conservadoras/{conservadora_id}", response_model=ConservadoraSalida)
def actualizar_conservadora(
    conservadora_id: int, datos: ConservadoraEntrada, sesion: Sesion, usuario: PersonalClinica
):
    return ServicioStock(sesion).actualizar_conservadora(conservadora_id, datos, usuario)


# ---------- Insumos ----------
@router.get("/insumos", response_model=list[InsumoSalida])
def listar_insumos(
    sesion: Sesion,
    usuario: PersonalClinica,
    clinica_id: int | None = None,
    bajo_minimo: bool = False,
):
    return ServicioStock(sesion).listar_insumos(usuario, clinica_id, bajo_minimo)


@router.post("/insumos", response_model=InsumoSalida, status_code=status.HTTP_201_CREATED)
def crear_insumo(datos: InsumoEntrada, sesion: Sesion, usuario: PersonalClinica):
    return ServicioStock(sesion).crear_insumo(datos, usuario)


@router.put("/insumos/{insumo_id}", response_model=InsumoSalida)
def actualizar_insumo(insumo_id: int, datos: InsumoEntrada, sesion: Sesion, usuario: PersonalClinica):
    return ServicioStock(sesion).actualizar_insumo(insumo_id, datos, usuario)


@router.get("/insumos/{insumo_id}/movimientos", response_model=list[MovimientoSalida])
def movimientos_insumo(insumo_id: int, sesion: Sesion, usuario: PersonalClinica):
    return ServicioStock(sesion).movimientos(insumo_id, usuario)


@router.post(
    "/insumos/{insumo_id}/movimientos",
    response_model=MovimientoSalida,
    status_code=status.HTTP_201_CREATED,
)
def registrar_movimiento(
    insumo_id: int, datos: MovimientoEntrada, sesion: Sesion, usuario: PersonalClinica
):
    return ServicioStock(sesion).registrar_movimiento(insumo_id, datos, usuario)


# ---------- Agenda ----------
@router.get("/horarios", response_model=list[HorarioSalida])
def listar_horarios(sesion: Sesion, _: UsuarioActual, profesional_id: int | None = None):
    return ServicioAgenda(sesion).listar_horarios(profesional_id)


@router.post("/horarios", response_model=HorarioSalida, status_code=status.HTTP_201_CREATED)
def crear_horario(datos: HorarioEntrada, sesion: Sesion, _: SoloAdmin):
    return ServicioAgenda(sesion).crear_horario(datos)


@router.delete("/horarios/{horario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_horario(horario_id: int, sesion: Sesion, _: SoloAdmin):
    ServicioAgenda(sesion).eliminar_horario(horario_id)


@router.get("/turnos", response_model=list[TurnoSalida])
def listar_turnos(
    sesion: Sesion,
    usuario: UsuarioActual,
    profesional_id: int | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    clinica_id: int | None = None,
):
    clinica_id = clinica_en_alcance(usuario, clinica_id)
    return ServicioAgenda(sesion).listar_turnos(profesional_id, desde, hasta, clinica_id)


@router.post("/turnos", response_model=TurnoSalida, status_code=status.HTTP_201_CREATED)
def reservar_turno(datos: TurnoEntrada, sesion: Sesion, usuario: UsuarioActual):
    return ServicioAgenda(sesion).reservar(datos, usuario)


@router.post("/turnos/{turno_id}/cancelar", response_model=TurnoSalida)
def cancelar_turno(turno_id: int, sesion: Sesion, usuario: UsuarioActual):
    return ServicioAgenda(sesion).cancelar(turno_id, usuario)
