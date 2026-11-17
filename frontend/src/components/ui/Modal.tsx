import { Close } from '@carbon/icons-react'
import { useEffect, type ReactNode } from 'react'

interface Props {
  abierto: boolean
  titulo: string
  alCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  ancho?: 'md' | 'lg' | 'xl'
}

const ANCHOS = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ abierto, titulo, alCerrar, children, pie, ancho = 'md' }: Props) {
  useEffect(() => {
    if (!abierto) return
    const alPresionar = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar()
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [abierto, alCerrar])

  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onMouseDown={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`w-full ${ANCHOS[ancho]} rounded-xl bg-white shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button type="button" onClick={alCerrar} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Cerrar">
            <Close size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {pie && <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">{pie}</div>}
      </div>
    </div>
  )
}
