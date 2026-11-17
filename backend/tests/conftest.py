"""Fixtures compartidas: base de datos temporal con un set mínimo de datos."""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

import pytest

from app.core.database import BaseDeDatos
from app.core.singleton import SingletonMeta
from app.dominio.estados_muestra import RegistroCambio
from app.modelos.agenda import HorarioProfesional
from app.modelos.clinico import Especie, Mascota, Vacuna
from app.modelos.enums import Rol, Sexo, TipoAtencion, TipoMuestra, TipoProfesional
from app.modelos.envio import Conservadora
from app.modelos.laboratorio import TipoAnalisis
from app.modelos.organizacion import Clinica, Laboratorio, Profesional, Usuario
from app.schemas.clinico import AtencionEntrada, ClienteEntrada, MascotaEntrada
from app.servicios.clinico import ServicioAtenciones, ServicioClientes, ServicioMascotas


@pytest.fixture
def base_temporal(tmp_path):
    SingletonMeta.reiniciar(BaseDeDatos)
    base = BaseDeDatos(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    base.crear_tablas()
    yield base
    base.engine.dispose()
    SingletonMeta.reiniciar(BaseDeDatos)


@pytest.fixture
def sesion(base_temporal):
    with base_temporal.nueva_sesion() as sesion:
        yield sesion


@dataclass
class Datos:
    clinica: Clinica
    veterinario: Usuario
    laboratorista: Usuario
    vet_profesional: Profesional
    lab_profesional: Profesional
    mascota: Mascota
    hemograma: TipoAnalisis
    urianalisis: TipoAnalisis
    conservadora: Conservadora
    vacuna_obligatoria: Vacuna


@pytest.fixture
def datos(sesion) -> Datos:
    clinica = Clinica(nombre="Clínica Test", direccion="Calle 1", telefono="351 000-0000")
    sesion.add_all([clinica, Laboratorio(nombre="Lab Central", direccion="Calle 2")])
    vet = Profesional(nombre="Ana", apellido="Vet", matricula="MP-1", especialidad="General",
                      tipo=TipoProfesional.VETERINARIO, clinica=clinica)
    lab = Profesional(nombre="Luis", apellido="Lab", matricula="BQ-1", especialidad="Bioquímica",
                      tipo=TipoProfesional.LABORATORISTA)
    usuario_vet = Usuario(email="vet@test.com", nombre="Vet", rol=Rol.VETERINARIO, password_hash="x", profesional=vet)
    usuario_lab = Usuario(email="lab@test.com", nombre="Lab", rol=Rol.LABORATORISTA, password_hash="x", profesional=lab)
    perro = Especie(nombre="Perro")
    vacuna = Vacuna(nombre="Antirrábica", especie=perro, obligatoria=True, edad_minima_semanas=12,
                    refuerzo_meses=12, precio=5000)
    hemograma = TipoAnalisis(nombre="Hemograma", tipo_muestra=TipoMuestra.SANGRE, precio=9000,
                             temperatura_min=2, temperatura_max=8, horas_viabilidad=48)
    urianalisis = TipoAnalisis(nombre="Urianálisis", tipo_muestra=TipoMuestra.ORINA, precio=7000,
                               temperatura_min=2, temperatura_max=8, horas_viabilidad=24)
    conservadora = Conservadora(codigo="CR-01", clinica=clinica, descripcion="Refrigerada",
                                capacidad=3, temperatura_min=2, temperatura_max=8)
    sesion.add_all([vet, lab, usuario_vet, usuario_lab, perro, vacuna, hemograma, urianalisis, conservadora])
    for dia in range(7):
        sesion.add(HorarioProfesional(profesional=vet, dia_semana=dia, hora_desde=time(9), hora_hasta=time(18)))
    sesion.commit()

    cliente = ServicioClientes(sesion).crear(
        ClienteEntrada(dni="30111222", nombre="Juan", apellido="Pérez", telefono="351 555-1234")
    )
    mascota = ServicioMascotas(sesion).crear(MascotaEntrada(
        nombre="Toby", especie_id=perro.id, sexo=Sexo.MACHO,
        fecha_nacimiento=date.today() - timedelta(days=400), cliente_id=cliente.id,
    ))
    return Datos(clinica, usuario_vet, usuario_lab, vet, lab, mascota, hemograma, urianalisis,
                 conservadora, vacuna)


def registrar_atencion_con_analisis(sesion, datos: Datos, tipos: list[TipoAnalisis], horas_atras=2,
                                    tipo=TipoAtencion.CONSULTA):
    atencion, advertencias = ServicioAtenciones(sesion).registrar(AtencionEntrada(
        mascota_id=datos.mascota.id, tipo=tipo, motivo="Control general",
        fecha=datetime.now() - timedelta(hours=horas_atras), analisis=[t.id for t in tipos],
    ), datos.veterinario)
    return atencion, advertencias


def registro(usuario_id=None) -> RegistroCambio:
    return RegistroCambio(usuario_id)
