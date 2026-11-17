"""Acceso a la base de datos (Singleton).

`BaseDeDatos` mantiene un único engine de SQLAlchemy y la fábrica de sesiones.
"""
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import Configuracion
from app.core.singleton import SingletonMeta


class Base(DeclarativeBase):
    """Clase base de todos los modelos ORM."""


class BaseDeDatos(metaclass=SingletonMeta):
    def __init__(self, url: str | None = None) -> None:
        self.url = url or Configuracion().url_base_datos
        self.engine = create_engine(self.url, connect_args={"check_same_thread": False})

        # SQLite no controla claves foráneas si no se lo pedimos explícitamente
        @event.listens_for(self.engine, "connect")
        def _activar_claves_foraneas(conexion, _registro):
            cursor = conexion.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")      # escrituras más rápidas
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

        self._fabrica_sesiones = sessionmaker(
            bind=self.engine, autoflush=False, expire_on_commit=False
        )

    def crear_tablas(self) -> None:
        import app.modelos.registro  # noqa: F401  (registra todos los modelos en Base)

        Base.metadata.create_all(self.engine)

    def recrear(self) -> None:
        """Borra el archivo SQLite (si existe) y vuelve a crear todas las tablas."""
        ruta = self.engine.url.database
        self.engine.dispose()
        if ruta and ruta != ":memory:":
            for sufijo in ("", "-wal", "-shm"):
                Path(ruta + sufijo).unlink(missing_ok=True)
        self.crear_tablas()

    def nueva_sesion(self) -> Session:
        return self._fabrica_sesiones()


def obtener_sesion() -> Iterator[Session]:
    """Dependencia de FastAPI: abre una sesión por request y la cierra al final."""
    sesion = BaseDeDatos().nueva_sesion()
    try:
        yield sesion
    finally:
        sesion.close()
