import { Add, Chemistry, TrashCan, WarningAlt } from '@carbon/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { clinicoApi, gestionApi } from '../api/servicios'
import { Boton } from '../components/ui/Boton'
import { AreaTexto, Campo, Casilla, Entrada, Seleccion } from '../components/ui/Campos'
import { EncabezadoPagina, Tarjeta } from '../components/ui/Pagina'
import { useInsumos, useMascotas, useProfesionales, useTiposAnalisis } from '../hooks/useCatalogos'
import { useMutacion } from '../hooks/useMutacion'
import { useAuth } from '../stores/auth'
import { fecha, fechaHora, hoyISO, moneda, temperatura } from '../utils/formato'
import { idRequerido, numeroOpcional, textoOpcional } from '../utils/esquemas'

const esquema = z.object({
  mascota_id: idRequerido('Seleccioná la mascota'),
  profesional_id: numeroOpcional,
  tipo: z.enum(['CONSULTA', 'CONTROL', 'URGENCIA']),
  motivo: z.string().min(3, 'Describí el motivo de la atención'),
  diagnostico: textoOpcional,
  observaciones: textoOpcional,
  peso_kg: numeroOpcional,
  turno_id: numeroOpcional,
  tratamientos: z.array(
    z.object({
      descripcion: z.string().min(2, 'Describí el tratamiento'),
      medicamento: textoOpcional,
      dosis: textoOpcional,
      duracion_dias: numeroOpcional,
    }),
  ),
  vacunas: z.array(z.number()),
  insumos: z.array(z.object({ insumo_id: idRequerido('Elegí el insumo'), cantidad: z.coerce.number<string | number>().positive('Cantidad inválida') })),
  analisis: z.array(z.number()),
  derivacion_urgente: z.boolean(),
  observaciones_derivacion: textoOpcional,
})

export default function NuevaAtencion() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const usuario = useAuth((s) => s.usuario)!
  const esAdmin = usuario.rol === 'ADMIN'

  const { data: mascotas } = useMascotas()
  const { data: veterinarios } = useProfesionales('VETERINARIO')
  const { data: tiposAnalisis } = useTiposAnalisis(true)

  const { register, control, handleSubmit, setValue, formState } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      mascota_id: parametros.get('mascota') ?? '',
      profesional_id: '',
      tipo: 'CONSULTA',
      motivo: '',
      tratamientos: [],
      vacunas: [],
      insumos: [],
      analisis: [],
      derivacion_urgente: false,
    },
  })
  const tratamientos = useFieldArray({ control, name: 'tratamientos' })
  const insumos = useFieldArray({ control, name: 'insumos' })
  const [mascotaId, profesionalId, vacunasMarcadas, analisisMarcados, tipo] = useWatch({
    control,
    name: ['mascota_id', 'profesional_id', 'vacunas', 'analisis', 'tipo'],
  })
  const idMascota = Number(mascotaId) || undefined
  const mascota = mascotas?.find((m) => m.id === idMascota)

  // Clínica en la que se atiende: la del veterinario logueado o la del elegido por el admin
  const clinicaId = esAdmin ? veterinarios?.find((v) => v.id === Number(profesionalId))?.clinica_id : usuario.clinica_id
  const { data: insumosClinica } = useInsumos(clinicaId ?? '')
  const profesionalTurnos = esAdmin ? Number(profesionalId) || undefined : (usuario.profesional_id ?? undefined)

  const { data: pendientes } = useQuery({
    queryKey: ['vacunas-pendientes', idMascota],
    queryFn: () => clinicoApi.vacunasPendientes(idMascota!),
    enabled: !!idMascota,
  })
  const { data: turnos } = useQuery({
    queryKey: ['turnos-dia', profesionalTurnos],
    queryFn: () => gestionApi.turnos({ profesional_id: profesionalTurnos, desde: `${hoyISO()}T00:00`, hasta: `${hoyISO(1)}T00:00` }),
    enabled: !!profesionalTurnos,
  })
  const turnosMascota = turnos?.filter((t) => t.mascota_id === idMascota && t.estado === 'RESERVADO') ?? []

  // Si la mascota tiene un turno hoy, se propone vincularlo
  useEffect(() => {
    setValue('turno_id', turnosMascota[0]?.id ?? '')
    setValue('vacunas', [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idMascota, turnos])

  const registrar = useMutacion(clinicoApi.registrarAtencion, {
    invalidar: ['historia', 'atenciones', 'muestras', 'tablero', 'insumos', 'turnos'],
    alTerminar: ({ atencion, advertencias }) => {
      toast.success('Atención registrada en la historia clínica')
      const muestras = atencion.ordenes.flatMap((o) => o.muestras)
      if (muestras.length) toast.info(`Orden ${atencion.ordenes[0].numero} emitida con ${muestras.length} muestra(s) extraída(s)`)
      advertencias.forEach((a) => toast.warning(a, { duration: 8000 }))
      navegar(`/mascotas/${atencion.mascota.id}`)
    },
  })

  const alternar = (campo: 'vacunas' | 'analisis', lista: number[], id: number) =>
    setValue(campo, lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id])

  const enviar = handleSubmit((d) =>
    registrar.mutate({
      ...d,
      profesional_id: esAdmin ? d.profesional_id : null,
      vacunas: d.vacunas.map((vacuna_id) => ({ vacuna_id })),
    }),
  )
  const errores = formState.errors

  return (
    <form onSubmit={enviar} noValidate>
      <EncabezadoPagina
        titulo="Nueva atención"
        descripcion="Se registra en la historia clínica de la mascota. Si se solicitan análisis, se emite la orden de derivación."
        acciones={
          <>
            <Boton variante="secundario" onClick={() => navegar(-1)}>Cancelar</Boton>
            <Boton type="submit" cargando={registrar.isPending}>Registrar atención</Boton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tarjeta titulo="Paciente y atención">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Mascota" error={errores.mascota_id?.message} className="sm:col-span-2">
                <Seleccion {...register('mascota_id')}>
                  <option value="">Seleccioná la mascota…</option>
                  {mascotas?.filter((m) => m.activa).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.especie.nombre}) · {m.responsable.nombre_completo}
                    </option>
                  ))}
                </Seleccion>
              </Campo>
              {esAdmin && (
                <Campo etiqueta="Veterinario/a" error={errores.profesional_id?.message} className="sm:col-span-2">
                  <Seleccion {...register('profesional_id')}>
                    <option value="">Seleccioná quién atendió…</option>
                    {veterinarios?.map((v) => (
                      <option key={v.id} value={v.id}>{v.nombre_completo} · {v.clinica?.nombre}</option>
                    ))}
                  </Seleccion>
                </Campo>
              )}
              <Campo etiqueta="Tipo de atención">
                <Seleccion {...register('tipo')}>
                  <option value="CONSULTA">Consulta</option>
                  <option value="CONTROL">Control</option>
                  <option value="URGENCIA">Urgencia</option>
                </Seleccion>
              </Campo>
              <Campo etiqueta="Peso actual (kg)" error={errores.peso_kg?.message}>
                <Entrada type="number" step="0.1" min="0" placeholder={mascota?.peso_kg?.toString()} {...register('peso_kg')} />
              </Campo>
              {turnosMascota.length > 0 && (
                <Campo etiqueta="Turno de hoy" className="sm:col-span-2">
                  <Seleccion {...register('turno_id')}>
                    <option value="">Sin turno (atención espontánea)</option>
                    {turnosMascota.map((t) => <option key={t.id} value={t.id}>{fechaHora(t.inicio)} · {t.motivo}</option>)}
                  </Seleccion>
                </Campo>
              )}
              <Campo etiqueta="Motivo de consulta" error={errores.motivo?.message} className="sm:col-span-2">
                <Entrada {...register('motivo')} />
              </Campo>
              <Campo etiqueta="Diagnóstico" className="sm:col-span-2"><AreaTexto rows={2} {...register('diagnostico')} /></Campo>
              <Campo etiqueta="Observaciones" className="sm:col-span-2"><AreaTexto rows={2} {...register('observaciones')} /></Campo>
            </div>
          </Tarjeta>

          <Tarjeta
            titulo="Tratamientos indicados"
            acciones={
              <Boton variante="secundario" chico icono={<Add size={14} />} onClick={() => tratamientos.append({ descripcion: '', medicamento: '', dosis: '', duracion_dias: '' })}>
                Agregar
              </Boton>
            }
          >
            {tratamientos.fields.length === 0 && <p className="text-sm text-slate-500">Sin tratamientos.</p>}
            <div className="space-y-3">
              {tratamientos.fields.map((campo, i) => (
                <div key={campo.id} className="grid items-start gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[2fr_2fr_1.5fr_1fr_auto]">
                  <Campo error={errores.tratamientos?.[i]?.descripcion?.message}>
                    <Entrada placeholder="Descripción" {...register(`tratamientos.${i}.descripcion`)} />
                  </Campo>
                  <Entrada placeholder="Medicamento" {...register(`tratamientos.${i}.medicamento`)} />
                  <Entrada placeholder="Dosis" {...register(`tratamientos.${i}.dosis`)} />
                  <Entrada type="number" min="1" placeholder="Días" {...register(`tratamientos.${i}.duracion_dias`)} />
                  <Boton variante="fantasma" icono={<TrashCan size={16} />} onClick={() => tratamientos.remove(i)} aria-label="Quitar" />
                </div>
              ))}
            </div>
          </Tarjeta>

          <Tarjeta
            titulo="Insumos utilizados"
            acciones={
              <Boton variante="secundario" chico icono={<Add size={14} />} disabled={!clinicaId} onClick={() => insumos.append({ insumo_id: '', cantidad: 1 })}>
                Agregar
              </Boton>
            }
          >
            {insumos.fields.length === 0 && <p className="text-sm text-slate-500">Se descuentan del stock de la clínica al registrar la atención.</p>}
            <div className="space-y-2">
              {insumos.fields.map((campo, i) => (
                <div key={campo.id} className="grid items-start gap-2 sm:grid-cols-[3fr_1fr_auto]">
                  <Campo error={errores.insumos?.[i]?.insumo_id?.message}>
                    <Seleccion {...register(`insumos.${i}.insumo_id`)}>
                      <option value="">Insumo…</option>
                      {insumosClinica?.map((ins) => (
                        <option key={ins.id} value={ins.id}>{ins.nombre} (stock {ins.stock_actual} {ins.unidad})</option>
                      ))}
                    </Seleccion>
                  </Campo>
                  <Entrada type="number" min="1" step="any" {...register(`insumos.${i}.cantidad`)} />
                  <Boton variante="fantasma" icono={<TrashCan size={16} />} onClick={() => insumos.remove(i)} aria-label="Quitar" />
                </div>
              ))}
            </div>
          </Tarjeta>
        </div>

        <div className="space-y-6">
          <Tarjeta titulo="Esquema de vacunación">
            {!idMascota ? (
              <p className="text-sm text-slate-500">Elegí una mascota para controlar sus vacunas obligatorias.</p>
            ) : pendientes?.length === 0 ? (
              <p className="text-sm text-emerald-700">Vacunas obligatorias al día.</p>
            ) : (
              <>
                <p className="mb-3 flex items-start gap-2 text-sm text-amber-800">
                  <WarningAlt size={16} className="mt-0.5 shrink-0" />
                  Tiene vacunas obligatorias pendientes. Podés aplicarlas en esta atención.
                </p>
                <div className="space-y-2">
                  {pendientes?.map((p) => (
                    <Casilla
                      key={p.vacuna_id}
                      checked={vacunasMarcadas.includes(p.vacuna_id)}
                      onChange={() => alternar('vacunas', vacunasMarcadas, p.vacuna_id)}
                      etiqueta={
                        <span>
                          Aplicar <strong>{p.nombre}</strong>
                          <span className="block text-xs text-slate-500">
                            {p.situacion === 'NUNCA_APLICADA' ? 'Nunca aplicada' : `Refuerzo vencido el ${fecha(p.vencimiento)}`}
                          </span>
                        </span>
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </Tarjeta>

          <Tarjeta titulo={<span className="flex items-center gap-2"><Chemistry size={16} /> Derivación al laboratorio</span>}>
            <div className="space-y-2">
              {tiposAnalisis?.map((t) => (
                <Casilla
                  key={t.id}
                  checked={analisisMarcados.includes(t.id)}
                  onChange={() => alternar('analisis', analisisMarcados, t.id)}
                  etiqueta={
                    <span>
                      {t.nombre}
                      <span className="block text-xs text-slate-500">
                        {moneda(t.precio)} · {temperatura(t.temperatura_min)} a {temperatura(t.temperatura_max)} · {t.horas_viabilidad} h
                      </span>
                    </span>
                  }
                />
              ))}
            </div>
            {analisisMarcados.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <Casilla etiqueta="Derivación urgente" {...register('derivacion_urgente')} />
                {tipo === 'URGENCIA' && <p className="text-xs text-slate-500">Sugerencia: las urgencias suelen derivarse con prioridad.</p>}
                <Campo etiqueta="Indicaciones para el laboratorio"><AreaTexto rows={2} {...register('observaciones_derivacion')} /></Campo>
                <p className="text-xs text-slate-500">
                  Se emitirá una orden con {analisisMarcados.length} muestra(s) en estado <strong>Extraída</strong>.
                </p>
              </div>
            )}
          </Tarjeta>
        </div>
      </div>
    </form>
  )
}
