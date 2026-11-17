import { Box, Information } from '@carbon/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gestionApi, laboratorioApi } from '../api/servicios'
import type { Conservadora, Muestra } from '../api/tipos'
import { Boton } from '../components/ui/Boton'
import { AreaTexto, Campo, Seleccion } from '../components/ui/Campos'
import { Insignia } from '../components/ui/Insignias'
import { EncabezadoPagina, Tarjeta, Vacio } from '../components/ui/Pagina'
import { useClinicas } from '../hooks/useCatalogos'
import { useMutacion } from '../hooks/useMutacion'
import { useAuth } from '../stores/auth'
import { fechaHora, temperatura } from '../utils/formato'

/** La conservadora tiene que mantener el rango de temperatura que exige cada análisis. */
const compatible = (c: Conservadora, m: Muestra) => m.temperatura_min <= c.temperatura_min && c.temperatura_max <= m.temperatura_max

export default function Empaquetado() {
  const usuario = useAuth((s) => s.usuario)!
  const navegar = useNavigate()
  const { data: clinicas } = useClinicas()
  const [clinicaId, setClinicaId] = useState<number | ''>(usuario.clinica_id ?? '')
  const [seleccion, setSeleccion] = useState<number[]>([])
  const [conservadoraId, setConservadoraId] = useState<number | ''>('')
  const [observaciones, setObservaciones] = useState('')

  const { data: muestras, isLoading } = useQuery({
    queryKey: ['muestras', 'EXTRAIDA', clinicaId],
    queryFn: () => laboratorioApi.muestras({ estado: 'EXTRAIDA', clinica_id: clinicaId }),
    enabled: clinicaId !== '',
  })
  const { data: conservadoras } = useQuery({
    queryKey: ['conservadoras', clinicaId, 'DISPONIBLE'],
    queryFn: () => gestionApi.conservadoras({ clinica_id: clinicaId, estado: 'DISPONIBLE' }),
    enabled: clinicaId !== '',
  })

  const elegidas = useMemo(() => muestras?.filter((m) => seleccion.includes(m.id)) ?? [], [muestras, seleccion])
  const conservadora = conservadoras?.find((c) => c.id === conservadoraId)
  const problemas = conservadora
    ? [
        ...(elegidas.length > conservadora.capacidad ? [`La conservadora admite hasta ${conservadora.capacidad} muestras.`] : []),
        ...elegidas.filter((m) => !compatible(conservadora, m)).map((m) => `${m.codigo} requiere ${temperatura(m.temperatura_min)} a ${temperatura(m.temperatura_max)}.`),
      ]
    : []

  const empaquetar = useMutacion(laboratorioApi.empaquetar, {
    exito: (r) => `Remito ${r.numero} generado con precinto ${r.precinto.codigo}`,
    invalidar: ['muestras', 'conservadoras', 'remitos', 'tablero'],
    alTerminar: (r) => navegar(`/remitos/${r.id}`),
  })

  const alternar = (id: number) => setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <>
      <EncabezadoPagina
        titulo="Empaquetado de muestras"
        descripcion="Elegí las muestras extraídas y la conservadora isotérmica. Se genera el remito biológico y el precinto sanitario."
      />
      {usuario.rol === 'ADMIN' && (
        <div className="mb-4 max-w-xs">
          <Campo etiqueta="Clínica">
            <Seleccion value={clinicaId} onChange={(e) => { setClinicaId(e.target.value ? Number(e.target.value) : ''); setSeleccion([]); setConservadoraId('') }}>
              <option value="">Seleccioná la clínica…</option>
              {clinicas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          </Campo>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta titulo={`Muestras extraídas pendientes (${muestras?.length ?? 0})`} className="lg:col-span-2">
          {clinicaId === '' ? (
            <Vacio>Seleccioná una clínica.</Vacio>
          ) : isLoading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : muestras?.length === 0 ? (
            <Vacio>No hay muestras extraídas esperando empaquetado.</Vacio>
          ) : (
            <ul className="divide-y divide-slate-100">
              {muestras?.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input type="checkbox" className="size-4 accent-marca-700" checked={seleccion.includes(m.id)} onChange={() => alternar(m.id)} />
                    <div className="flex-1 text-sm">
                      <p>
                        <span className="font-mono text-xs">{m.codigo}</span> · <span className="font-medium">{m.nombre_analisis}</span>
                        {m.urgente && <span className="ml-2"><Insignia color="rojo">Urgente</Insignia></span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {m.mascota} ({m.especie}) · extraída {fechaHora(m.fecha_extraccion)} · viable {m.horas_viabilidad} h
                      </p>
                    </div>
                    <span className="text-xs whitespace-nowrap text-slate-500">
                      {temperatura(m.temperatura_min)} a {temperatura(m.temperatura_max)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta titulo="Conservadora y remito">
          <div className="space-y-4">
            <Campo etiqueta="Conservadora disponible">
              <Seleccion value={conservadoraId} onChange={(e) => setConservadoraId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Seleccioná…</option>
                {conservadoras?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} · {temperatura(c.temperatura_min)} a {temperatura(c.temperatura_max)} · cap. {c.capacidad}
                  </option>
                ))}
              </Seleccion>
            </Campo>
            <Campo etiqueta="Observaciones"><AreaTexto rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} /></Campo>
            <p className="text-sm text-slate-600">{elegidas.length} muestra(s) seleccionada(s)</p>
            {problemas.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {problemas.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
            <Boton
              className="w-full"
              icono={<Box size={16} />}
              disabled={!conservadora || elegidas.length === 0 || problemas.length > 0}
              cargando={empaquetar.isPending}
              onClick={() => empaquetar.mutate({ conservadora_id: Number(conservadoraId), muestra_ids: seleccion, observaciones: observaciones || null })}
            >
              Empaquetar y generar remito
            </Boton>
            <p className="flex gap-2 text-xs text-slate-500">
              <Information size={14} className="mt-0.5 shrink-0" />
              Las muestras pasan a “Empaquetada” y la conservadora queda “En uso” hasta la recepción en el laboratorio.
            </p>
          </div>
        </Tarjeta>
      </div>
    </>
  )
}
