"""Importa todos los modelos para que SQLAlchemy los registre en Base.metadata."""
from app.modelos.agenda import HorarioProfesional, Turno
from app.modelos.clinico import (
    AplicacionVacuna,
    Atencion,
    Cliente,
    Especie,
    HistoriaClinica,
    Mascota,
    Tratamiento,
    Vacuna,
)
from app.modelos.envio import (
    Conservadora,
    EventoEnvio,
    PrecintoSanitario,
    RecepcionLaboratorio,
    RemitoBiologico,
)
from app.modelos.facturacion import Comprobante, ItemComprobante
from app.modelos.laboratorio import (
    HistorialEstadoMuestra,
    Muestra,
    OrdenDerivacion,
    ResultadoAnalisis,
    TipoAnalisis,
)
from app.modelos.organizacion import Clinica, Laboratorio, Profesional, Usuario
from app.modelos.stock import Insumo, MovimientoStock

__all__ = [
    "AplicacionVacuna", "Atencion", "Cliente", "Clinica", "Comprobante", "Conservadora",
    "Especie", "EventoEnvio", "HistoriaClinica", "HistorialEstadoMuestra",
    "HorarioProfesional", "Insumo", "ItemComprobante", "Laboratorio", "Mascota",
    "MovimientoStock", "Muestra", "OrdenDerivacion", "PrecintoSanitario", "Profesional",
    "RecepcionLaboratorio", "RemitoBiologico", "ResultadoAnalisis", "TipoAnalisis",
    "Tratamiento", "Turno", "Usuario", "Vacuna",
]
