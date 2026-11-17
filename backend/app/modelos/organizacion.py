"""Clínicas, laboratorio central, profesionales y usuarios del sistema."""
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.modelos.enums import Rol, TipoProfesional


class Clinica(Base):
    __tablename__ = "clinicas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True)
    direccion: Mapped[str] = mapped_column(String(150))
    telefono: Mapped[str] = mapped_column(String(30))
    activa: Mapped[bool] = mapped_column(default=True)

    profesionales: Mapped[list["Profesional"]] = relationship(back_populates="clinica")


class Laboratorio(Base):
    """Laboratorio central de la red (destino de todas las derivaciones)."""

    __tablename__ = "laboratorios"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100))
    direccion: Mapped[str] = mapped_column(String(150))


class Profesional(Base):
    """Veterinario de una clínica o profesional del laboratorio central."""

    __tablename__ = "profesionales"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60))
    apellido: Mapped[str] = mapped_column(String(60))
    matricula: Mapped[str] = mapped_column(String(20), unique=True)
    especialidad: Mapped[str] = mapped_column(String(80))
    tipo: Mapped[TipoProfesional]
    # Los veterinarios trabajan en una clínica; los laboratoristas no (clinica_id nulo)
    clinica_id: Mapped[int | None] = mapped_column(ForeignKey("clinicas.id"))
    activo: Mapped[bool] = mapped_column(default=True)

    clinica: Mapped[Clinica | None] = relationship(back_populates="profesionales")

    @property
    def nombre_completo(self) -> str:
        return f"{self.apellido}, {self.nombre}"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(120), unique=True)
    password_hash: Mapped[str] = mapped_column(String(120))
    nombre: Mapped[str] = mapped_column(String(120))
    rol: Mapped[Rol]
    activo: Mapped[bool] = mapped_column(default=True)
    profesional_id: Mapped[int | None] = mapped_column(ForeignKey("profesionales.id"))

    profesional: Mapped[Profesional | None] = relationship()

    @property
    def clinica_id(self) -> int | None:
        """Clínica en la que trabaja el usuario (solo veterinarios)."""
        return self.profesional.clinica_id if self.profesional else None
