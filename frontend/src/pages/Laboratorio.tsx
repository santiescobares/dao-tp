import { DocumentAdd, Misuse } from '@carbon/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { laboratorioApi } from '../api/servicios'
import type { Muestra } from '../api/tipos'
import { Boton } from '../components/ui/Boton'
import { AreaTexto, Campo, Seleccion } from '../components/ui/Campos'
import { Insignia } from '../components/ui/Insignias'
import { Modal } from '../components/ui/Modal'
import { EncabezadoPagina, Kpi } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useMutacion } from '../hooks/useMutacion'
import { useAuth } from '../stores/auth'
import { fechaHora } from '../utils/formato'
import { textoOpcional } from '../utils/esquemas'

const INVALIDAR = ['muestras', 'tablero', 'trazabilidad', 'remito']

export default function Laboratorio() {
  const esLaboratorista = useAuth((s) => s.tieneRol('LABORATORISTA'))
  const [resultado, setResultado] = useState<Muestra | null>(null)
  const [rechazo, setRechazo] = useState<Muestra | null>(null)
  const { data: recibidas, isLoading } = useQuery({ queryKey: ['muestras', 'RECIBIDA'], queryFn: () => laboratorioApi.muestras({ estado: 'RECIBIDA' }) })
  const { data: enTransito } = useQuery({ queryKey: ['remitos', 'EN_TRANSITO'], queryFn: () => laboratorioApi.remitos({ estado: 'EN_TRANSITO' }) })

  return (
    <>
      <EncabezadoPagina titulo="Laboratorio central" descripcion="Muestras recibidas pendientes de análisis" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi etiqueta="Pendientes de análisis" valor={recibidas?.length ?? '—'} />
        <Kpi etiqueta="Urgentes" valor={recibidas?.filter((m) => m.urgente).length ?? '—'} tono="alerta" />
        <Link to="/remitos?estado=EN_TRANSITO" className="block">
          <Kpi etiqueta="Remitos por recibir" valor={enTransito?.length ?? '—'} detalle="Ver remitos en tránsito →" />
        </Link>
      </div>
      <Tabla
        filas={recibidas}
        cargando={isLoading}
        clave={(m) => m.id}
        vacio="No hay muestras pendientes de análisis."
        columnas={[
          {
            titulo: 'Código',
            celda: (m) => (
              <Link to={`/muestras/${m.id}`} className="font-mono text-xs text-marca-700 hover:underline">{m.codigo}</Link>
            ),
          },
          { titulo: 'Análisis', celda: (m) => <span className="font-medium">{m.nombre_analisis}</span> },
          { titulo: 'Paciente', celda: (m) => `${m.mascota} (${m.especie})` },
          { titulo: 'Clínica', celda: (m) => m.clinica },
          { titulo: 'Extracción', celda: (m) => fechaHora(m.fecha_extraccion) },
          { titulo: 'Prioridad', celda: (m) => (m.urgente ? <Insignia color="rojo">Urgente</Insignia> : <Insignia>Normal</Insignia>) },
          {
            titulo: 'Acciones',
            className: 'text-right',
            celda: (m) => (
              <div className="flex justify-end gap-1">
                {esLaboratorista && (
                  <Boton chico icono={<DocumentAdd size={14} />} onClick={() => setResultado(m)}>Cargar resultado</Boton>
                )}
                <Boton chico variante="secundario" icono={<Misuse size={14} />} onClick={() => setRechazo(m)}>No apta</Boton>
              </div>
            ),
          },
        ]}
      />
      {!esLaboratorista && <p className="mt-3 text-xs text-slate-500">Los resultados solo puede firmarlos un profesional del laboratorio.</p>}
      {resultado && <ModalResultado muestra={resultado} alCerrar={() => setResultado(null)} />}
      {rechazo && <ModalRechazo muestra={rechazo} alCerrar={() => setRechazo(null)} />}
    </>
  )
}

const esquemaResultado = z.object({
  valores: z.string().min(3, 'Ingresá los valores obtenidos'),
  conclusion: z.string().min(3, 'Ingresá la conclusión'),
  observaciones: textoOpcional,
})

function ModalResultado({ muestra, alCerrar }: { muestra: Muestra; alCerrar: () => void }) {
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(esquemaResultado) })
  const guardar = useMutacion((d: z.output<typeof esquemaResultado>) => laboratorioApi.cargarResultado(muestra.id, d), {
    exito: `Resultado registrado: ${muestra.codigo} pasó a Analizada`,
    invalidar: INVALIDAR,
    alTerminar: alCerrar,
  })
  return (
    <Modal
      abierto
      ancho="lg"
      titulo={`Resultado · ${muestra.nombre_analisis}`}
      alCerrar={alCerrar}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-resultado" cargando={guardar.isPending}>Registrar resultado</Boton></>}
    >
      <p className="mb-4 text-sm text-slate-500">
        Muestra {muestra.codigo} · {muestra.mascota} ({muestra.especie}) · {muestra.clinica}
      </p>
      <form id="form-resultado" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="space-y-4" noValidate>
        <Campo etiqueta="Valores obtenidos" error={formState.errors.valores?.message}><AreaTexto rows={4} {...register('valores')} /></Campo>
        <Campo etiqueta="Conclusión" error={formState.errors.conclusion?.message}><AreaTexto rows={2} {...register('conclusion')} /></Campo>
        <Campo etiqueta="Observaciones"><AreaTexto rows={2} {...register('observaciones')} /></Campo>
      </form>
    </Modal>
  )
}

function ModalRechazo({ muestra, alCerrar }: { muestra: Muestra; alCerrar: () => void }) {
  const [observacion, setObservacion] = useState('')
  const [motivo, setMotivo] = useState<'MUESTRA_NO_APTA' | 'TIEMPO_EXCEDIDO'>('MUESTRA_NO_APTA')
  const rechazar = useMutacion(() => laboratorioApi.rechazarMuestra(muestra.id, { motivo, observacion: observacion || null }), {
    exito: `Muestra ${muestra.codigo} rechazada`,
    invalidar: INVALIDAR,
    alTerminar: alCerrar,
  })
  return (
    <Modal
      abierto
      titulo={`Rechazar ${muestra.codigo}`}
      alCerrar={alCerrar}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton variante="peligro" cargando={rechazar.isPending} onClick={() => rechazar.mutate(undefined)}>Rechazar muestra</Boton></>}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">La muestra pasará a estado Rechazada de forma definitiva y no se facturará.</p>
        <Campo etiqueta="Motivo">
          <Seleccion value={motivo} onChange={(e) => setMotivo(e.target.value as typeof motivo)}>
            <option value="MUESTRA_NO_APTA">Muestra no apta (hemolizada, insuficiente, contaminada…)</option>
            <option value="TIEMPO_EXCEDIDO">Tiempo de viabilidad excedido</option>
          </Seleccion>
        </Campo>
        <Campo etiqueta="Observación"><AreaTexto rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}
