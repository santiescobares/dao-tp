import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gestionApi } from '../api/servicios'
import { Campo, Entrada, Seleccion } from '../components/ui/Campos'
import { TipoAtencionInsignia } from '../components/ui/Insignias'
import { EncabezadoPagina, Kpi } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useClinicas } from '../hooks/useCatalogos'
import { useAuth } from '../stores/auth'
import { fechaHora, hoyISO, moneda } from '../utils/formato'

export default function Comprobantes() {
  const navegar = useNavigate()
  const esAdmin = useAuth((s) => s.tieneRol('ADMIN'))
  const { data: clinicas } = useClinicas()
  const [filtro, setFiltro] = useState({ desde: hoyISO(-30), hasta: hoyISO(), clinica_id: '' as number | '' })
  const { data, isLoading } = useQuery({ queryKey: ['comprobantes', filtro], queryFn: () => gestionApi.comprobantes(filtro) })
  const total = data?.reduce((suma, c) => suma + c.total, 0) ?? 0

  return (
    <>
      <EncabezadoPagina titulo="Comprobantes de atención" descripcion="Se emiten desde la historia clínica de cada atención" />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Desde"><Entrada type="date" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} /></Campo>
        <Campo etiqueta="Hasta"><Entrada type="date" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} /></Campo>
        {esAdmin && (
          <Campo etiqueta="Clínica">
            <Seleccion value={filtro.clinica_id} onChange={(e) => setFiltro({ ...filtro, clinica_id: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">Todas</option>
              {clinicas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
        <div className="ml-auto grid grid-cols-2 gap-3">
          <Kpi etiqueta="Comprobantes" valor={data?.length ?? '—'} />
          <Kpi etiqueta="Total del período" valor={moneda(total)} />
        </div>
      </div>
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(c) => c.id}
        alHacerClic={(c) => navegar(`/comprobantes/${c.id}`)}
        columnas={[
          { titulo: 'Número', celda: (c) => <span className="font-mono text-xs">{c.numero}</span> },
          { titulo: 'Fecha', celda: (c) => fechaHora(c.fecha) },
          { titulo: 'Clínica', celda: (c) => c.clinica.nombre },
          { titulo: 'Atención', celda: (c) => <TipoAtencionInsignia tipo={c.tipo_atencion} /> },
          { titulo: 'Mascota', celda: (c) => c.mascota },
          { titulo: 'Responsable', celda: (c) => c.responsable },
          { titulo: 'Total', celda: (c) => <span className="font-medium tabular-nums">{moneda(c.total)}</span>, className: 'text-right' },
        ]}
      />
    </>
  )
}
