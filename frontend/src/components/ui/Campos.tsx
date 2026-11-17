import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const BASE_CONTROL =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/20 focus:outline-none ' +
  'disabled:bg-slate-100 disabled:text-slate-500'

interface PropsCampo {
  etiqueta?: string
  error?: string
  ayuda?: string
  className?: string
  children: ReactNode
}

/** Envoltorio de un control de formulario con etiqueta y mensaje de error. */
export function Campo({ etiqueta, error, ayuda, className = '', children }: PropsCampo) {
  return (
    <label className={`block ${className}`}>
      {etiqueta && <span className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</span>}
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rose-600">{error}</span>
      ) : (
        ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>
      )}
    </label>
  )
}

export function Entrada({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input className={`${BASE_CONTROL} ${className}`} {...props} />
}

export function Seleccion({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: React.Ref<HTMLSelectElement> }) {
  return (
    <select className={`${BASE_CONTROL} pr-8 ${className}`} {...props}>
      {children}
    </select>
  )
}

export function AreaTexto({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea rows={3} className={`${BASE_CONTROL} ${className}`} {...props} />
}

export function Casilla({ etiqueta, ...props }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: ReactNode; ref?: React.Ref<HTMLInputElement> }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="size-4 rounded border-slate-300 accent-marca-700" {...props} />
      {etiqueta}
    </label>
  )
}
