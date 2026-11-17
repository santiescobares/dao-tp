"""Stock de insumos médicos de cada clínica (las conservadoras están en envio.py)."""
from datetime import datetime

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.excepciones import ErrorNegocio
from app.modelos.enums import TipoMovimiento
from app.modelos.organizacion import Clinica, Usuario


class Insumo(Base):
    __tablename__ = "insumos"

    id: Mapped[int] = mapped_column(primary_key=True)
    clinica_id: Mapped[int] = mapped_column(ForeignKey("clinicas.id"))
    nombre: Mapped[str] = mapped_column(String(100))
    unidad: Mapped[str] = mapped_column(String(20))
    stock_actual: Mapped[float] = mapped_column(default=0)
    stock_minimo: Mapped[float] = mapped_column(default=0)
    activo: Mapped[bool] = mapped_column(default=True)

    clinica: Mapped[Clinica] = relationship()
    movimientos: Mapped[list["MovimientoStock"]] = relationship(
        back_populates="insumo", order_by="desc(MovimientoStock.fecha)"
    )

    @property
    def bajo_minimo(self) -> bool:
        return self.stock_actual <= self.stock_minimo

    def registrar_movimiento(
        self,
        tipo: TipoMovimiento,
        cantidad: float,
        motivo: str,
        usuario_id: int | None,
        atencion_id: int | None = None,
        fecha: datetime | None = None,
    ) -> "MovimientoStock":
        """Actualiza el stock y deja registrado el movimiento.

        INGRESO suma, EGRESO resta y AJUSTE fija el stock al valor indicado.
        """
        if cantidad < 0 or (cantidad == 0 and tipo != TipoMovimiento.AJUSTE):
            raise ErrorNegocio("La cantidad del movimiento debe ser positiva.")
        if tipo == TipoMovimiento.INGRESO:
            nuevo_stock = self.stock_actual + cantidad
        elif tipo == TipoMovimiento.EGRESO:
            nuevo_stock = self.stock_actual - cantidad
            if nuevo_stock < 0:
                raise ErrorNegocio(
                    f"Stock insuficiente de '{self.nombre}': hay {self.stock_actual:g} {self.unidad}."
                )
        else:
            nuevo_stock = cantidad
        movimiento = MovimientoStock(
            tipo=tipo,
            cantidad=cantidad,
            motivo=motivo,
            usuario_id=usuario_id,
            atencion_id=atencion_id,
            fecha=fecha or datetime.now(),
            stock_resultante=nuevo_stock,
        )
        self.stock_actual = nuevo_stock
        self.movimientos.append(movimiento)
        return movimiento


class MovimientoStock(Base):
    __tablename__ = "movimientos_stock"

    id: Mapped[int] = mapped_column(primary_key=True)
    insumo_id: Mapped[int] = mapped_column(ForeignKey("insumos.id"))
    tipo: Mapped[TipoMovimiento]
    cantidad: Mapped[float]
    stock_resultante: Mapped[float]
    fecha: Mapped[datetime] = mapped_column(default=datetime.now)
    motivo: Mapped[str] = mapped_column(String(200))
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    atencion_id: Mapped[int | None] = mapped_column(ForeignKey("atenciones.id"))

    insumo: Mapped[Insumo] = relationship(back_populates="movimientos")
    usuario: Mapped[Usuario | None] = relationship()
