"""Reportes de gestión.

Todos reciben el mismo filtro (rango de fechas y clínica opcional) y combinan
consultas SQL agregadas (GROUP BY, joins, self-join del historial) con un poco
de procesamiento en Python para armar series listas para graficar.
"""
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session, aliased

from app.dominio.estados_muestra import Analizada, EnTransito, Rechazada, Recibida
from app.dominio.estados_remito import EnTransitoRemito, Rechazado
from app.modelos.agenda import Turno
from app.modelos.clinico import Atencion, Especie, HistoriaClinica, Mascota, Tratamiento
from app.modelos.enums import EstadoTurno, MotivoRechazo, TipoAtencion, TipoItem
from app.modelos.envio import RemitoBiologico
from app.modelos.facturacion import Comprobante, ItemComprobante
from app.modelos.laboratorio import HistorialEstadoMuestra, Muestra, OrdenDerivacion, TipoAnalisis
from app.modelos.organizacion import Clinica
from app.modelos.stock import Insumo
from app.servicios.clinico import ServicioVacunacion

MOTIVOS_DE_TRANSPORTE = (
    MotivoRechazo.PRECINTO_ROTO,
    MotivoRechazo.TEMPERATURA_FUERA_RANGO,
    MotivoRechazo.TIEMPO_EXCEDIDO,
)


@dataclass
class FiltroReporte:
    desde: date
    hasta: date
    clinica_id: int | None = None

    @property
    def inicio(self) -> datetime:
        return datetime.combine(self.desde, datetime.min.time())

    @property
    def fin(self) -> datetime:
        return datetime.combine(self.hasta, datetime.max.time())


def _porcentaje(parte: float, total: float) -> float:
    return round(parte * 100 / total, 1) if total else 0.0


def _promedio(valores: list[float]) -> float | None:
    return round(sum(valores) / len(valores), 1) if valores else None


def _horas(desde_col, hasta_col):
    """Diferencia en horas entre dos columnas datetime (SQLite: julianday)."""
    return (func.julianday(hasta_col) - func.julianday(desde_col)) * 24


class ServicioReportes:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    # ------------------------------------------------------------------
    # 1) Atenciones clínicas y derivaciones realizadas
    # ------------------------------------------------------------------
    def atenciones_y_derivaciones(self, filtro: FiltroReporte) -> dict:
        tiene_orden = (
            select(OrdenDerivacion.id).where(OrdenDerivacion.atencion_id == Atencion.id).exists()
        )
        condiciones = [Atencion.fecha.between(filtro.inicio, filtro.fin)]
        if filtro.clinica_id:
            condiciones.append(Atencion.clinica_id == filtro.clinica_id)

        def contar(tipo: TipoAtencion):
            return func.sum(case((Atencion.tipo == tipo, 1), else_=0))

        filas_clinica = self.sesion.execute(
            select(
                Clinica.nombre,
                contar(TipoAtencion.CONSULTA),
                contar(TipoAtencion.CONTROL),
                contar(TipoAtencion.URGENCIA),
                func.count(Atencion.id),
                func.sum(case((tiene_orden, 1), else_=0)),
            )
            .join(Clinica, Clinica.id == Atencion.clinica_id)
            .where(*condiciones)
            .group_by(Clinica.nombre)
            .order_by(Clinica.nombre)
        ).all()
        por_clinica = [
            {
                "clinica": nombre,
                "consultas": consultas,
                "controles": controles,
                "urgencias": urgencias,
                "total": total,
                "con_derivacion": derivadas,
                "porcentaje_derivacion": _porcentaje(derivadas, total),
            }
            for nombre, consultas, controles, urgencias, total, derivadas in filas_clinica
        ]

        mes = func.strftime("%Y-%m", Atencion.fecha)
        filas_mes = self.sesion.execute(
            select(
                mes,
                contar(TipoAtencion.CONSULTA),
                contar(TipoAtencion.CONTROL),
                contar(TipoAtencion.URGENCIA),
                func.sum(case((tiene_orden, 1), else_=0)),
            )
            .where(*condiciones)
            .group_by(mes)
            .order_by(mes)
        ).all()
        por_mes = [
            {"mes": m, "CONSULTA": c, "CONTROL": ct, "URGENCIA": u, "derivaciones": d}
            for m, c, ct, u, d in filas_mes
        ]

        filas_analisis = self.sesion.execute(
            select(TipoAnalisis.nombre, func.count(Muestra.id))
            .join(Muestra, Muestra.tipo_analisis_id == TipoAnalisis.id)
            .join(OrdenDerivacion, OrdenDerivacion.id == Muestra.orden_id)
            .join(Atencion, Atencion.id == OrdenDerivacion.atencion_id)
            .where(*condiciones)
            .group_by(TipoAnalisis.nombre)
            .order_by(func.count(Muestra.id).desc())
            .limit(8)
        ).all()

        total = sum(f["total"] for f in por_clinica)
        derivadas = sum(f["con_derivacion"] for f in por_clinica)
        return {
            "resumen": {
                "total_atenciones": total,
                "con_derivacion": derivadas,
                "porcentaje_derivacion": _porcentaje(derivadas, total),
                "total_muestras": sum(c for _, c in filas_analisis),
            },
            "por_clinica": por_clinica,
            "por_mes": por_mes,
            "top_analisis": [{"analisis": n, "cantidad": c} for n, c in filas_analisis],
        }

    # ------------------------------------------------------------------
    # 2) Muestras rechazadas por fallas en el transporte
    # ------------------------------------------------------------------
    def rechazos_por_transporte(self, filtro: FiltroReporte) -> dict:
        condiciones = [
            RemitoBiologico.fecha_despacho.between(filtro.inicio, filtro.fin),
        ]
        if filtro.clinica_id:
            condiciones.append(RemitoBiologico.clinica_id == filtro.clinica_id)
        es_falla = and_(
            Muestra.estado == Rechazada.nombre, Muestra.motivo_rechazo.in_(MOTIVOS_DE_TRANSPORTE)
        )

        filas_clinica = self.sesion.execute(
            select(
                Clinica.nombre,
                func.count(Muestra.id),
                func.sum(case((es_falla, 1), else_=0)),
            )
            .join(RemitoBiologico, RemitoBiologico.id == Muestra.remito_id)
            .join(Clinica, Clinica.id == RemitoBiologico.clinica_id)
            .where(*condiciones)
            .group_by(Clinica.nombre)
            .order_by(Clinica.nombre)
        ).all()
        por_clinica = [
            {
                "clinica": nombre,
                "enviadas": enviadas,
                "rechazadas": rechazadas,
                "tasa_rechazo": _porcentaje(rechazadas, enviadas),
            }
            for nombre, enviadas, rechazadas in filas_clinica
        ]

        filas_motivo = self.sesion.execute(
            select(Muestra.motivo_rechazo, func.count(Muestra.id))
            .join(RemitoBiologico, RemitoBiologico.id == Muestra.remito_id)
            .where(*condiciones, es_falla)
            .group_by(Muestra.motivo_rechazo)
        ).all()

        filas_transportista = self.sesion.execute(
            select(
                RemitoBiologico.transportista,
                func.count(func.distinct(RemitoBiologico.id)),
                func.count(func.distinct(case((RemitoBiologico.estado == Rechazado.nombre, RemitoBiologico.id)))),
                func.sum(case((es_falla, 1), else_=0)),
            )
            .join(Muestra, Muestra.remito_id == RemitoBiologico.id)
            .where(*condiciones)
            .group_by(RemitoBiologico.transportista)
            .order_by(func.sum(case((es_falla, 1), else_=0)).desc())
        ).all()

        filas_detalle = self.sesion.execute(
            select(
                Muestra.codigo,
                TipoAnalisis.nombre,
                Clinica.nombre,
                RemitoBiologico.numero,
                RemitoBiologico.transportista,
                Muestra.motivo_rechazo,
                RemitoBiologico.fecha_recepcion,
            )
            .join(TipoAnalisis, TipoAnalisis.id == Muestra.tipo_analisis_id)
            .join(RemitoBiologico, RemitoBiologico.id == Muestra.remito_id)
            .join(Clinica, Clinica.id == RemitoBiologico.clinica_id)
            .where(*condiciones, es_falla)
            .order_by(RemitoBiologico.fecha_recepcion.desc())
        ).all()

        enviadas = sum(f["enviadas"] for f in por_clinica)
        rechazadas = sum(f["rechazadas"] for f in por_clinica)
        return {
            "resumen": {
                "enviadas": enviadas,
                "rechazadas": rechazadas,
                "tasa_rechazo": _porcentaje(rechazadas, enviadas),
            },
            "por_motivo": [{"motivo": m.value, "cantidad": c} for m, c in filas_motivo],
            "por_clinica": por_clinica,
            "por_transportista": [
                {
                    "transportista": t or "Sin informar",
                    "remitos": r,
                    "remitos_rechazados": rr,
                    "muestras_rechazadas": mr,
                }
                for t, r, rr, mr in filas_transportista
            ],
            "detalle": [
                {
                    "codigo": codigo,
                    "analisis": analisis,
                    "clinica": clinica,
                    "remito": remito,
                    "transportista": transportista,
                    "motivo": motivo.value,
                    "fecha": fecha,
                }
                for codigo, analisis, clinica, remito, transportista, motivo, fecha in filas_detalle
            ],
        }

    # ------------------------------------------------------------------
    # 3) Tiempo promedio de tránsito y procesamiento (desde la trazabilidad)
    # ------------------------------------------------------------------
    def tiempos_de_transito_y_procesamiento(self, filtro: FiltroReporte) -> dict:
        # Self-join del historial: momento en que salió (EN_TRANSITO) y llegó (estado siguiente)
        salida = aliased(HistorialEstadoMuestra)
        llegada = aliased(HistorialEstadoMuestra)
        recibida = aliased(HistorialEstadoMuestra)
        analizada = aliased(HistorialEstadoMuestra)

        consulta_transito = (
            select(
                Muestra.id,
                Clinica.nombre,
                TipoAnalisis.nombre,
                func.strftime("%Y-%m", salida.fecha),
                _horas(salida.fecha, llegada.fecha),
            )
            .join(salida, and_(salida.muestra_id == Muestra.id, salida.estado_nuevo == EnTransito.nombre))
            .join(llegada, and_(llegada.muestra_id == Muestra.id, llegada.estado_anterior == EnTransito.nombre))
            .join(TipoAnalisis, TipoAnalisis.id == Muestra.tipo_analisis_id)
            .join(OrdenDerivacion, OrdenDerivacion.id == Muestra.orden_id)
            .join(Atencion, Atencion.id == OrdenDerivacion.atencion_id)
            .join(Clinica, Clinica.id == Atencion.clinica_id)
            .where(salida.fecha.between(filtro.inicio, filtro.fin))
        )
        consulta_proceso = (
            select(
                Muestra.id,
                Clinica.nombre,
                TipoAnalisis.nombre,
                func.strftime("%Y-%m", recibida.fecha),
                _horas(recibida.fecha, analizada.fecha),
                _horas(Muestra.fecha_extraccion, analizada.fecha),
            )
            .join(recibida, and_(recibida.muestra_id == Muestra.id, recibida.estado_nuevo == Recibida.nombre))
            .join(analizada, and_(analizada.muestra_id == Muestra.id, analizada.estado_nuevo == Analizada.nombre))
            .join(TipoAnalisis, TipoAnalisis.id == Muestra.tipo_analisis_id)
            .join(OrdenDerivacion, OrdenDerivacion.id == Muestra.orden_id)
            .join(Atencion, Atencion.id == OrdenDerivacion.atencion_id)
            .join(Clinica, Clinica.id == Atencion.clinica_id)
            .where(recibida.fecha.between(filtro.inicio, filtro.fin))
        )
        if filtro.clinica_id:
            consulta_transito = consulta_transito.where(Atencion.clinica_id == filtro.clinica_id)
            consulta_proceso = consulta_proceso.where(Atencion.clinica_id == filtro.clinica_id)

        transitos = self.sesion.execute(consulta_transito).all()
        procesos = self.sesion.execute(consulta_proceso).all()

        def agrupar(indice_clave: int) -> list[dict]:
            grupos: dict[str, dict[str, list[float]]] = defaultdict(lambda: {"t": [], "p": []})
            for fila in transitos:
                grupos[fila[indice_clave]]["t"].append(fila[4])
            for fila in procesos:
                grupos[fila[indice_clave]]["p"].append(fila[4])
            return [
                {
                    "clave": clave,
                    "transito_promedio_h": _promedio(v["t"]),
                    "procesamiento_promedio_h": _promedio(v["p"]),
                    "muestras": max(len(v["t"]), len(v["p"])),
                }
                for clave, v in sorted(grupos.items())
            ]

        horas_transito = [f[4] for f in transitos]
        horas_proceso = [f[4] for f in procesos]
        return {
            "resumen": {
                "transito_promedio_h": _promedio(horas_transito),
                "transito_maximo_h": round(max(horas_transito), 1) if horas_transito else None,
                "procesamiento_promedio_h": _promedio(horas_proceso),
                "procesamiento_maximo_h": round(max(horas_proceso), 1) if horas_proceso else None,
                "ciclo_completo_promedio_h": _promedio([f[5] for f in procesos]),
                "muestras_medidas": len(horas_transito),
            },
            "por_clinica": [{"clinica": g.pop("clave"), **g} for g in agrupar(1)],
            "por_analisis": [{"analisis": g.pop("clave"), **g} for g in agrupar(2)],
            "por_mes": [{"mes": g.pop("clave"), **g} for g in agrupar(3)],
        }

    # ------------------------------------------------------------------
    # 4) Facturación desglosada por clínica y servicios
    # ------------------------------------------------------------------
    def facturacion(self, filtro: FiltroReporte) -> dict:
        condiciones = [Comprobante.fecha.between(filtro.inicio, filtro.fin)]
        if filtro.clinica_id:
            condiciones.append(Comprobante.clinica_id == filtro.clinica_id)
        tipos = [t.value for t in TipoItem]

        def armar(filas, nombre_clave: str) -> list[dict]:
            datos: dict[str, dict] = {}
            for clave, tipo, monto in filas:
                fila = datos.setdefault(clave, {nombre_clave: clave, **{t: 0.0 for t in tipos}, "total": 0.0})
                fila[tipo.value] = round(fila[tipo.value] + monto, 2)
                fila["total"] = round(fila["total"] + monto, 2)
            return list(datos.values())

        base = (
            select()
            .select_from(ItemComprobante)
            .join(Comprobante, Comprobante.id == ItemComprobante.comprobante_id)
            .where(*condiciones)
        )
        filas_clinica = self.sesion.execute(
            base.add_columns(Clinica.nombre, ItemComprobante.tipo, func.sum(ItemComprobante.subtotal))
            .join(Clinica, Clinica.id == Comprobante.clinica_id)
            .group_by(Clinica.nombre, ItemComprobante.tipo)
            .order_by(Clinica.nombre)
        ).all()
        mes = func.strftime("%Y-%m", Comprobante.fecha)
        filas_mes = self.sesion.execute(
            base.add_columns(mes, ItemComprobante.tipo, func.sum(ItemComprobante.subtotal))
            .group_by(mes, ItemComprobante.tipo)
            .order_by(mes)
        ).all()
        cantidad, total = self.sesion.execute(
            select(func.count(Comprobante.id), func.coalesce(func.sum(Comprobante.total), 0)).where(
                *condiciones
            )
        ).one()

        por_clinica = armar(filas_clinica, "clinica")
        por_servicio = []
        for tipo in tipos:
            monto = round(sum(f[tipo] for f in por_clinica), 2)
            por_servicio.append({"servicio": tipo, "total": monto, "porcentaje": _porcentaje(monto, total)})
        return {
            "resumen": {
                "total_facturado": round(total, 2),
                "comprobantes": cantidad,
                "ticket_promedio": round(total / cantidad, 2) if cantidad else 0,
            },
            "por_clinica": por_clinica,
            "por_mes": armar(filas_mes, "mes"),
            "por_servicio": por_servicio,
        }

    # ------------------------------------------------------------------
    # 5) Tratamientos aplicados y vacunas pendientes
    # ------------------------------------------------------------------
    def tratamientos_y_vacunas(self, filtro: FiltroReporte) -> dict:
        condiciones = [Atencion.fecha.between(filtro.inicio, filtro.fin)]
        if filtro.clinica_id:
            condiciones.append(Atencion.clinica_id == filtro.clinica_id)

        filas_tratamientos = self.sesion.execute(
            select(
                Atencion.fecha,
                Mascota.nombre,
                Especie.nombre,
                Clinica.nombre,
                Tratamiento.descripcion,
                Tratamiento.medicamento,
                Tratamiento.dosis,
                Tratamiento.duracion_dias,
            )
            .join(Atencion, Atencion.id == Tratamiento.atencion_id)
            .join(HistoriaClinica, HistoriaClinica.id == Atencion.historia_id)
            .join(Mascota, Mascota.id == HistoriaClinica.mascota_id)
            .join(Especie, Especie.id == Mascota.especie_id)
            .join(Clinica, Clinica.id == Atencion.clinica_id)
            .where(*condiciones)
            .order_by(Atencion.fecha.desc())
        ).all()
        conteo: dict[tuple[str, str], int] = defaultdict(int)
        for fila in filas_tratamientos:
            conteo[(fila[5] or "Sin medicación", fila[2])] += 1

        # Vacunas pendientes al día de hoy (o mascotas atendidas en la clínica filtrada)
        consulta_mascotas = select(Mascota).where(Mascota.activa.is_(True)).order_by(Mascota.nombre)
        if filtro.clinica_id:
            atendidas = (
                select(HistoriaClinica.mascota_id)
                .join(Atencion, Atencion.historia_id == HistoriaClinica.id)
                .where(Atencion.clinica_id == filtro.clinica_id)
            )
            consulta_mascotas = consulta_mascotas.where(Mascota.id.in_(atendidas))
        servicio_vacunas = ServicioVacunacion()
        pendientes = []
        resumen_vacunas: dict[tuple[str, str], int] = defaultdict(int)
        for mascota in self.sesion.scalars(consulta_mascotas):
            for p in servicio_vacunas.pendientes(mascota):
                resumen_vacunas[(p.nombre, mascota.especie.nombre)] += 1
                pendientes.append(
                    {
                        "mascota_id": mascota.id,
                        "mascota": mascota.nombre,
                        "especie": mascota.especie.nombre,
                        "responsable": mascota.responsable.nombre_completo,
                        "telefono": mascota.responsable.telefono,
                        "vacuna": p.nombre,
                        "situacion": p.situacion,
                        "vencimiento": p.vencimiento,
                    }
                )
        return {
            "resumen": {
                "tratamientos": len(filas_tratamientos),
                "mascotas_con_pendientes": len({p["mascota_id"] for p in pendientes}),
                "vacunas_pendientes": len(pendientes),
            },
            "tratamientos_por_medicamento": sorted(
                (
                    {"medicamento": med, "especie": esp, "cantidad": c}
                    for (med, esp), c in conteo.items()
                ),
                key=lambda f: -f["cantidad"],
            ),
            "tratamientos": [
                {
                    "fecha": f[0], "mascota": f[1], "especie": f[2], "clinica": f[3],
                    "descripcion": f[4], "medicamento": f[5], "dosis": f[6], "duracion_dias": f[7],
                }
                for f in filas_tratamientos
            ],
            "resumen_vacunas": sorted(
                (
                    {"vacuna": v, "especie": e, "pendientes": c}
                    for (v, e), c in resumen_vacunas.items()
                ),
                key=lambda f: -f["pendientes"],
            ),
            "vacunas_pendientes": pendientes,
        }

    # ------------------------------------------------------------------
    # Tablero de inicio
    # ------------------------------------------------------------------
    def tablero(self, clinica_id: int | None) -> dict:
        hoy = date.today()
        inicio_hoy = datetime.combine(hoy, datetime.min.time())
        inicio_mes = datetime.combine(hoy.replace(day=1), datetime.min.time())

        def filtrar_atencion(consulta):
            return consulta.where(Atencion.clinica_id == clinica_id) if clinica_id else consulta

        atenciones_hoy = self.sesion.scalar(
            filtrar_atencion(select(func.count(Atencion.id)).where(Atencion.fecha >= inicio_hoy))
        )
        atenciones_mes = self.sesion.scalar(
            filtrar_atencion(select(func.count(Atencion.id)).where(Atencion.fecha >= inicio_mes))
        )
        consulta_estados = (
            select(Muestra.estado, func.count(Muestra.id))
            .join(OrdenDerivacion, OrdenDerivacion.id == Muestra.orden_id)
            .join(Atencion, Atencion.id == OrdenDerivacion.atencion_id)
            .group_by(Muestra.estado)
        )
        muestras_por_estado = dict(self.sesion.execute(filtrar_atencion(consulta_estados)).all())

        consulta_remitos = select(func.count(RemitoBiologico.id)).where(
            RemitoBiologico.estado == EnTransitoRemito.nombre
        )
        if clinica_id:
            consulta_remitos = consulta_remitos.where(RemitoBiologico.clinica_id == clinica_id)

        consulta_insumos = select(Insumo).where(
            Insumo.activo.is_(True), Insumo.stock_actual <= Insumo.stock_minimo
        )
        if clinica_id:
            consulta_insumos = consulta_insumos.where(Insumo.clinica_id == clinica_id)

        consulta_turnos = select(func.count(Turno.id)).where(
            Turno.inicio.between(inicio_hoy, inicio_hoy + timedelta(days=1)),
            Turno.estado == EstadoTurno.RESERVADO,
        )
        consulta_facturado = select(func.coalesce(func.sum(Comprobante.total), 0)).where(
            Comprobante.fecha >= inicio_mes
        )
        if clinica_id:
            consulta_facturado = consulta_facturado.where(Comprobante.clinica_id == clinica_id)

        return {
            "atenciones_hoy": atenciones_hoy,
            "atenciones_mes": atenciones_mes,
            "muestras_por_estado": muestras_por_estado,
            "remitos_en_transito": self.sesion.scalar(consulta_remitos),
            "turnos_hoy": self.sesion.scalar(consulta_turnos),
            "facturado_mes": round(self.sesion.scalar(consulta_facturado), 2),
            "insumos_bajo_minimo": [
                {
                    "id": i.id,
                    "nombre": i.nombre,
                    "clinica": i.clinica.nombre,
                    "stock_actual": i.stock_actual,
                    "stock_minimo": i.stock_minimo,
                    "unidad": i.unidad,
                }
                for i in self.sesion.scalars(consulta_insumos)
            ],
        }
