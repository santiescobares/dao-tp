import { CheckmarkFilled, ErrorFilled } from '@carbon/icons-react'
import type { EstadoMuestra, RegistroHistorial } from '../api/tipos'
import { ETIQUETA_ESTADO_MUESTRA, fechaHora } from '../utils/formato'

const CICLO: EstadoMuestra[] = ['EXTRAIDA', 'EMPAQUETADA', 'EN_TRANSITO', 'RECIBIDA', 'ANALIZADA']

/** Diagrama del patrón State: muestra las etapas alcanzadas y, si corresponde, el rechazo. */
export function CicloDeVida({ historial, estado }: { historial: RegistroHistorial[]; estado: EstadoMuestra }) {
  const fechas = new Map(historial.map((h) => [h.estado_nuevo, h.fecha]))
  const rechazo = historial.find((h) => h.estado_nuevo === 'RECHAZADA')

  return (
    <div>
      <ol className="flex flex-wrap items-start gap-y-4">
        {CICLO.map((etapa, i) => {
          const alcanzada = fechas.has(etapa)
          const cortada = !!rechazo && !alcanzada
          return (
            <li key={etapa} className="flex min-w-[7.5rem] flex-1 items-start">
              <div className="flex flex-col items-center text-center">
                <span
                  className={`flex size-9 items-center justify-center rounded-full border-2 ${
                    alcanzada
                      ? 'border-marca-700 bg-marca-700 text-white'
                      : cortada
                        ? 'border-slate-200 bg-slate-50 text-slate-300'
                        : 'border-slate-300 bg-white text-slate-400'
                  }`}
                >
                  {alcanzada ? <CheckmarkFilled size={18} /> : <span className="text-xs font-semibold">{i + 1}</span>}
                </span>
                <span className={`mt-2 text-xs font-medium ${alcanzada ? 'text-slate-800' : 'text-slate-400'}`}>
                  {ETIQUETA_ESTADO_MUESTRA[etapa]}
                </span>
                <span className="text-[11px] text-slate-500">{alcanzada ? fechaHora(fechas.get(etapa)!) : ''}</span>
              </div>
              {i < CICLO.length - 1 && (
                <span className={`mx-1 mt-4 h-0.5 flex-1 ${fechas.has(CICLO[i + 1]) ? 'bg-marca-700' : 'bg-slate-200'}`} />
              )}
            </li>
          )
        })}
      </ol>
      {estado === 'RECHAZADA' && rechazo && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <ErrorFilled size={18} className="mt-0.5 shrink-0" />
          <p>
            <strong>Muestra rechazada</strong> el {fechaHora(rechazo.fecha)} estando en estado “
            {rechazo.estado_anterior ? ETIQUETA_ESTADO_MUESTRA[rechazo.estado_anterior] : '—'}”. No puede procesarse.
            {rechazo.observacion && ` ${rechazo.observacion}.`}
          </p>
        </div>
      )}
    </div>
  )
}
