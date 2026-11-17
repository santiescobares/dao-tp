"""Comprobantes de atención."""
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.modelos.clinico import Atencion
from app.modelos.enums import TipoItem
from app.modelos.organizacion import Clinica


class Comprobante(Base):
    """Comprobante emitido por una atención. Es una foto: no se recalcula."""

    __tablename__ = "comprobantes"

    id: Mapped[int] = mapped_column(primary_key=True)
    numero: Mapped[str] = mapped_column(String(20), unique=True)
    atencion_id: Mapped[int] = mapped_column(ForeignKey("atenciones.id"), unique=True)
    clinica_id: Mapped[int] = mapped_column(ForeignKey("clinicas.id"))
    fecha: Mapped[datetime] = mapped_column(default=datetime.now)
    total: Mapped[float] = mapped_column(default=0)

    atencion: Mapped[Atencion] = relationship(back_populates="comprobante")
    clinica: Mapped[Clinica] = relationship()
    items: Mapped[list["ItemComprobante"]] = relationship(
        back_populates="comprobante", cascade="all, delete-orphan"
    )


class ItemComprobante(Base):
    __tablename__ = "items_comprobante"

    id: Mapped[int] = mapped_column(primary_key=True)
    comprobante_id: Mapped[int] = mapped_column(ForeignKey("comprobantes.id"))
    concepto: Mapped[str] = mapped_column(String(150))
    tipo: Mapped[TipoItem]
    cantidad: Mapped[int] = mapped_column(default=1)
    precio_unitario: Mapped[float]
    subtotal: Mapped[float]

    comprobante: Mapped[Comprobante] = relationship(back_populates="items")
