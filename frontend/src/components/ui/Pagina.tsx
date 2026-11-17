import type { ReactNode } from 'react'

export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 no-imprimir">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

export function Tarjeta({ titulo, acciones, children, className = '' }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(titulo || acciones) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          {acciones}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function Kpi({ etiqueta, valor, detalle, tono = 'normal' }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode; tono?: 'normal' | 'alerta' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tono === 'alerta' ? 'text-rose-600' : 'text-slate-900'}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <span className="size-5 animate-spin rounded-full border-2 border-marca-600 border-t-transparent" />
      {texto}
    </div>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">{children}</p>
}

export function Pestanas<T extends string>({ opciones, activa, alCambiar }: { opciones: { valor: T; etiqueta: string }[]; activa: T; alCambiar: (v: T) => void }) {
  return (
    <div className="mb-5 flex flex-wrap gap-x-1 border-b border-slate-200 no-imprimir" role="tablist">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={activa === o.valor}
          onClick={() => alCambiar(o.valor)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
            activa === o.valor ? 'border-marca-700 text-marca-800' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  )
}

/** Fila de dato "etiqueta: valor" usada en fichas de detalle. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children ?? '—'}</dd>
    </div>
  )
}
