"""Servicios de muestras: consulta, trazabilidad, resultados y rechazos."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.excepciones import ErrorNegocio
from app.dominio.estados_muestra import RegistroCambio
from app.modelos.agenda import Turno
from app.modelos.clinico import Atencion
from app.modelos.enums import EstadoTurno, MotivoRechazo, TipoProfesional
from app.modelos.laboratorio import Muestra, OrdenDerivacion, ResultadoAnalisis
from app.modelos.organizacion import Usuario
from app.schemas.laboratorio import (
    MuestraSalida,
    RegistroHistorialSalida,
    ResultadoEntrada,
    ResultadoSalida,
    TrazabilidadSalida,
)
from app.servicios.comun import clinica_en_alcance, obtener_o_error, verificar_clinica


class ServicioMuestras:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def listar(
        self,
        usuario: Usuario,
        estado: str | None = None,
        clinica_id: int | None = None,
        texto: str | None = None,
    ) -> list[Muestra]:
        consulta = (
            select(Muestra)
            .join(Muestra.orden)
            .join(OrdenDerivacion.atencion)
            .order_by(OrdenDerivacion.urgente.desc(), Muestra.fecha_extraccion.desc())
        )
        clinica_id = clinica_en_alcance(usuario, clinica_id)
        if clinica_id:
            consulta = consulta.where(Atencion.clinica_id == clinica_id)
        if estado:
            consulta = consulta.where(Muestra.estado == estado)
        if texto:
            consulta = consulta.where(Muestra.codigo.ilike(f"%{texto}%"))
        return list(self.sesion.scalars(consulta.limit(300)))

    def obtener(self, muestra_id: int, usuario: Usuario | None = None) -> Muestra:
        muestra = obtener_o_error(self.sesion, Muestra, muestra_id, "la muestra")
        if usuario:
            verificar_clinica(usuario, muestra.orden.atencion.clinica_id)
        return muestra

    def trazabilidad(self, muestra_id: int, usuario: Usuario) -> TrazabilidadSalida:
        # Import local para evitar dependencia circular entre servicios
        from app.servicios.envios import remito_a_salida

        muestra = self.obtener(muestra_id, usuario)
        atencion = muestra.orden.atencion
        return TrazabilidadSalida(
            muestra=MuestraSalida.desde(muestra),
            profesional_solicitante=atencion.profesional.nombre_completo,
            fecha_atencion=atencion.fecha,
            historial=[
                RegistroHistorialSalida(
                    id=h.id,
                    estado_anterior=h.estado_anterior,
                    estado_nuevo=h.estado_nuevo,
                    fecha=h.fecha,
                    usuario=h.usuario.nombre if h.usuario else None,
                    observacion=h.observacion,
                )
                for h in muestra.historial
            ],
            remito=remito_a_salida(muestra.remito) if muestra.remito else None,
            resultado=ResultadoSalida.model_validate(muestra.resultado) if muestra.resultado else None,
        )

    def registrar_resultado(
        self, muestra_id: int, datos: ResultadoEntrada, usuario: Usuario, fecha: datetime | None = None
    ) -> Muestra:
        profesional = usuario.profesional
        if profesional is None or profesional.tipo != TipoProfesional.LABORATORISTA:
            raise ErrorNegocio("Solo un profesional del laboratorio puede cargar resultados.")
        muestra = self.obtener(muestra_id)
        registro = RegistroCambio(usuario.id, "Resultado cargado", fecha or datetime.now())
        # El State valida: una muestra rechazada o ya analizada no puede procesarse
        muestra.analizar(registro)
        muestra.resultado = ResultadoAnalisis(
            profesional=profesional, fecha=registro.fecha, **datos.model_dump()
        )
        # Si había un turno de procesamiento reservado, queda atendido
        for turno in self.sesion.scalars(
            select(Turno).where(Turno.muestra_id == muestra.id, Turno.estado == EstadoTurno.RESERVADO)
        ):
            turno.estado = EstadoTurno.ATENDIDO
        self.sesion.commit()
        return muestra

    def rechazar(
        self, muestra_id: int, motivo: MotivoRechazo, observacion: str | None, usuario: Usuario
    ) -> Muestra:
        muestra = self.obtener(muestra_id)
        muestra.rechazar(motivo, RegistroCambio(usuario.id, observacion))
        self.sesion.commit()
        return muestra
