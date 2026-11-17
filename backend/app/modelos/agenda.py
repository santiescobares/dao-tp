"""Agenda de profesionales: horarios de atención y turnos."""
from datetime import datetime, time

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.modelos.clinico import Mascota
from app.modelos.enums import EstadoTurno, TipoTurno
from app.modelos.laboratorio import Muestra
from app.modelos.organizacion import Profesional

DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


class HorarioProfesional(Base):
    """Franja semanal en la que un profesional atiende (0 = lunes ... 6 = domingo)."""

    __tablename__ = "horarios_profesional"

    id: Mapped[int] = mapped_column(primary_key=True)
    profesional_id: Mapped[int] = mapped_column(ForeignKey("profesionales.id"))
    dia_semana: Mapped[int]
    hora_desde: Mapped[time]
    hora_hasta: Mapped[time]

    profesional: Mapped[Profesional] = relationship()

    def contiene(self, inicio: datetime, fin: datetime) -> bool:
        return (
            inicio.weekday() == self.dia_semana
            and inicio.date() == fin.date()
            and self.hora_desde <= inicio.time()
            and fin.time() <= self.hora_hasta
        )


class Turno(Base):
    __tablename__ = "turnos"

    id: Mapped[int] = mapped_column(primary_key=True)
    profesional_id: Mapped[int] = mapped_column(ForeignKey("profesionales.id"))
    inicio: Mapped[datetime]
    fin: Mapped[datetime]
    tipo: Mapped[TipoTurno]
    estado: Mapped[EstadoTurno] = mapped_column(default=EstadoTurno.RESERVADO)
    motivo: Mapped[str] = mapped_column(String(200))
    mascota_id: Mapped[int | None] = mapped_column(ForeignKey("mascotas.id"))
    muestra_id: Mapped[int | None] = mapped_column(ForeignKey("muestras.id"))

    profesional: Mapped[Profesional] = relationship()
    mascota: Mapped[Mascota | None] = relationship()
    muestra: Mapped[Muestra | None] = relationship()

    @property
    def mascota_nombre(self) -> str | None:
        return self.mascota.nombre if self.mascota else None

    @property
    def muestra_codigo(self) -> str | None:
        return self.muestra.codigo if self.muestra else None

    def se_superpone_con(self, inicio: datetime, fin: datetime) -> bool:
        """Dos intervalos se superponen si cada uno empieza antes de que termine el otro."""
        return self.inicio < fin and inicio < self.fin
