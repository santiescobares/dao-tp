"""Clientes, mascotas, historias clínicas, atenciones, tratamientos y vacunas."""
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.modelos.enums import Sexo, TipoAtencion
from app.modelos.organizacion import Clinica, Profesional

if TYPE_CHECKING:
    from app.modelos.facturacion import Comprobante
    from app.modelos.laboratorio import OrdenDerivacion


class Cliente(Base):
    """Responsable de una o más mascotas."""

    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(primary_key=True)
    dni: Mapped[str] = mapped_column(String(15), unique=True)
    nombre: Mapped[str] = mapped_column(String(60))
    apellido: Mapped[str] = mapped_column(String(60))
    telefono: Mapped[str] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(120))
    direccion: Mapped[str | None] = mapped_column(String(150))
    fecha_alta: Mapped[date] = mapped_column(default=date.today)

    mascotas: Mapped[list["Mascota"]] = relationship(back_populates="responsable")

    @property
    def nombre_completo(self) -> str:
        return f"{self.apellido}, {self.nombre}"

    @property
    def cantidad_mascotas(self) -> int:
        return len(self.mascotas)


class Especie(Base):
    __tablename__ = "especies"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(40), unique=True)

    vacunas: Mapped[list["Vacuna"]] = relationship(back_populates="especie")


class Vacuna(Base):
    """Vacuna del esquema sanitario de una especie."""

    __tablename__ = "vacunas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80))
    especie_id: Mapped[int] = mapped_column(ForeignKey("especies.id"))
    obligatoria: Mapped[bool] = mapped_column(default=True)
    edad_minima_semanas: Mapped[int] = mapped_column(default=8)
    refuerzo_meses: Mapped[int | None]  # None = dosis única
    precio: Mapped[float] = mapped_column(default=0)

    especie: Mapped[Especie] = relationship(back_populates="vacunas")


class Mascota(Base):
    __tablename__ = "mascotas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60))
    especie_id: Mapped[int] = mapped_column(ForeignKey("especies.id"))
    raza: Mapped[str | None] = mapped_column(String(60))
    sexo: Mapped[Sexo]
    fecha_nacimiento: Mapped[date]
    peso_kg: Mapped[float | None]
    # Validación de negocio: toda mascota debe tener un responsable (NOT NULL)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False)
    activa: Mapped[bool] = mapped_column(default=True)

    especie: Mapped[Especie] = relationship()
    responsable: Mapped[Cliente] = relationship(back_populates="mascotas")
    historia: Mapped["HistoriaClinica"] = relationship(
        back_populates="mascota", cascade="all, delete-orphan", uselist=False
    )
    vacunas_aplicadas: Mapped[list["AplicacionVacuna"]] = relationship(
        back_populates="mascota", order_by="AplicacionVacuna.fecha"
    )

    def edad_en_semanas(self, al_dia: date | None = None) -> int:
        return ((al_dia or date.today()) - self.fecha_nacimiento).days // 7


class HistoriaClinica(Base):
    """Se crea automáticamente junto con la mascota (relación 1 a 1)."""

    __tablename__ = "historias_clinicas"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True)
    mascota_id: Mapped[int] = mapped_column(ForeignKey("mascotas.id"), unique=True)
    fecha_apertura: Mapped[date] = mapped_column(default=date.today)
    alergias: Mapped[str | None] = mapped_column(Text)
    observaciones: Mapped[str | None] = mapped_column(Text)

    mascota: Mapped[Mascota] = relationship(back_populates="historia")
    atenciones: Mapped[list["Atencion"]] = relationship(
        back_populates="historia", order_by="desc(Atencion.fecha)"
    )


class Atencion(Base):
    """Consulta, control o urgencia registrada en la historia clínica."""

    __tablename__ = "atenciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    historia_id: Mapped[int] = mapped_column(ForeignKey("historias_clinicas.id"))
    clinica_id: Mapped[int] = mapped_column(ForeignKey("clinicas.id"))
    profesional_id: Mapped[int] = mapped_column(ForeignKey("profesionales.id"))
    turno_id: Mapped[int | None] = mapped_column(ForeignKey("turnos.id"))
    tipo: Mapped[TipoAtencion]
    fecha: Mapped[datetime] = mapped_column(default=datetime.now)
    motivo: Mapped[str] = mapped_column(String(200))
    diagnostico: Mapped[str | None] = mapped_column(Text)
    observaciones: Mapped[str | None] = mapped_column(Text)
    peso_kg: Mapped[float | None]

    historia: Mapped[HistoriaClinica] = relationship(back_populates="atenciones")
    clinica: Mapped[Clinica] = relationship()
    profesional: Mapped[Profesional] = relationship()
    tratamientos: Mapped[list["Tratamiento"]] = relationship(
        back_populates="atencion", cascade="all, delete-orphan"
    )
    vacunas_aplicadas: Mapped[list["AplicacionVacuna"]] = relationship(back_populates="atencion")
    ordenes: Mapped[list["OrdenDerivacion"]] = relationship(back_populates="atencion")
    comprobante: Mapped["Comprobante | None"] = relationship(
        back_populates="atencion", uselist=False
    )

    @property
    def mascota(self) -> Mascota:
        return self.historia.mascota

    @property
    def responsable(self) -> Cliente:
        return self.historia.mascota.responsable

    @property
    def comprobante_id(self) -> int | None:
        return self.comprobante.id if self.comprobante else None


class Tratamiento(Base):
    __tablename__ = "tratamientos"

    id: Mapped[int] = mapped_column(primary_key=True)
    atencion_id: Mapped[int] = mapped_column(ForeignKey("atenciones.id"))
    descripcion: Mapped[str] = mapped_column(String(200))
    medicamento: Mapped[str | None] = mapped_column(String(100))
    dosis: Mapped[str | None] = mapped_column(String(100))
    duracion_dias: Mapped[int | None]

    atencion: Mapped[Atencion] = relationship(back_populates="tratamientos")


class AplicacionVacuna(Base):
    __tablename__ = "aplicaciones_vacuna"

    id: Mapped[int] = mapped_column(primary_key=True)
    mascota_id: Mapped[int] = mapped_column(ForeignKey("mascotas.id"))
    vacuna_id: Mapped[int] = mapped_column(ForeignKey("vacunas.id"))
    atencion_id: Mapped[int | None] = mapped_column(ForeignKey("atenciones.id"))
    fecha: Mapped[date] = mapped_column(default=date.today)
    lote: Mapped[str | None] = mapped_column(String(40))

    mascota: Mapped[Mascota] = relationship(back_populates="vacunas_aplicadas")
    vacuna: Mapped[Vacuna] = relationship()
    atencion: Mapped[Atencion | None] = relationship(back_populates="vacunas_aplicadas")

    @property
    def nombre_vacuna(self) -> str:
        return self.vacuna.nombre
