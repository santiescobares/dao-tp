"""Validaciones de negocio pedidas en la consigna y reglas de los procesos."""
from datetime import date, datetime, time, timedelta

import pytest
from pydantic import ValidationError

from app.core.excepciones import ErrorNegocio, NoEncontradoError, TurnoSuperpuestoError
from app.modelos.enums import (
    EstadoConservadora,
    EstadoPrecinto,
    MotivoRechazo,
    Sexo,
    TipoAtencion,
    TipoTurno,
)
from app.schemas.clinico import AtencionEntrada, MascotaEntrada, VacunaAplicadaEntrada
from app.schemas.gestion import TurnoEntrada
from app.schemas.laboratorio import (
    DespachoEntrada,
    RecepcionEntrada,
    RechazoIndividual,
    RemitoEntrada,
    ResultadoEntrada,
)
from app.servicios.agenda import ServicioAgenda
from app.servicios.clinico import ServicioAtenciones, ServicioMascotas
from app.servicios.envios import ServicioRemitos
from app.servicios.facturacion import ServicioFacturacion
from app.servicios.laboratorio import ServicioMuestras
from tests.conftest import registrar_atencion_con_analisis


def _remito_en_transito(sesion, datos, tipos, horas_atras=3):
    atencion, _ = registrar_atencion_con_analisis(sesion, datos, tipos, horas_atras)
    servicio = ServicioRemitos(sesion)
    ids = [m.id for m in atencion.ordenes[0].muestras]
    remito = servicio.crear(RemitoEntrada(conservadora_id=datos.conservadora.id, muestra_ids=ids),
                            datos.veterinario)
    servicio.despachar(remito.id, DespachoEntrada(transportista="LogiVet", ubicacion="Clínica"),
                       datos.veterinario)
    return atencion, remito


# ---------- Toda mascota debe tener un responsable ----------
def test_mascota_sin_responsable_no_se_puede_crear(sesion, datos):
    with pytest.raises(ValidationError):
        MascotaEntrada(nombre="Sin dueño", especie_id=1, sexo=Sexo.MACHO, fecha_nacimiento=date(2024, 1, 1))
    with pytest.raises(NoEncontradoError):
        ServicioMascotas(sesion).crear(MascotaEntrada(
            nombre="Huérfana", especie_id=1, sexo=Sexo.HEMBRA,
            fecha_nacimiento=date(2024, 1, 1), cliente_id=9999,
        ))


def test_mascota_nueva_tiene_historia_clinica(datos):
    assert datos.mascota.historia.numero.startswith("HC-")


# ---------- Precinto roto => muestra rechazada ----------
def test_precinto_roto_rechaza_todo_el_remito(sesion, datos):
    _, remito = _remito_en_transito(sesion, datos, [datos.hemograma, datos.urianalisis])
    ServicioRemitos(sesion).recibir(remito.id, RecepcionEntrada(
        estado_precinto=EstadoPrecinto.ROTO, codigo_precinto=remito.precinto.codigo,
    ), datos.laboratorista)

    assert remito.estado == "RECHAZADO"
    assert remito.precinto.estado == EstadoPrecinto.ROTO
    assert all(m.estado == "RECHAZADA" for m in remito.muestras)
    assert all(m.motivo_rechazo == MotivoRechazo.PRECINTO_ROTO for m in remito.muestras)
    assert datos.conservadora.estado == EstadoConservadora.DISPONIBLE

    # ...y no se pueden cargar resultados
    with pytest.raises(ErrorNegocio):
        ServicioMuestras(sesion).registrar_resultado(
            remito.muestras[0].id, ResultadoEntrada(valores="---", conclusion="---"), datos.laboratorista
        )


def test_codigo_de_precinto_distinto_pide_verificar_y_no_rechaza(sesion, datos):
    _, remito = _remito_en_transito(sesion, datos, [datos.hemograma])
    with pytest.raises(ErrorNegocio, match="no coincide"):
        ServicioRemitos(sesion).recibir(remito.id, RecepcionEntrada(
            estado_precinto=EstadoPrecinto.INTACTO, codigo_precinto="PS-FALSO",
        ), datos.laboratorista)
    sesion.rollback()
    assert remito.estado == "EN_TRANSITO"
    assert all(m.estado == "EN_TRANSITO" for m in remito.muestras)


def test_precinto_intacto_con_codigo_correcto_se_recibe(sesion, datos):
    _, remito = _remito_en_transito(sesion, datos, [datos.hemograma])
    ServicioRemitos(sesion).recibir(remito.id, RecepcionEntrada(
        estado_precinto=EstadoPrecinto.INTACTO, codigo_precinto=f"  {remito.precinto.codigo.lower()} ",
        temperatura_llegada=5,
    ), datos.laboratorista)
    assert remito.estado == "RECIBIDO"
    assert remito.precinto.estado == EstadoPrecinto.INTACTO
    assert remito.muestras[0].estado == "RECIBIDA"


def test_recepcion_detecta_temperatura_y_tiempo_excedido(sesion, datos):
    # La orina viaja más de 24 h => vence; el hemograma (48 h) llega bien
    _, remito = _remito_en_transito(sesion, datos, [datos.hemograma, datos.urianalisis], horas_atras=30)
    ServicioRemitos(sesion).recibir(remito.id, RecepcionEntrada(
        estado_precinto=EstadoPrecinto.INTACTO, codigo_precinto=remito.precinto.codigo.lower(),
        temperatura_llegada=5,
    ), datos.laboratorista)
    por_analisis = {m.tipo_analisis.nombre: m for m in remito.muestras}
    assert remito.estado == "RECIBIDO"
    assert por_analisis["Hemograma"].estado == "RECIBIDA"
    assert por_analisis["Urianálisis"].motivo_rechazo == MotivoRechazo.TIEMPO_EXCEDIDO

    _, remito2 = _remito_en_transito(sesion, datos, [datos.hemograma])
    ServicioRemitos(sesion).recibir(remito2.id, RecepcionEntrada(
        estado_precinto=EstadoPrecinto.INTACTO, codigo_precinto=remito2.precinto.codigo,
        temperatura_llegada=14,
    ), datos.laboratorista)
    assert remito2.muestras[0].motivo_rechazo == MotivoRechazo.TEMPERATURA_FUERA_RANGO


def test_rechazo_individual_en_recepcion(sesion, datos):
    _, remito = _remito_en_transito(sesion, datos, [datos.hemograma, datos.hemograma])
    rechazada = remito.muestras[0]
    ServicioRemitos(sesion).recibir(remito.id, RecepcionEntrada(
        estado_precinto=EstadoPrecinto.INTACTO, codigo_precinto=remito.precinto.codigo,
        rechazos=[RechazoIndividual(muestra_id=rechazada.id, motivo=MotivoRechazo.MUESTRA_NO_APTA)],
    ), datos.laboratorista)
    assert rechazada.estado == "RECHAZADA"
    assert remito.muestras[1].estado == "RECIBIDA"


def test_empaquetado_valida_capacidad_y_temperatura(sesion, datos):
    atencion, _ = registrar_atencion_con_analisis(sesion, datos, [datos.hemograma] * 4)
    ids = [m.id for m in atencion.ordenes[0].muestras]
    with pytest.raises(ErrorNegocio, match="admite hasta"):
        ServicioRemitos(sesion).crear(RemitoEntrada(conservadora_id=datos.conservadora.id, muestra_ids=ids),
                                      datos.veterinario)
    datos.hemograma.temperatura_min = 15
    datos.hemograma.temperatura_max = 25
    with pytest.raises(ErrorNegocio, match="requiere entre"):
        ServicioRemitos(sesion).crear(RemitoEntrada(conservadora_id=datos.conservadora.id, muestra_ids=ids[:1]),
                                      datos.veterinario)


def test_no_se_registran_eventos_en_un_remito_preparado(sesion, datos):
    atencion, _ = registrar_atencion_con_analisis(sesion, datos, [datos.hemograma])
    remito = ServicioRemitos(sesion).crear(
        RemitoEntrada(conservadora_id=datos.conservadora.id, muestra_ids=[atencion.ordenes[0].muestras[0].id]),
        datos.veterinario,
    )
    with pytest.raises(ErrorNegocio):
        remito.validar_evento_envio()


# ---------- Superposición de turnos ----------
def _proximo_lunes(hora: int, minuto: int = 0) -> datetime:
    hoy = date.today()
    lunes = hoy + timedelta(days=(7 - hoy.weekday()) % 7 or 7)
    return datetime.combine(lunes, time(hora, minuto))


def _turno(datos, inicio: datetime, minutos=30) -> TurnoEntrada:
    return TurnoEntrada(profesional_id=datos.vet_profesional.id, inicio=inicio,
                        fin=inicio + timedelta(minutes=minutos), tipo=TipoTurno.ATENCION,
                        motivo="Control", mascota_id=datos.mascota.id)


def test_turnos_superpuestos_se_rechazan(sesion, datos):
    agenda = ServicioAgenda(sesion)
    agenda.reservar(_turno(datos, _proximo_lunes(10)), datos.veterinario)
    with pytest.raises(TurnoSuperpuestoError):
        agenda.reservar(_turno(datos, _proximo_lunes(10, 15)), datos.veterinario)
    # Turno contiguo: no se superpone
    agenda.reservar(_turno(datos, _proximo_lunes(10, 30)), datos.veterinario)


def test_turno_cancelado_libera_el_horario(sesion, datos):
    agenda = ServicioAgenda(sesion)
    turno = agenda.reservar(_turno(datos, _proximo_lunes(11)), datos.veterinario)
    agenda.cancelar(turno.id, datos.veterinario)
    agenda.reservar(_turno(datos, _proximo_lunes(11)), datos.veterinario)


def test_turno_fuera_del_horario_de_atencion(sesion, datos):
    with pytest.raises(ErrorNegocio, match="no atiende"):
        ServicioAgenda(sesion).reservar(_turno(datos, _proximo_lunes(20)), datos.veterinario)


# ---------- Esquema de vacunas obligatorias ----------
def test_atencion_advierte_vacunas_obligatorias_pendientes(sesion, datos):
    _, advertencias = registrar_atencion_con_analisis(sesion, datos, [])
    assert any("Antirrábica" in a for a in advertencias)


def test_aplicar_la_vacuna_en_la_atencion_quita_la_advertencia(sesion, datos):
    _, advertencias = ServicioAtenciones(sesion).registrar(AtencionEntrada(
        mascota_id=datos.mascota.id, tipo=TipoAtencion.CONTROL, motivo="Vacunación",
        vacunas=[VacunaAplicadaEntrada(vacuna_id=datos.vacuna_obligatoria.id, lote="L1")],
    ), datos.veterinario)
    assert advertencias == []


# ---------- Comprobante ----------
def test_comprobante_no_cobra_muestras_rechazadas(sesion, datos):
    atencion, remito = _remito_en_transito(sesion, datos, [datos.hemograma, datos.urianalisis])
    ServicioRemitos(sesion).recibir(remito.id, RecepcionEntrada(
        estado_precinto=EstadoPrecinto.ROTO, codigo_precinto=remito.precinto.codigo,
    ), datos.laboratorista)
    comprobante = ServicioFacturacion(sesion).emitir(atencion.id, datos.veterinario)
    assert [i.tipo.value for i in comprobante.items] == ["CONSULTA"]
    with pytest.raises(ErrorNegocio, match="ya tiene"):
        ServicioFacturacion(sesion).emitir(atencion.id, datos.veterinario)


def test_comprobante_incluye_laboratorio_y_vacunas(sesion, datos):
    atencion, _ = ServicioAtenciones(sesion).registrar(AtencionEntrada(
        mascota_id=datos.mascota.id, tipo=TipoAtencion.CONSULTA, motivo="Chequeo",
        vacunas=[VacunaAplicadaEntrada(vacuna_id=datos.vacuna_obligatoria.id)],
        analisis=[datos.hemograma.id],
    ), datos.veterinario)
    comprobante = ServicioFacturacion(sesion).emitir(atencion.id, datos.veterinario)
    assert comprobante.total == 15000 + 5000 + 9000
