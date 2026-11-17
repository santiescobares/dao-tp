"""Configuración global de la aplicación (Singleton)."""
import os
from pathlib import Path

from app.core.singleton import SingletonMeta

RUTA_BACKEND = Path(__file__).resolve().parents[2]


class Configuracion(metaclass=SingletonMeta):
    """Parámetros del sistema. Se lee una sola vez y se comparte en toda la app."""

    def __init__(self) -> None:
        self.nombre_app = "VetRed - Red de Clínicas Veterinarias"
        self.url_base_datos = os.getenv(
            "VET_DB_URL", f"sqlite:///{(RUTA_BACKEND / 'veterinaria.db').as_posix()}"
        )

        # Seguridad (JWT)
        self.secreto_jwt = os.getenv("VET_JWT_SECRET", "dao-2026-tp-integrador-veterinaria-clave-de-desarrollo")
        self.algoritmo_jwt = "HS256"
        self.minutos_expiracion_token = 8 * 60
        self.origenes_cors = ["http://localhost:5173", "http://127.0.0.1:5173"]

        # Tarifas usadas por las estrategias de facturación
        self.precio_base_atencion = 15000.0
        self.descuento_control = 0.20          # 20 % menos en controles
        self.recargo_urgencia = 0.50           # 50 % más en urgencias
        self.recargo_urgencia_nocturna = 0.80  # 80 % más entre las 22 y las 7 hs
        self.hora_inicio_nocturno = 22
        self.hora_fin_nocturno = 7
