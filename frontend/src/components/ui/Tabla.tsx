import type { ReactNode } from 'react'

export interface Columna<T> {
  titulo: string
  celda: (fila: T) => ReactNode
  className?: string
}

interface Props<T> {
  columnas: Columna<T>[]
  filas: T[] | undefined
  clave: (fila: T) => string | number
  cargando?: boolean
  vacio?: string
  alHacerClic?: (fila: T) => void
}

export function Tabla<T>({ columnas, filas, clave, cargando, vacio = 'No hay registros para mostrar.', alHacerClic }: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} className={`px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase ${c.className ?? ''}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cargando && (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-10 text-center text-slate-500">
                Cargando…
              </td>
            </tr>
          )}
          {!cargando && filas?.length === 0 && (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-10 text-center text-slate-500">
                {vacio}
              </td>
            </tr>
          )}
          {!cargando &&
            filas?.map((fila) => (
              <tr
                key={clave(fila)}
                onClick={alHacerClic ? () => alHacerClic(fila) : undefined}
                className={alHacerClic ? 'cursor-pointer hover:bg-marca-50/60' : 'hover:bg-slate-50/60'}
              >
                {columnas.map((c) => (
                  <td key={c.titulo} className={`px-4 py-2.5 align-middle ${c.className ?? ''}`}>
                    {c.celda(fila)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
