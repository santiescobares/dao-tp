import { ArrowRight, WarningAlt } from '@carbon/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { reportesApi } from '../api/servicios'
import type { EstadoMuestra } from '../api/tipos'
import { COLOR_ESTADO_MUESTRA, Insignia } from '../components/ui/Insignias'
import { Cargando, EncabezadoPagina, Kpi, Tarjeta } from '../components/ui/Pagina'
import { useAuth } from '../stores/auth'
import { ETIQUETA_ESTADO_MUESTRA, moneda } from '../utils/formato'

const CICLO: EstadoMuestra[] = ['EXTRAIDA', 'EMPAQUETADA', 'EN_TRANSITO', 'RECIBIDA', 'ANALIZADA']

const ACCESOS = {
  ADMIN: [
    { ruta: '/atenciones/nueva', texto: 'Registrar una atención' },
    { ruta: '/remitos?estado=EN_TRANSITO', texto: 'Seguir remitos en tránsito' },
    { ruta: '/reportes', texto: 'Ver reportes de gestión' },
  ],
  VETERINARIO: [
    { ruta: '/atenciones/nueva', texto: 'Registrar una atención' },
    { ruta: '/empaquetado', texto: 'Empaquetar muestras extraídas' },
    { ruta: '/agenda', texto: 'Ver mi agenda' },
  ],
  LABORATORISTA: [
    { ruta: '/remitos?estado=EN_TRANSITO', texto: 'Recibir remitos en tránsito' },
    { ruta: '/laboratorio', texto: 'Cargar resultados pendientes' },
    { ruta: '/agenda', texto: 'Agenda del laboratorio' },
  ],
}

export default function Tablero() {
  const usuario = useAuth((s) => s.usuario)!
  const { data, isLoading } = useQuery({ queryKey: ['tablero'], queryFn: reportesApi.tablero })

  if (isLoading || !data) return <Cargando />
  const estados = data.muestras_por_estado
  const rechazadas = estados.RECHAZADA ?? 0

  return (
    <>
      <EncabezadoPagina
        titulo={`Hola, ${usuario.nombre.split(' ')[0]}`}
        descripcion="Resumen de la actividad de la red"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi etiqueta="Atenciones hoy" valor={data.atenciones_hoy} detalle={`${data.atenciones_mes} en el mes`} />
        <Kpi etiqueta="Remitos en tránsito" valor={data.remitos_en_transito} detalle="Hacia el laboratorio central" />
        <Kpi etiqueta="Turnos de hoy" valor={data.turnos_hoy} detalle="Reservados" />
        {usuario.rol === 'LABORATORISTA' ? (
          <Kpi etiqueta="Pendientes de análisis" valor={estados.RECIBIDA ?? 0} detalle="Muestras recibidas" />
        ) : (
          <Kpi etiqueta="Facturado en el mes" valor={moneda(data.facturado_mes)} />
        )}
      </div>

      <Tarjeta titulo="Muestras por etapa de la cadena de custodia" className="mt-6">
        <ol className="grid gap-3 sm:grid-cols-5">
          {CICLO.map((estado, i) => (
            <li key={estado} className="relative">
              <Link
                to={`/muestras?estado=${estado}`}
                className="block rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:border-marca-600"
              >
                <Insignia color={COLOR_ESTADO_MUESTRA[estado]}>{ETIQUETA_ESTADO_MUESTRA[estado]}</Insignia>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{estados[estado] ?? 0}</p>
              </Link>
              {i < CICLO.length - 1 && (
                <ArrowRight className="absolute top-1/2 -right-3 hidden -translate-y-1/2 text-slate-300 sm:block" size={16} />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-slate-500">
          <Link to="/muestras?estado=RECHAZADA" className="font-medium text-rose-600 hover:underline">
            {rechazadas} muestras rechazadas
          </Link>{' '}
          por precinto roto, cadena de frío o tiempo de viabilidad excedido.
        </p>
      </Tarjeta>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Tarjeta titulo="Accesos rápidos">
          <ul className="divide-y divide-slate-100">
            {ACCESOS[usuario.rol].map((a) => (
              <li key={a.ruta}>
                <Link to={a.ruta} className="flex items-center justify-between py-2.5 text-sm font-medium text-marca-800 hover:text-marca-600">
                  {a.texto} <ArrowRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
        </Tarjeta>

        {usuario.rol !== 'LABORATORISTA' && (
          <Tarjeta titulo="Insumos con stock bajo" acciones={<Link to="/stock" className="text-xs font-medium text-marca-700 hover:underline">Ir a stock</Link>}>
            {data.insumos_bajo_minimo.length === 0 ? (
              <p className="text-sm text-slate-500">Todos los insumos están por encima del mínimo.</p>
            ) : (
              <ul className="space-y-2">
                {data.insumos_bajo_minimo.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 text-sm">
                    <WarningAlt className="shrink-0 text-amber-500" size={18} />
                    <span className="flex-1">
                      {i.nombre} <span className="text-slate-500">· {i.clinica}</span>
                    </span>
                    <span className="tabular-nums text-slate-600">
                      {i.stock_actual} / mín. {i.stock_minimo} {i.unidad}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        )}
      </div>
    </>
  )
}
