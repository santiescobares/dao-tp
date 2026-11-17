"""Stock de conservadoras e insumos médicos."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.excepciones import ErrorNegocio
from app.modelos.enums import EstadoConservadora
from app.modelos.envio import Conservadora
from app.modelos.organizacion import Clinica, Usuario
from app.modelos.stock import Insumo, MovimientoStock
from app.schemas.gestion import InsumoEntrada, MovimientoEntrada
from app.schemas.laboratorio import ConservadoraEntrada
from app.servicios.comun import clinica_en_alcance, obtener_o_error, verificar_clinica


class ServicioStock:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    # ---------- Conservadoras ----------
    def listar_conservadoras(
        self, usuario: Usuario, clinica_id: int | None = None, estado: str | None = None
    ) -> list[Conservadora]:
        consulta = select(Conservadora).order_by(Conservadora.codigo)
        clinica_id = clinica_en_alcance(usuario, clinica_id)
        if clinica_id:
            consulta = consulta.where(Conservadora.clinica_id == clinica_id)
        if estado:
            consulta = consulta.where(Conservadora.estado == estado)
        return list(self.sesion.scalars(consulta))

    def _validar_conservadora(self, datos: ConservadoraEntrada, usuario: Usuario) -> None:
        verificar_clinica(usuario, datos.clinica_id)
        obtener_o_error(self.sesion, Clinica, datos.clinica_id, "la clínica")
        if datos.temperatura_min >= datos.temperatura_max:
            raise ErrorNegocio("La temperatura mínima debe ser menor a la máxima.")
        if datos.estado == EstadoConservadora.EN_USO:
            raise ErrorNegocio("El estado 'En uso' lo asigna el sistema al empaquetar.")

    def crear_conservadora(self, datos: ConservadoraEntrada, usuario: Usuario) -> Conservadora:
        self._validar_conservadora(datos, usuario)
        if self.sesion.scalar(select(Conservadora).where(Conservadora.codigo == datos.codigo)):
            raise ErrorNegocio(f"Ya existe la conservadora {datos.codigo}.")
        conservadora = Conservadora(**datos.model_dump())
        self.sesion.add(conservadora)
        self.sesion.commit()
        return conservadora

    def actualizar_conservadora(
        self, conservadora_id: int, datos: ConservadoraEntrada, usuario: Usuario
    ) -> Conservadora:
        conservadora = obtener_o_error(self.sesion, Conservadora, conservadora_id, "la conservadora")
        verificar_clinica(usuario, conservadora.clinica_id)
        if conservadora.estado == EstadoConservadora.EN_USO:
            raise ErrorNegocio("No se puede modificar una conservadora que está en tránsito.")
        self._validar_conservadora(datos, usuario)
        for campo, valor in datos.model_dump().items():
            setattr(conservadora, campo, valor)
        self.sesion.commit()
        return conservadora

    # ---------- Insumos ----------
    def listar_insumos(
        self, usuario: Usuario, clinica_id: int | None = None, solo_bajo_minimo: bool = False
    ) -> list[Insumo]:
        consulta = select(Insumo).where(Insumo.activo.is_(True)).order_by(Insumo.nombre)
        clinica_id = clinica_en_alcance(usuario, clinica_id)
        if clinica_id:
            consulta = consulta.where(Insumo.clinica_id == clinica_id)
        if solo_bajo_minimo:
            consulta = consulta.where(Insumo.stock_actual <= Insumo.stock_minimo)
        return list(self.sesion.scalars(consulta))

    def crear_insumo(self, datos: InsumoEntrada, usuario: Usuario) -> Insumo:
        verificar_clinica(usuario, datos.clinica_id)
        obtener_o_error(self.sesion, Clinica, datos.clinica_id, "la clínica")
        insumo = Insumo(**datos.model_dump(), stock_actual=0)
        self.sesion.add(insumo)
        self.sesion.commit()
        return insumo

    def actualizar_insumo(self, insumo_id: int, datos: InsumoEntrada, usuario: Usuario) -> Insumo:
        insumo = obtener_o_error(self.sesion, Insumo, insumo_id, "el insumo")
        verificar_clinica(usuario, insumo.clinica_id)
        verificar_clinica(usuario, datos.clinica_id)
        for campo, valor in datos.model_dump().items():
            setattr(insumo, campo, valor)
        self.sesion.commit()
        return insumo

    def registrar_movimiento(
        self, insumo_id: int, datos: MovimientoEntrada, usuario: Usuario
    ) -> MovimientoStock:
        insumo = obtener_o_error(self.sesion, Insumo, insumo_id, "el insumo")
        verificar_clinica(usuario, insumo.clinica_id)
        movimiento = insumo.registrar_movimiento(datos.tipo, datos.cantidad, datos.motivo, usuario.id)
        self.sesion.commit()
        return movimiento

    def movimientos(self, insumo_id: int, usuario: Usuario) -> list[MovimientoStock]:
        insumo = obtener_o_error(self.sesion, Insumo, insumo_id, "el insumo")
        verificar_clinica(usuario, insumo.clinica_id)
        return list(insumo.movimientos)
