import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-marca-700 text-white hover:bg-marca-800 shadow-sm',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  peligro: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  fantasma: 'text-slate-600 hover:bg-slate-100',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  icono?: ReactNode
  cargando?: boolean
  chico?: boolean
}

export function Boton({ variante = 'primario', icono, cargando, chico, className = '', children, disabled, ...resto }: Props) {
  return (
    <button
      type="button"
      disabled={disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-50 ${chico ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'}
        ${ESTILOS[variante]} ${className}`}
      {...resto}
    >
      {cargando ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icono}
      {children}
    </button>
  )
}
