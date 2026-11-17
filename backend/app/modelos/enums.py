"""Enumeraciones del dominio. Se guardan como texto en la base de datos."""
from enum import StrEnum


class Rol(StrEnum):
    ADMIN = "ADMIN"
    VETERINARIO = "VETERINARIO"
    LABORATORISTA = "LABORATORISTA"


class TipoProfesional(StrEnum):
    VETERINARIO = "VETERINARIO"
    LABORATORISTA = "LABORATORISTA"


class Sexo(StrEnum):
    MACHO = "MACHO"
    HEMBRA = "HEMBRA"


class TipoAtencion(StrEnum):
    CONSULTA = "CONSULTA"
    CONTROL = "CONTROL"
    URGENCIA = "URGENCIA"


class TipoMuestra(StrEnum):
    SANGRE = "SANGRE"
    ORINA = "ORINA"
    HECES = "HECES"
    TEJIDO = "TEJIDO"
    HISOPADO = "HISOPADO"


class MotivoRechazo(StrEnum):
    PRECINTO_ROTO = "PRECINTO_ROTO"
    TEMPERATURA_FUERA_RANGO = "TEMPERATURA_FUERA_RANGO"
    TIEMPO_EXCEDIDO = "TIEMPO_EXCEDIDO"
    MUESTRA_NO_APTA = "MUESTRA_NO_APTA"


class EstadoPrecinto(StrEnum):
    INTACTO = "INTACTO"
    ROTO = "ROTO"


class EstadoConservadora(StrEnum):
    DISPONIBLE = "DISPONIBLE"
    EN_USO = "EN_USO"
    MANTENIMIENTO = "MANTENIMIENTO"
    BAJA = "BAJA"


class TipoEventoEnvio(StrEnum):
    DESPACHO = "DESPACHO"
    PUNTO_CONTROL = "PUNTO_CONTROL"
    ENTREGA = "ENTREGA"


class TipoMovimiento(StrEnum):
    INGRESO = "INGRESO"
    EGRESO = "EGRESO"
    AJUSTE = "AJUSTE"


class TipoTurno(StrEnum):
    ATENCION = "ATENCION"
    PROCESAMIENTO = "PROCESAMIENTO"


class EstadoTurno(StrEnum):
    RESERVADO = "RESERVADO"
    ATENDIDO = "ATENDIDO"
    CANCELADO = "CANCELADO"


class TipoItem(StrEnum):
    CONSULTA = "CONSULTA"
    CONTROL = "CONTROL"
    URGENCIA = "URGENCIA"
    VACUNA = "VACUNA"
    LABORATORIO = "LABORATORIO"
