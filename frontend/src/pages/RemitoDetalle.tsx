import { ArrowLeft, DeliveryTruck, Location, Printer, Security } from '@carbon/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { laboratorioApi } from '../api/servicios'
import type { MotivoRechazo, RecepcionEntrada, Remito } from '../api/tipos'
import { Boton } from '../components/ui/Boton'
import { AreaTexto, Campo, Entrada, Seleccion } from '../components/ui/Campos'
import { EstadoMuestraInsignia, EstadoRemitoInsignia, Insignia } from '../components/ui/Insignias'
import { Modal } from '../components/ui/Modal'
import { Cargando, Dato, Tarjeta } from '../components/ui/Pagina'
import { useMutacion } from '../hooks/useMutacion'
import { useAuth } from '../stores/auth'
import { ETIQUETA_MOTIVO, fechaHora, horas, temperatura } from '../utils/formato'
import { numeroOpcional, textoOpcional } from '../utils/esquemas'

type Accion = 'despachar' | 'evento' | 'recibir' | null
const INVALIDAR = ['remito', 'remitos', 'muestras', 'conservadoras', 'tablero', 'trazabilidad']

export default function RemitoDetalle() {
  const id = Number(useParams().id)
  const [accion, setAccion] = useState<Accion>(null)
  const { tieneRol } = useAuth()
  const { data: remito, isLoading } = useQuery({ queryKey: ['remito', id], queryFn: () => laboratorioApi.remito(id) })

  if (isLoading || !remito) return <Cargando />
  const enTransito = remito.estado === 'EN_TRANSITO'

  return (
    <>
      <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/remitos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Remitos
        </Link>
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" icono={<Printer size={16} />} onClick={() => window.print()}>Imprimir remito</Boton>
          {remito.estado === 'PREPARADO' && tieneRol('ADMIN', 'VETERINARIO') && (
            <Boton icono={<DeliveryTruck size={16} />} onClick={() => setAccion('despachar')}>Despachar</Boton>
          )}
          {enTransito && (
            <Boton variante="secundario" icono={<Location size={16} />} onClick={() => setAccion('evento')}>Registrar punto de control</Boton>
          )}
          {enTransito && tieneRol('ADMIN', 'LABORATORISTA') && (
            <Boton icono={<Security size={16} />} onClick={() => setAccion('recibir')}>Registrar recepción</Boton>
          )}
        </div>
      </div>

      {/* Documento del remito (es lo que se imprime) */}
      <article className="area-impresion rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-wider text-marca-700 uppercase">Remito biológico</p>
            <h1 className="mt-1 text-2xl font-semibold">{remito.numero}</h1>
            <p className="mt-1 text-sm text-slate-500">Emitido el {fechaHora(remito.fecha_emision)} por {remito.emisor ?? '—'}</p>
          </div>
          <div className="text-right">
            <EstadoRemitoInsignia estado={remito.estado} />
            <div className="mt-3 rounded-lg border-2 border-dashed border-slate-300 px-4 py-2">
              <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Precinto sanitario</p>
              <p className="font-mono text-lg font-semibold">{remito.precinto.codigo}</p>
              {remito.precinto.fecha_verificacion && (
                <Insignia color={remito.precinto.estado === 'ROTO' ? 'rojo' : 'verde'}>
                  {remito.precinto.estado === 'ROTO' ? 'Llegó roto' : 'Verificado intacto'}
                </Insignia>
              )}
            </div>
          </div>
        </header>

        <dl className="grid gap-4 py-5 sm:grid-cols-4">
          <Dato etiqueta="Origen">{remito.clinica.nombre}</Dato>
          <Dato etiqueta="Destino">{remito.laboratorio}</Dato>
          <Dato etiqueta="Conservadora">
            {remito.conservadora.codigo}
            <span className="block text-xs text-slate-500">
              {remito.conservadora.descripcion} · {temperatura(remito.conservadora.temperatura_min)} a {temperatura(remito.conservadora.temperatura_max)}
            </span>
          </Dato>
          <Dato etiqueta="Transportista">{remito.transportista}</Dato>
          <Dato etiqueta="Despacho">{fechaHora(remito.fecha_despacho)}</Dato>
          <Dato etiqueta="Recepción">{fechaHora(remito.fecha_recepcion)}</Dato>
          <Dato etiqueta="Tiempo en tránsito">{horas(remito.horas_en_transito)}</Dato>
          <Dato etiqueta="Observaciones">{remito.observaciones}</Dato>
        </dl>

        <h2 className="mb-2 text-sm font-semibold">Contenido ({remito.muestras.length} muestras)</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
            <tr>
              <th className="py-2">Código</th>
              <th>Análisis</th>
              <th>Paciente</th>
              <th>Extracción</th>
              <th>Conservación</th>
              <th className="no-imprimir">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {remito.muestras.map((m) => (
              <tr key={m.id}>
                <td className="py-2 font-mono text-xs">
                  <Link to={`/muestras/${m.id}`} className="text-marca-700 hover:underline">{m.codigo}</Link>
                </td>
                <td>{m.nombre_analisis}</td>
                <td>{m.mascota} ({m.especie})</td>
                <td>{fechaHora(m.fecha_extraccion)}</td>
                <td>{temperatura(m.temperatura_min)} a {temperatura(m.temperatura_max)} · {m.horas_viabilidad} h</td>
                <td className="no-imprimir">
                  <EstadoMuestraInsignia estado={m.estado} />
                  {m.motivo_rechazo && <p className="text-xs text-rose-600">{ETIQUETA_MOTIVO[m.motivo_rechazo]}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-10 hidden grid-cols-2 gap-10 text-center text-xs text-slate-500 print:grid">
          <div className="border-t border-slate-400 pt-2">Firma emisor (clínica)</div>
          <div className="border-t border-slate-400 pt-2">Firma receptor (laboratorio)</div>
        </div>
      </article>

      <Tarjeta titulo="Cadena de custodia" className="no-imprimir mt-6">
        {remito.eventos.length === 0 ? (
          <p className="text-sm text-slate-500">El remito todavía no fue despachado.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-slate-200 pl-6">
            {remito.eventos.map((e) => (
              <li key={e.id} className="relative">
                <span className={`absolute top-1 -left-[1.95rem] size-3 rounded-full ring-4 ring-white ${e.fuera_de_rango ? 'bg-rose-500' : 'bg-amber-500'}`} />
                <p className="text-xs text-slate-500">{fechaHora(e.fecha)}</p>
                <p className="text-sm font-medium">
                  {e.tipo === 'DESPACHO' ? 'Despacho' : e.tipo === 'ENTREGA' ? 'Entrega en laboratorio' : 'Punto de control'} · {e.ubicacion}
                </p>
                <p className={`text-xs ${e.fuera_de_rango ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
                  {e.responsable} · {temperatura(e.temperatura)} {e.fuera_de_rango && '· temperatura fuera del rango de la conservadora'}
                </p>
              </li>
            ))}
          </ol>
        )}
        {remito.recepcion && (
          <div className={`mt-5 rounded-lg p-3 text-sm ${remito.recepcion.aceptada ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            <strong>{remito.recepcion.aceptada ? 'Recepción conforme' : 'Remito rechazado'}</strong> · precinto {remito.recepcion.estado_precinto.toLowerCase()}
            {' '}(código leído: {remito.recepcion.codigo_precinto_verificado}) · llegada a {temperatura(remito.recepcion.temperatura_llegada)}
            {remito.recepcion.observaciones && ` · ${remito.recepcion.observaciones}`}
          </div>
        )}
      </Tarjeta>

      {accion === 'despachar' && <ModalDespacho remito={remito} alCerrar={() => setAccion(null)} />}
      {accion === 'evento' && <ModalEvento remito={remito} alCerrar={() => setAccion(null)} />}
      {accion === 'recibir' && <ModalRecepcion remito={remito} alCerrar={() => setAccion(null)} />}
    </>
  )
}

const esquemaDespacho = z.object({
  transportista: z.string().min(2, 'Indicá el transportista'),
  ubicacion: z.string().min(2, 'Indicá la ubicación'),
  temperatura: numeroOpcional,
  observacion: textoOpcional,
})

function ModalDespacho({ remito, alCerrar }: { remito: Remito; alCerrar: () => void }) {
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaDespacho),
    defaultValues: { transportista: '', ubicacion: remito.clinica.nombre, temperatura: '' },
  })
  const despachar = useMutacion((d: z.output<typeof esquemaDespacho>) => laboratorioApi.despachar(remito.id, d), {
    exito: 'Remito despachado: las muestras están en tránsito',
    invalidar: INVALIDAR,
    alTerminar: alCerrar,
  })
  return (
    <Modal
      abierto
      titulo={`Despachar ${remito.numero}`}
      alCerrar={alCerrar}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-despacho" cargando={despachar.isPending}>Despachar</Boton></>}
    >
      <form id="form-despacho" onSubmit={handleSubmit((d) => despachar.mutate(d))} className="space-y-4" noValidate>
        <Campo etiqueta="Transportista" error={formState.errors.transportista?.message}><Entrada {...register('transportista')} /></Campo>
        <Campo etiqueta="Lugar de despacho" error={formState.errors.ubicacion?.message}><Entrada {...register('ubicacion')} /></Campo>
        <Campo etiqueta="Temperatura de la conservadora (°C)" ayuda={`Rango admitido: ${temperatura(remito.conservadora.temperatura_min)} a ${temperatura(remito.conservadora.temperatura_max)}`}>
          <Entrada type="number" step="0.1" {...register('temperatura')} />
        </Campo>
        <Campo etiqueta="Observación"><AreaTexto rows={2} {...register('observacion')} /></Campo>
      </form>
    </Modal>
  )
}

const esquemaEvento = z.object({
  ubicacion: z.string().min(2, 'Indicá la ubicación'),
  responsable: z.string().min(2, 'Indicá el responsable'),
  temperatura: numeroOpcional,
  observacion: textoOpcional,
})

function ModalEvento({ remito, alCerrar }: { remito: Remito; alCerrar: () => void }) {
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaEvento),
    defaultValues: { ubicacion: '', responsable: remito.transportista ?? '', temperatura: '' },
  })
  const registrar = useMutacion((d: z.output<typeof esquemaEvento>) => laboratorioApi.registrarEvento(remito.id, d), {
    exito: 'Punto de control registrado',
    invalidar: INVALIDAR,
    alTerminar: alCerrar,
  })
  return (
    <Modal
      abierto
      titulo="Registrar punto de control"
      alCerrar={alCerrar}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-evento" cargando={registrar.isPending}>Registrar</Boton></>}
    >
      <form id="form-evento" onSubmit={handleSubmit((d) => registrar.mutate(d))} className="space-y-4" noValidate>
        <Campo etiqueta="Ubicación" error={formState.errors.ubicacion?.message}><Entrada {...register('ubicacion')} /></Campo>
        <Campo etiqueta="Responsable" error={formState.errors.responsable?.message}><Entrada {...register('responsable')} /></Campo>
        <Campo etiqueta="Temperatura medida (°C)"><Entrada type="number" step="0.1" {...register('temperatura')} /></Campo>
        <Campo etiqueta="Observación"><AreaTexto rows={2} {...register('observacion')} /></Campo>
      </form>
    </Modal>
  )
}

function ModalRecepcion({ remito, alCerrar }: { remito: Remito; alCerrar: () => void }) {
  const [estadoPrecinto, setEstadoPrecinto] = useState<'INTACTO' | 'ROTO'>('INTACTO')
  const [codigo, setCodigo] = useState('')
  const [temp, setTemp] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [rechazos, setRechazos] = useState<Record<number, MotivoRechazo | ''>>({})

  const recibir = useMutacion((d: RecepcionEntrada) => laboratorioApi.recibir(remito.id, d), {
    exito: (r) => (r.estado === 'RECHAZADO' ? 'Precinto roto: se rechazó todo el remito' : 'Remito recibido en el laboratorio'),
    invalidar: INVALIDAR,
    alTerminar: alCerrar,
  })

  const confirmar = () =>
    recibir.mutate({
      estado_precinto: estadoPrecinto,
      codigo_precinto: codigo,
      temperatura_llegada: temp === '' ? null : Number(temp),
      observaciones: observaciones || null,
      rechazos: Object.entries(rechazos)
        .filter(([, motivo]) => motivo)
        .map(([muestra_id, motivo]) => ({ muestra_id: Number(muestra_id), motivo: motivo as MotivoRechazo })),
    })

  return (
    <Modal
      abierto
      ancho="lg"
      titulo={`Recepción de ${remito.numero}`}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
          <Boton variante={estadoPrecinto === 'ROTO' ? 'peligro' : 'primario'} disabled={codigo.length < 3} cargando={recibir.isPending} onClick={confirmar}>
            {estadoPrecinto === 'ROTO' ? 'Rechazar remito' : 'Confirmar recepción'}
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Estado del precinto sanitario</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['INTACTO', 'ROTO'] as const).map((e) => (
              <label
                key={e}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  estadoPrecinto === e ? (e === 'ROTO' ? 'border-rose-500 bg-rose-50' : 'border-marca-600 bg-marca-50') : 'border-slate-300'
                }`}
              >
                <input type="radio" className="accent-marca-700" checked={estadoPrecinto === e} onChange={() => setEstadoPrecinto(e)} />
                {e === 'INTACTO' ? 'Intacto' : 'Roto o violado'}
              </label>
            ))}
          </div>
          {estadoPrecinto === 'ROTO' && (
            <p className="mt-2 text-sm text-rose-700">
              Todas las muestras pasarán a <strong>Rechazada</strong> y no podrán procesarse.
            </p>
          )}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Código leído en el precinto" ayuda={`Debe coincidir con el emitido en el remito (${remito.precinto.codigo}).`}>
            <Entrada className="font-mono uppercase" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="PS-XXXXXXXX" />
          </Campo>
          <Campo etiqueta="Temperatura de llegada (°C)" ayuda="Fuera del rango de un análisis, esa muestra se rechaza.">
            <Entrada type="number" step="0.1" value={temp} onChange={(e) => setTemp(e.target.value)} />
          </Campo>
        </div>
        {estadoPrecinto === 'INTACTO' && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Control individual de muestras</p>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {remito.muestras.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <span className="flex-1">
                    <span className="font-mono text-xs">{m.codigo}</span> · {m.nombre_analisis}
                  </span>
                  <Seleccion className="w-auto" value={rechazos[m.id] ?? ''} onChange={(e) => setRechazos({ ...rechazos, [m.id]: e.target.value as MotivoRechazo | '' })}>
                    <option value="">Apta</option>
                    <option value="MUESTRA_NO_APTA">Rechazar: no apta</option>
                    <option value="TEMPERATURA_FUERA_RANGO">Rechazar: temperatura</option>
                    <option value="TIEMPO_EXCEDIDO">Rechazar: tiempo excedido</option>
                  </Seleccion>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">El sistema también rechaza automáticamente las muestras que superaron su tiempo de viabilidad.</p>
          </div>
        )}
        <Campo etiqueta="Observaciones"><AreaTexto rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}
