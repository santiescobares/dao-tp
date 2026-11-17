import { Add, ChevronLeft, ChevronRight } from '@carbon/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { gestionApi, laboratorioApi } from '../api/servicios'
import type { Horario, Profesional, Turno } from '../api/tipos'
import { Boton } from '../components/ui/Boton'
import { Campo, Entrada, Seleccion } from '../components/ui/Campos'
import { Insignia } from '../components/ui/Insignias'
import { Modal } from '../components/ui/Modal'
import { Dato, EncabezadoPagina } from '../components/ui/Pagina'
import { useMascotas, useProfesionales } from '../hooks/useCatalogos'
import { useMutacion } from '../hooks/useMutacion'
import { useAuth } from '../stores/auth'
import { DIAS_SEMANA, fechaHora } from '../utils/formato'
import { numeroOpcional } from '../utils/esquemas'

const HORA_INICIO = 8
const HORA_FIN = 21
const ALTO_MEDIA_HORA = 28 // px

// ---------- utilidades de fechas (hora local) ----------
const inicioDeSemana = (d: Date) => {
  const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
  return lunes
}
const sumarDias = (d: Date, dias: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias)
const fechaLocal = (d: Date) => d.toLocaleDateString('sv-SE')
const aISOlocal = (fecha: string, hora: string) => `${fecha}T${hora}:00`
const minutosDelDia = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
const aMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export default function Agenda() {
  const usuario = useAuth((s) => s.usuario)!
  const tipoProfesional = usuario.rol === 'LABORATORISTA' ? 'LABORATORISTA' : usuario.rol === 'VETERINARIO' ? 'VETERINARIO' : undefined
  const { data: profesionales } = useProfesionales(tipoProfesional, usuario.rol === 'VETERINARIO' ? (usuario.clinica_id ?? undefined) : undefined)
  const [elegido, setProfesionalId] = useState<number | ''>(usuario.profesional_id ?? '')
  const [lunes, setLunes] = useState(() => inicioDeSemana(new Date()))
  const [nuevo, setNuevo] = useState<{ fecha: string; hora: string } | null>(null)
  const [detalle, setDetalle] = useState<Turno | null>(null)

  // Si no se eligió nadie, se muestra el primer profesional de la lista
  const profesionalId: number | '' = elegido !== '' ? elegido : (profesionales?.[0]?.id ?? '')

  const profesional = profesionales?.find((p) => p.id === profesionalId)
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)), [lunes])
  const { data: turnos } = useQuery({
    queryKey: ['turnos', profesionalId, fechaLocal(lunes)],
    queryFn: () => gestionApi.turnos({ profesional_id: Number(profesionalId), desde: `${fechaLocal(lunes)}T00:00`, hasta: `${fechaLocal(sumarDias(lunes, 7))}T00:00` }),
    enabled: profesionalId !== '',
  })
  const { data: horarios } = useQuery({
    queryKey: ['horarios', profesionalId],
    queryFn: () => gestionApi.horarios(Number(profesionalId)),
    enabled: profesionalId !== '',
  })

  const franjas = Array.from({ length: (HORA_FIN - HORA_INICIO) * 2 }, (_, i) => HORA_INICIO * 60 + i * 30)
  const atiende = (dia: number, minuto: number) =>
    horarios?.some((h: Horario) => h.dia_semana === dia && aMinutos(h.hora_desde) <= minuto && minuto + 30 <= aMinutos(h.hora_hasta))
  const hoy = fechaLocal(new Date())

  return (
    <>
      <EncabezadoPagina
        titulo="Agenda de profesionales"
        descripcion="Turnos de atención y de procesamiento en el laboratorio. No se permiten turnos superpuestos."
        acciones={profesional && <Boton icono={<Add size={16} />} onClick={() => setNuevo({ fecha: hoy, hora: '09:00' })}>Nuevo turno</Boton>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Profesional" className="w-72">
          <Seleccion value={profesionalId} onChange={(e) => setProfesionalId(Number(e.target.value))}>
            {profesionales?.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre_completo} · {p.clinica?.nombre ?? 'Laboratorio central'}</option>
            ))}
          </Seleccion>
        </Campo>
        <div className="flex items-center gap-1">
          <Boton variante="secundario" icono={<ChevronLeft size={16} />} aria-label="Semana anterior" onClick={() => setLunes(sumarDias(lunes, -7))} />
          <Boton variante="secundario" onClick={() => setLunes(inicioDeSemana(new Date()))}>Hoy</Boton>
          <Boton variante="secundario" icono={<ChevronRight size={16} />} aria-label="Semana siguiente" onClick={() => setLunes(sumarDias(lunes, 7))} />
        </div>
        <p className="text-sm font-medium text-slate-700">
          Semana del {lunes.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} al{' '}
          {sumarDias(lunes, 6).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid min-w-[860px] grid-cols-[56px_repeat(7,1fr)]">
          <div className="border-b border-slate-200" />
          {dias.map((d, i) => (
            <div key={i} className={`border-b border-l border-slate-200 px-2 py-2 text-center ${fechaLocal(d) === hoy ? 'bg-marca-50' : ''}`}>
              <p className="text-xs text-slate-500">{DIAS_SEMANA[i]}</p>
              <p className="text-sm font-semibold">{d.getDate()}</p>
            </div>
          ))}

          <div>
            {franjas.map((m) => (
              <div key={m} style={{ height: ALTO_MEDIA_HORA }} className="pr-2 text-right text-[11px] text-slate-400">
                {m % 60 === 0 ? `${m / 60}:00` : ''}
              </div>
            ))}
          </div>
          {dias.map((d, indiceDia) => {
            const turnosDia = turnos?.filter((t) => fechaLocal(new Date(t.inicio)) === fechaLocal(d)) ?? []
            return (
              <div key={indiceDia} className="relative border-l border-slate-200">
                {franjas.map((m) => {
                  const disponible = atiende(indiceDia, m)
                  const hora = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!disponible}
                      onClick={() => setNuevo({ fecha: fechaLocal(d), hora })}
                      style={{ height: ALTO_MEDIA_HORA }}
                      className={`block w-full border-t ${m % 60 === 0 ? 'border-slate-100' : 'border-dashed border-slate-100'} ${
                        disponible ? 'bg-white hover:bg-marca-50' : 'cursor-default bg-slate-50/80'
                      }`}
                      aria-label={disponible ? `Reservar ${DIAS_SEMANA[indiceDia]} ${hora}` : undefined}
                    />
                  )
                })}
                {turnosDia.map((t) => {
                  const inicio = minutosDelDia(t.inicio)
                  const duracion = minutosDelDia(t.fin) - inicio
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetalle(t)}
                      style={{
                        top: ((inicio - HORA_INICIO * 60) / 30) * ALTO_MEDIA_HORA + 1,
                        height: Math.max((duracion / 30) * ALTO_MEDIA_HORA - 2, 20),
                      }}
                      className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${
                        t.estado === 'ATENDIDO' ? 'bg-slate-200 text-slate-600' : t.tipo === 'PROCESAMIENTO' ? 'bg-indigo-600 text-white' : 'bg-marca-700 text-white'
                      }`}
                    >
                      <span className="font-semibold">{new Date(t.inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>{' '}
                      {t.mascota_nombre ?? t.muestra_codigo ?? t.motivo}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Las franjas grises están fuera del horario de atención del profesional. Hacé clic en una franja libre para reservar.</p>

      {nuevo && profesional && <FormularioTurno profesional={profesional} inicial={nuevo} alCerrar={() => setNuevo(null)} />}
      {detalle && <DetalleTurno turno={detalle} alCerrar={() => setDetalle(null)} />}
    </>
  )
}

const esquemaTurno = z.object({
  fecha: z.string().min(1, 'Elegí la fecha'),
  hora: z.string().min(1, 'Elegí la hora'),
  duracion: z.coerce.number<string | number>(),
  motivo: z.string().min(2, 'Indicá el motivo'),
  mascota_id: numeroOpcional,
  muestra_id: numeroOpcional,
})

function FormularioTurno({ profesional, inicial, alCerrar }: { profesional: Profesional; inicial: { fecha: string; hora: string }; alCerrar: () => void }) {
  const esLaboratorio = profesional.tipo === 'LABORATORISTA'
  const { data: mascotas } = useMascotas()
  const { data: recibidas } = useQuery({
    queryKey: ['muestras', 'RECIBIDA'],
    queryFn: () => laboratorioApi.muestras({ estado: 'RECIBIDA' }),
    enabled: esLaboratorio,
  })
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaTurno.refine((d) => esLaboratorio || d.mascota_id, { message: 'Elegí la mascota', path: ['mascota_id'] })),
    defaultValues: { fecha: inicial.fecha, hora: inicial.hora, duracion: 30, motivo: esLaboratorio ? 'Procesamiento de muestra' : '', mascota_id: '', muestra_id: '' },
  })
  const reservar = useMutacion(
    (d: z.output<typeof esquemaTurno>) => {
      const inicio = aISOlocal(d.fecha, d.hora)
      const fin = new Date(new Date(inicio).getTime() + d.duracion * 60_000)
      return gestionApi.reservarTurno({
        profesional_id: profesional.id,
        inicio,
        fin: `${fechaLocal(fin)}T${fin.toTimeString().slice(0, 5)}:00`,
        tipo: esLaboratorio ? 'PROCESAMIENTO' : 'ATENCION',
        motivo: d.motivo,
        mascota_id: esLaboratorio ? null : d.mascota_id,
        muestra_id: esLaboratorio ? d.muestra_id : null,
      })
    },
    { exito: 'Turno reservado', invalidar: ['turnos', 'tablero'], alTerminar: alCerrar },
  )
  const e = formState.errors
  return (
    <Modal
      abierto
      titulo={`Nuevo turno · ${profesional.nombre_completo}`}
      alCerrar={alCerrar}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-turno" cargando={reservar.isPending}>Reservar</Boton></>}
    >
      <form id="form-turno" onSubmit={handleSubmit((d) => reservar.mutate(d))} className="grid gap-4 sm:grid-cols-3" noValidate>
        <Campo etiqueta="Fecha" error={e.fecha?.message}><Entrada type="date" {...register('fecha')} /></Campo>
        <Campo etiqueta="Hora" error={e.hora?.message}><Entrada type="time" step={900} {...register('hora')} /></Campo>
        <Campo etiqueta="Duración">
          <Seleccion {...register('duracion')}>
            {[15, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
          </Seleccion>
        </Campo>
        {esLaboratorio ? (
          <Campo etiqueta="Muestra a procesar (opcional)" className="sm:col-span-3">
            <Seleccion {...register('muestra_id')}>
              <option value="">Sin muestra asociada</option>
              {recibidas?.map((m) => <option key={m.id} value={m.id}>{m.codigo} · {m.nombre_analisis} · {m.mascota}</option>)}
            </Seleccion>
          </Campo>
        ) : (
          <Campo etiqueta="Mascota" error={e.mascota_id?.message} className="sm:col-span-3">
            <Seleccion {...register('mascota_id')}>
              <option value="">Seleccioná…</option>
              {mascotas?.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.especie.nombre}) · {m.responsable.nombre_completo}</option>)}
            </Seleccion>
          </Campo>
        )}
        <Campo etiqueta="Motivo" error={e.motivo?.message} className="sm:col-span-3"><Entrada {...register('motivo')} /></Campo>
      </form>
    </Modal>
  )
}

function DetalleTurno({ turno, alCerrar }: { turno: Turno; alCerrar: () => void }) {
  const cancelar = useMutacion(() => gestionApi.cancelarTurno(turno.id), { exito: 'Turno cancelado', invalidar: ['turnos', 'tablero'], alTerminar: alCerrar })
  return (
    <Modal
      abierto
      titulo="Detalle del turno"
      alCerrar={alCerrar}
      pie={
        turno.estado === 'RESERVADO' && (
          <Boton variante="peligro" cargando={cancelar.isPending} onClick={() => cancelar.mutate(undefined)}>Cancelar turno</Boton>
        )
      }
    >
      <dl className="grid grid-cols-2 gap-4">
        <Dato etiqueta="Profesional">{turno.profesional.nombre_completo}</Dato>
        <Dato etiqueta="Estado"><Insignia color={turno.estado === 'RESERVADO' ? 'marca' : 'gris'}>{turno.estado}</Insignia></Dato>
        <Dato etiqueta="Inicio">{fechaHora(turno.inicio)}</Dato>
        <Dato etiqueta="Fin">{fechaHora(turno.fin)}</Dato>
        <Dato etiqueta="Tipo">{turno.tipo === 'ATENCION' ? 'Atención clínica' : 'Procesamiento en laboratorio'}</Dato>
        <Dato etiqueta={turno.tipo === 'ATENCION' ? 'Mascota' : 'Muestra'}>{turno.mascota_nombre ?? turno.muestra_codigo}</Dato>
        <Dato etiqueta="Motivo">{turno.motivo}</Dato>
      </dl>
    </Modal>
  )
}
