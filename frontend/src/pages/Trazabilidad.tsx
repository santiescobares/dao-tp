import { ArrowLeft, Locked, Temperature } from '@carbon/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { laboratorioApi } from '../api/servicios'
import { CicloDeVida } from '../components/CicloDeVida'
import { EstadoMuestraInsignia, EstadoRemitoInsignia, Insignia } from '../components/ui/Insignias'
import { Cargando, Dato, EncabezadoPagina, Tarjeta } from '../components/ui/Pagina'
import { ETIQUETA_ESTADO_MUESTRA, ETIQUETA_MOTIVO, ETIQUETA_TIPO_MUESTRA, fechaHora, temperatura } from '../utils/formato'

interface EntradaLinea {
  fecha: string
  titulo: string
  detalle?: string | null
  alerta?: boolean
  tipo: 'estado' | 'envio'
}

export default function Trazabilidad() {
  const id = Number(useParams().id)
  const { data, isLoading } = useQuery({ queryKey: ['trazabilidad', id], queryFn: () => laboratorioApi.trazabilidad(id) })

  if (isLoading || !data) return <Cargando />
  const { muestra, historial, remito, resultado } = data

  // Línea de tiempo unificada: cambios de estado + eslabones de la cadena de envío
  const linea: EntradaLinea[] = [
    ...historial.map((h) => ({
      fecha: h.fecha,
      tipo: 'estado' as const,
      titulo: h.estado_anterior
        ? `${ETIQUETA_ESTADO_MUESTRA[h.estado_anterior]} → ${ETIQUETA_ESTADO_MUESTRA[h.estado_nuevo]}`
        : ETIQUETA_ESTADO_MUESTRA[h.estado_nuevo],
      detalle: [h.observacion, h.usuario && `por ${h.usuario}`].filter(Boolean).join(' · '),
      alerta: h.estado_nuevo === 'RECHAZADA',
    })),
    ...(remito?.eventos ?? []).map((e) => ({
      fecha: e.fecha,
      tipo: 'envio' as const,
      titulo: `${e.tipo === 'DESPACHO' ? 'Despacho' : e.tipo === 'ENTREGA' ? 'Entrega' : 'Punto de control'} · ${e.ubicacion}`,
      detalle: `${e.responsable} · ${temperatura(e.temperatura)}${e.fuera_de_rango ? ' (fuera de rango)' : ''}`,
      alerta: e.fuera_de_rango,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === 'envio' ? -1 : 1))

  return (
    <>
      <Link to="/muestras" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Muestras
      </Link>
      <EncabezadoPagina
        titulo={`Trazabilidad de ${muestra.codigo}`}
        descripcion={`${muestra.nombre_analisis} · ${ETIQUETA_TIPO_MUESTRA[muestra.tipo_muestra]} · ${muestra.mascota} (${muestra.especie})`}
        acciones={<EstadoMuestraInsignia estado={muestra.estado} />}
      />

      <Tarjeta titulo="Ciclo de vida de la muestra">
        <CicloDeVida historial={historial} estado={muestra.estado} />
      </Tarjeta>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Tarjeta titulo="Registro de custodia" className="lg:col-span-2">
          <ol className="relative space-y-5 border-l border-slate-200 pl-6">
            {linea.map((e, i) => (
              <li key={i} className="relative">
                <span
                  className={`absolute top-1 -left-[1.95rem] size-3 rounded-full ring-4 ring-white ${
                    e.alerta ? 'bg-rose-500' : e.tipo === 'estado' ? 'bg-marca-700' : 'bg-amber-500'
                  }`}
                />
                <p className="text-xs text-slate-500">{fechaHora(e.fecha)}</p>
                <p className={`text-sm font-medium ${e.alerta ? 'text-rose-700' : 'text-slate-800'}`}>{e.titulo}</p>
                {e.detalle && <p className="text-xs text-slate-500">{e.detalle}</p>}
              </li>
            ))}
          </ol>
          <p className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <Locked size={14} /> Los registros de estado son inmutables: no pueden editarse ni eliminarse.
          </p>
        </Tarjeta>

        <div className="space-y-6">
          <Tarjeta titulo="Origen">
            <dl className="space-y-3">
              <Dato etiqueta="Clínica">{muestra.clinica}</Dato>
              <Dato etiqueta="Solicitada por">{data.profesional_solicitante}</Dato>
              <Dato etiqueta="Orden">{muestra.orden_numero} {muestra.urgente && <Insignia color="rojo">Urgente</Insignia>}</Dato>
              <Dato etiqueta="Responsable">{muestra.responsable}</Dato>
              <Dato etiqueta="Condiciones">
                <span className="inline-flex items-center gap-1">
                  <Temperature size={14} /> {temperatura(muestra.temperatura_min)} a {temperatura(muestra.temperatura_max)} · viable {muestra.horas_viabilidad} h
                </span>
              </Dato>
              {muestra.motivo_rechazo && (
                <Dato etiqueta="Motivo de rechazo">
                  <span className="font-medium text-rose-700">{ETIQUETA_MOTIVO[muestra.motivo_rechazo]}</span>
                </Dato>
              )}
            </dl>
          </Tarjeta>

          {remito && (
            <Tarjeta titulo="Remito biológico" acciones={<Link to={`/remitos/${remito.id}`} className="text-xs font-medium text-marca-700 hover:underline">Ver remito</Link>}>
              <dl className="space-y-3">
                <Dato etiqueta="Número">{remito.numero} <EstadoRemitoInsignia estado={remito.estado} /></Dato>
                <Dato etiqueta="Conservadora">{remito.conservadora.codigo}</Dato>
                <Dato etiqueta="Precinto sanitario">
                  <span className="font-mono text-xs">{remito.precinto.codigo}</span>{' '}
                  <Insignia color={remito.precinto.estado === 'ROTO' ? 'rojo' : 'verde'}>{remito.precinto.estado === 'ROTO' ? 'Roto' : 'Intacto'}</Insignia>
                </Dato>
                <Dato etiqueta="Transportista">{remito.transportista}</Dato>
              </dl>
            </Tarjeta>
          )}

          {resultado && (
            <Tarjeta titulo="Resultado del análisis">
              <dl className="space-y-3">
                <Dato etiqueta="Valores"><span className="whitespace-pre-line">{resultado.valores}</span></Dato>
                <Dato etiqueta="Conclusión">{resultado.conclusion}</Dato>
                {resultado.observaciones && <Dato etiqueta="Observaciones">{resultado.observaciones}</Dato>}
                <Dato etiqueta="Firmado por">{resultado.profesional.nombre_completo} · {resultado.profesional.matricula}</Dato>
                <Dato etiqueta="Fecha">{fechaHora(resultado.fecha)}</Dato>
              </dl>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  )
}
