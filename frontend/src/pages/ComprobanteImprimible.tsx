import { ArrowLeft, Printer } from '@carbon/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { gestionApi } from '../api/servicios'
import { Boton } from '../components/ui/Boton'
import { Cargando, Dato } from '../components/ui/Pagina'
import { useClinicas } from '../hooks/useCatalogos'
import { ETIQUETA_TIPO_ATENCION, fechaHora, moneda } from '../utils/formato'

export default function ComprobanteImprimible() {
  const id = Number(useParams().id)
  const navegar = useNavigate()
  const { data: c, isLoading } = useQuery({ queryKey: ['comprobante', id], queryFn: () => gestionApi.comprobante(id) })
  const { data: clinicas } = useClinicas()
  const clinica = clinicas?.find((x) => x.id === c?.clinica.id)

  if (isLoading || !c) return <Cargando />

  return (
    <>
      <div className="no-imprimir mb-4 flex items-center justify-between">
        <button type="button" onClick={() => navegar(-1)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Volver
        </button>
        <Boton icono={<Printer size={16} />} onClick={() => window.print()}>Imprimir</Boton>
      </div>

      <article className="area-impresion mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="flex items-start gap-3">
            <img src="/favicon.svg" alt="" className="size-10" />
            <div>
              <p className="text-lg font-semibold">VetRed · {c.clinica.nombre}</p>
              {clinica && <p className="text-sm text-slate-500">{clinica.direccion} · Tel. {clinica.telefono}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold tracking-wider text-marca-700 uppercase">Comprobante de atención</p>
            <p className="font-mono text-lg font-semibold">{c.numero}</p>
            <p className="text-sm text-slate-500">{fechaHora(c.fecha)}</p>
          </div>
        </header>

        <dl className="grid gap-4 py-6 sm:grid-cols-2">
          <Dato etiqueta="Responsable">{c.responsable} · DNI {c.responsable_dni}</Dato>
          <Dato etiqueta="Paciente">{c.mascota}</Dato>
          <Dato etiqueta="Profesional">{c.profesional}</Dato>
          <Dato etiqueta="Tipo de atención">{ETIQUETA_TIPO_ATENCION[c.tipo_atencion]}</Dato>
        </dl>

        <table className="w-full text-sm">
          <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2 text-center">Cant.</th>
              <th className="px-3 py-2 text-right">Precio unit.</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {c.items.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2">{i.concepto}</td>
                <td className="px-3 py-2 text-center">{i.cantidad}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneda(i.precio_unitario)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneda(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300">
              <td colSpan={3} className="px-3 py-3 text-right font-semibold">Total</td>
              <td className="px-3 py-3 text-right text-lg font-semibold tabular-nums">{moneda(c.total)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-8 text-xs text-slate-500">
          Los análisis de laboratorio de muestras rechazadas no se facturan. Documento no válido como factura.
        </p>
        <p className="no-imprimir mt-4 text-xs">
          <Link to={`/atenciones`} className="text-marca-700 hover:underline">Ir a atenciones</Link>
        </p>
      </article>
    </>
  )
}
