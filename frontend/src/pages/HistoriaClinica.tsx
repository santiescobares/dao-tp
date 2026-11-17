import { Add, ArrowLeft, Edit, Receipt, WarningAlt } from '@carbon/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { clinicoApi, gestionApi } from '../api/servicios'
import type { Atencion, Mascota } from '../api/tipos'
import { FormularioMascota } from '../components/formularios/FormularioMascota'
import { Boton } from '../components/ui/Boton'
import { AreaTexto, Campo } from '../components/ui/Campos'
import { EstadoMuestraInsignia, Insignia, TipoAtencionInsignia } from '../components/ui/Insignias'
import { Modal } from '../components/ui/Modal'
import { Cargando, Dato, EncabezadoPagina, Tarjeta, Vacio } from '../components/ui/Pagina'
import { useMutacion } from '../hooks/useMutacion'
import { useAuth } from '../stores/auth'
import { edad, fecha, fechaHora } from '../utils/formato'

export default function HistoriaClinica() {
  const id = Number(useParams().id)
  const navegar = useNavigate()
  const puedeEditar = useAuth((s) => s.tieneRol('ADMIN', 'VETERINARIO'))
  const [editandoMascota, setEditandoMascota] = useState(false)
  const [editandoHistoria, setEditandoHistoria] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['historia', id], queryFn: () => clinicoApi.historia(id) })

  if (isLoading || !data) return <Cargando />
  const { mascota, atenciones, vacunas_aplicadas, vacunas_pendientes } = data

  return (
    <>
      <Link to="/mascotas" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Mascotas
      </Link>
      <EncabezadoPagina
        titulo={mascota.nombre}
        descripcion={`Historia clínica ${mascota.historia.numero} · abierta el ${fecha(mascota.historia.fecha_apertura)}`}
        acciones={
          puedeEditar && (
            <>
              <Boton variante="secundario" icono={<Edit size={16} />} onClick={() => setEditandoMascota(true)}>Editar datos</Boton>
              <Boton icono={<Add size={16} />} onClick={() => navegar(`/atenciones/nueva?mascota=${mascota.id}`)}>Nueva atención</Boton>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Tarjeta titulo="Ficha">
            <dl className="grid grid-cols-2 gap-4">
              <Dato etiqueta="Especie">{mascota.especie.nombre}</Dato>
              <Dato etiqueta="Raza">{mascota.raza}</Dato>
              <Dato etiqueta="Sexo">{mascota.sexo === 'MACHO' ? 'Macho' : 'Hembra'}</Dato>
              <Dato etiqueta="Edad">{edad(mascota.fecha_nacimiento)}</Dato>
              <Dato etiqueta="Peso">{mascota.peso_kg ? `${mascota.peso_kg} kg` : null}</Dato>
              <Dato etiqueta="Estado">{mascota.activa ? 'Activa' : 'Inactiva'}</Dato>
            </dl>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <Dato etiqueta="Responsable">
                <Link to={`/mascotas?cliente=${mascota.cliente_id}`} className="font-medium text-marca-700 hover:underline">
                  {mascota.responsable.nombre_completo}
                </Link>
                <span className="block text-xs text-slate-500">
                  DNI {mascota.responsable.dni} · {mascota.responsable.telefono}
                </span>
              </Dato>
            </div>
          </Tarjeta>

          <Tarjeta
            titulo="Antecedentes"
            acciones={puedeEditar && <Boton variante="fantasma" chico icono={<Edit size={14} />} onClick={() => setEditandoHistoria(true)}>Editar</Boton>}
          >
            <dl className="space-y-3">
              <Dato etiqueta="Alergias">{mascota.historia.alergias || 'Sin alergias registradas'}</Dato>
              <Dato etiqueta="Observaciones">{mascota.historia.observaciones || '—'}</Dato>
            </dl>
          </Tarjeta>

          <Tarjeta titulo="Vacunación">
            {vacunas_pendientes.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <WarningAlt size={16} /> Esquema obligatorio incompleto
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-amber-800">
                  {vacunas_pendientes.map((v) => (
                    <li key={v.vacuna_id}>
                      {v.nombre}: {v.situacion === 'NUNCA_APLICADA' ? 'nunca aplicada' : `refuerzo vencido el ${fecha(v.vencimiento)}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {vacunas_aplicadas.length === 0 ? (
              <p className="text-sm text-slate-500">Sin vacunas registradas.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {[...vacunas_aplicadas].reverse().map((v) => (
                  <li key={v.id} className="flex justify-between py-1.5">
                    <span>{v.nombre_vacuna}</span>
                    <span className="text-slate-500">{fecha(v.fecha)}{v.lote && ` · ${v.lote}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Atenciones ({atenciones.length})</h2>
          {atenciones.length === 0 ? (
            <Vacio>Todavía no hay atenciones registradas.</Vacio>
          ) : (
            <ol className="space-y-4">
              {atenciones.map((a) => <TarjetaAtencion key={a.id} atencion={a} puedeFacturar={puedeEditar} />)}
            </ol>
          )}
        </div>
      </div>

      {editandoMascota && <FormularioMascota mascota={mascota} alCerrar={() => setEditandoMascota(false)} />}
      {editandoHistoria && <EditarAntecedentes mascota={mascota} alCerrar={() => setEditandoHistoria(false)} />}
    </>
  )
}

function TarjetaAtencion({ atencion: a, puedeFacturar }: { atencion: Atencion; puedeFacturar: boolean }) {
  const navegar = useNavigate()
  const emitir = useMutacion(gestionApi.emitirComprobante, {
    exito: (c) => `Comprobante ${c.numero} emitido`,
    invalidar: ['historia', 'comprobantes', 'atenciones'],
    alTerminar: (c) => navegar(`/comprobantes/${c.id}`),
  })

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TipoAtencionInsignia tipo={a.tipo} />
            <span className="text-sm font-medium">{fechaHora(a.fecha)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {a.clinica.nombre} · {a.profesional.nombre_completo} ({a.profesional.matricula})
          </p>
        </div>
        {a.comprobante_id ? (
          <Link to={`/comprobantes/${a.comprobante_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-marca-700 hover:underline">
            <Receipt size={14} /> Ver comprobante
          </Link>
        ) : (
          puedeFacturar && (
            <Boton variante="secundario" chico icono={<Receipt size={14} />} cargando={emitir.isPending} onClick={() => emitir.mutate(a.id)}>
              Emitir comprobante
            </Boton>
          )
        )}
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Dato etiqueta="Motivo">{a.motivo}</Dato>
        <Dato etiqueta="Diagnóstico">{a.diagnostico}</Dato>
        {a.observaciones && <Dato etiqueta="Observaciones">{a.observaciones}</Dato>}
        {a.peso_kg && <Dato etiqueta="Peso registrado">{a.peso_kg} kg</Dato>}
      </dl>

      {a.tratamientos.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500">Tratamientos</p>
          <ul className="mt-1 space-y-1 text-sm">
            {a.tratamientos.map((t) => (
              <li key={t.id}>
                <span className="font-medium">{t.descripcion}</span>
                {t.medicamento && ` · ${t.medicamento}`}
                {t.dosis && ` · ${t.dosis}`}
                {t.duracion_dias && ` · ${t.duracion_dias} días`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.vacunas_aplicadas.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Vacunas aplicadas:</span>
          {a.vacunas_aplicadas.map((v) => <Insignia key={v.id} color="marca">{v.nombre_vacuna}</Insignia>)}
        </div>
      )}

      {a.ordenes.map((orden) => (
        <div key={orden.id} className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-600">
            Orden de derivación {orden.numero} {orden.urgente && <Insignia color="rojo">Urgente</Insignia>}
          </p>
          <ul className="mt-2 space-y-1.5">
            {orden.muestras.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link to={`/muestras/${m.id}`} className="font-mono text-xs text-marca-700 hover:underline">{m.codigo}</Link>
                <span className="flex-1">{m.nombre_analisis}</span>
                <EstadoMuestraInsignia estado={m.estado} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </li>
  )
}

function EditarAntecedentes({ mascota, alCerrar }: { mascota: Mascota; alCerrar: () => void }) {
  const [alergias, setAlergias] = useState(mascota.historia.alergias ?? '')
  const [observaciones, setObservaciones] = useState(mascota.historia.observaciones ?? '')
  const guardar = useMutacion(
    () => clinicoApi.editarHistoria(mascota.id, { alergias: alergias || null, observaciones: observaciones || null }),
    { exito: 'Antecedentes actualizados', invalidar: ['historia'], alTerminar: alCerrar },
  )
  return (
    <Modal
      abierto
      titulo="Antecedentes de la historia clínica"
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
          <Boton cargando={guardar.isPending} onClick={() => guardar.mutate(undefined)}>Guardar</Boton>
        </>
      }
    >
      <div className="space-y-4">
        <Campo etiqueta="Alergias"><AreaTexto value={alergias} onChange={(e) => setAlergias(e.target.value)} /></Campo>
        <Campo etiqueta="Observaciones generales"><AreaTexto value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}
