import { Search } from '@carbon/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { laboratorioApi } from '../api/servicios'
import type { EstadoMuestra } from '../api/tipos'
import { Campo, Entrada, Seleccion } from '../components/ui/Campos'
import { EstadoMuestraInsignia, Insignia } from '../components/ui/Insignias'
import { EncabezadoPagina } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useClinicas } from '../hooks/useCatalogos'
import { useAuth } from '../stores/auth'
import { ETIQUETA_ESTADO_MUESTRA, ETIQUETA_MOTIVO, fechaHora } from '../utils/formato'

export default function Muestras() {
  const [parametros, setParametros] = useSearchParams()
  const estado = parametros.get('estado') ?? ''
  const [busqueda, setBusqueda] = useState('')
  const [clinicaId, setClinicaId] = useState<number | ''>('')
  const navegar = useNavigate()
  const esVeterinario = useAuth((s) => s.tieneRol('VETERINARIO'))
  const { data: clinicas } = useClinicas()
  const { data, isLoading } = useQuery({
    queryKey: ['muestras', estado, clinicaId, busqueda],
    queryFn: () => laboratorioApi.muestras({ estado, clinica_id: clinicaId, q: busqueda }),
  })

  return (
    <>
      <EncabezadoPagina titulo="Muestras biológicas" descripcion="Seguimiento de cada muestra derivada al laboratorio central" />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Estado">
          <Seleccion value={estado} onChange={(e) => setParametros(e.target.value ? { estado: e.target.value } : {})}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETA_ESTADO_MUESTRA) as EstadoMuestra[]).map((e) => (
              <option key={e} value={e}>{ETIQUETA_ESTADO_MUESTRA[e]}</option>
            ))}
          </Seleccion>
        </Campo>
        {!esVeterinario && (
          <Campo etiqueta="Clínica">
            <Seleccion value={clinicaId} onChange={(e) => setClinicaId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Todas</option>
              {clinicas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
        <Campo etiqueta="Código">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
            <Entrada className="pl-9" placeholder="OD-000012-01" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </Campo>
      </div>
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(m) => m.id}
        alHacerClic={(m) => navegar(`/muestras/${m.id}`)}
        columnas={[
          {
            titulo: 'Código',
            celda: (m) => (
              <span className="font-mono text-xs">
                {m.codigo} {m.urgente && !m.es_final && <Insignia color="rojo">Urgente</Insignia>}
              </span>
            ),
          },
          { titulo: 'Análisis', celda: (m) => m.nombre_analisis },
          { titulo: 'Mascota', celda: (m) => `${m.mascota} (${m.especie})` },
          { titulo: 'Clínica', celda: (m) => m.clinica },
          { titulo: 'Extracción', celda: (m) => fechaHora(m.fecha_extraccion) },
          { titulo: 'Remito', celda: (m) => m.remito_numero ?? '—' },
          {
            titulo: 'Estado',
            celda: (m) => (
              <div>
                <EstadoMuestraInsignia estado={m.estado} />
                {m.motivo_rechazo && <p className="mt-0.5 text-xs text-rose-600">{ETIQUETA_MOTIVO[m.motivo_rechazo]}</p>}
              </div>
            ),
          },
        ]}
      />
    </>
  )
}
