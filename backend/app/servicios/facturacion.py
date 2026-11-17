"""Emisión de comprobantes de atención usando el patrón Strategy."""
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.excepciones import ErrorNegocio
from app.dominio.estados_muestra import Rechazada
from app.dominio.tarifas import LineaComprobante, estrategia_para
from app.modelos.clinico import Atencion
from app.modelos.enums import TipoItem
from app.modelos.facturacion import Comprobante, ItemComprobante
from app.modelos.organizacion import Usuario
from app.schemas.gestion import ComprobanteSalida, ItemComprobanteSalida
from app.schemas.organizacion import ClinicaResumen
from app.servicios.comun import clinica_en_alcance, obtener_o_error, verificar_clinica


def comprobante_a_salida(comprobante: Comprobante) -> ComprobanteSalida:
    atencion = comprobante.atencion
    responsable = atencion.responsable
    return ComprobanteSalida(
        id=comprobante.id,
        numero=comprobante.numero,
        fecha=comprobante.fecha,
        total=comprobante.total,
        atencion_id=atencion.id,
        clinica=ClinicaResumen.model_validate(comprobante.clinica),
        mascota=atencion.mascota.nombre,
        responsable=responsable.nombre_completo,
        responsable_dni=responsable.dni,
        profesional=atencion.profesional.nombre_completo,
        tipo_atencion=atencion.tipo.value,
        items=[ItemComprobanteSalida.model_validate(i) for i in comprobante.items],
    )


class ServicioFacturacion:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def calcular_lineas(self, atencion: Atencion) -> list[LineaComprobante]:
        # 1) La atención en sí: el cálculo depende de la estrategia del tipo
        lineas = [estrategia_para(atencion.tipo).calcular(atencion)]
        # 2) Vacunas aplicadas en la atención
        for aplicacion in atencion.vacunas_aplicadas:
            lineas.append(
                LineaComprobante(
                    f"Vacuna {aplicacion.vacuna.nombre}", TipoItem.VACUNA, aplicacion.vacuna.precio
                )
            )
        # 3) Servicios de laboratorio (las muestras rechazadas no se cobran)
        for orden in atencion.ordenes:
            for muestra in orden.muestras:
                if muestra.estado == Rechazada.nombre:
                    continue
                lineas.append(
                    LineaComprobante(
                        f"Análisis {muestra.tipo_analisis.nombre} ({muestra.codigo})",
                        TipoItem.LABORATORIO,
                        muestra.tipo_analisis.precio,
                    )
                )
        return lineas

    def emitir(self, atencion_id: int, usuario: Usuario, fecha: datetime | None = None) -> Comprobante:
        atencion = obtener_o_error(self.sesion, Atencion, atencion_id, "la atención")
        verificar_clinica(usuario, atencion.clinica_id)
        if atencion.comprobante is not None:
            raise ErrorNegocio(
                f"La atención ya tiene el comprobante {atencion.comprobante.numero}."
            )
        lineas = self.calcular_lineas(atencion)
        # Numeración por clínica: 0001-00000001
        cantidad = len(
            list(self.sesion.scalars(select(Comprobante.id).where(Comprobante.clinica_id == atencion.clinica_id)))
        )
        comprobante = Comprobante(
            numero=f"{atencion.clinica_id:04d}-{cantidad + 1:08d}",
            atencion=atencion,
            clinica_id=atencion.clinica_id,
            fecha=fecha or datetime.now(),
            total=round(sum(linea.subtotal for linea in lineas), 2),
            items=[
                ItemComprobante(
                    concepto=linea.concepto,
                    tipo=linea.tipo,
                    cantidad=linea.cantidad,
                    precio_unitario=round(linea.precio_unitario, 2),
                    subtotal=linea.subtotal,
                )
                for linea in lineas
            ],
        )
        self.sesion.add(comprobante)
        self.sesion.commit()
        return comprobante

    def listar(
        self,
        usuario: Usuario,
        clinica_id: int | None = None,
        desde: date | None = None,
        hasta: date | None = None,
    ) -> list[Comprobante]:
        consulta = select(Comprobante).order_by(Comprobante.fecha.desc())
        clinica_id = clinica_en_alcance(usuario, clinica_id)
        if clinica_id:
            consulta = consulta.where(Comprobante.clinica_id == clinica_id)
        if desde:
            consulta = consulta.where(Comprobante.fecha >= datetime.combine(desde, datetime.min.time()))
        if hasta:
            consulta = consulta.where(Comprobante.fecha <= datetime.combine(hasta, datetime.max.time()))
        return list(self.sesion.scalars(consulta.limit(300)))

    def obtener(self, comprobante_id: int, usuario: Usuario) -> Comprobante:
        comprobante = obtener_o_error(self.sesion, Comprobante, comprobante_id, "el comprobante")
        verificar_clinica(usuario, comprobante.clinica_id)
        return comprobante
