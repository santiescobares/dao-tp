import type { ReactNode } from 'react'
import type { EstadoConservadora, EstadoMuestra, EstadoRemito, TipoAtencion } from '../../api/tipos'
import {
  ETIQUETA_CONSERVADORA,
  ETIQUETA_ESTADO_MUESTRA,
  ETIQUETA_ESTADO_REMITO,
  ETIQUETA_TIPO_ATENCION,
} from '../../utils/formato'

export type Color = 'gris' | 'indigo' | 'ambar' | 'celeste' | 'verde' | 'rojo' | 'marca'

const COLORES: Record<Color, string> = {
  gris: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  ambar: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  celeste: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rojo: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  marca: 'bg-marca-50 text-marca-800 ring-marca-600/20',
}

export function Insignia({ color = 'gris', children }: { color?: Color; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${COLORES[color]}`}>
      {children}
    </span>
  )
}

export const COLOR_ESTADO_MUESTRA: Record<EstadoMuestra, Color> = {
  EXTRAIDA: 'gris',
  EMPAQUETADA: 'indigo',
  EN_TRANSITO: 'ambar',
  RECIBIDA: 'celeste',
  ANALIZADA: 'verde',
  RECHAZADA: 'rojo',
}
const COLOR_ESTADO_REMITO: Record<EstadoRemito, Color> = {
  PREPARADO: 'indigo',
  EN_TRANSITO: 'ambar',
  RECIBIDO: 'verde',
  RECHAZADO: 'rojo',
}
const COLOR_CONSERVADORA: Record<EstadoConservadora, Color> = {
  DISPONIBLE: 'verde',
  EN_USO: 'ambar',
  MANTENIMIENTO: 'gris',
  BAJA: 'rojo',
}
const COLOR_TIPO_ATENCION: Record<TipoAtencion, Color> = {
  CONSULTA: 'celeste',
  CONTROL: 'marca',
  URGENCIA: 'rojo',
}

export const EstadoMuestraInsignia = ({ estado }: { estado: EstadoMuestra }) => (
  <Insignia color={COLOR_ESTADO_MUESTRA[estado]}>{ETIQUETA_ESTADO_MUESTRA[estado]}</Insignia>
)
export const EstadoRemitoInsignia = ({ estado }: { estado: EstadoRemito }) => (
  <Insignia color={COLOR_ESTADO_REMITO[estado]}>{ETIQUETA_ESTADO_REMITO[estado]}</Insignia>
)
export const ConservadoraInsignia = ({ estado }: { estado: EstadoConservadora }) => (
  <Insignia color={COLOR_CONSERVADORA[estado]}>{ETIQUETA_CONSERVADORA[estado]}</Insignia>
)
export const TipoAtencionInsignia = ({ tipo }: { tipo: TipoAtencion }) => (
  <Insignia color={COLOR_TIPO_ATENCION[tipo]}>{ETIQUETA_TIPO_ATENCION[tipo]}</Insignia>
)
