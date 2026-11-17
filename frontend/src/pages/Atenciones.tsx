import { Add } from '@carbon/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clinicoApi } from '../api/servicios'
import { Boton } from '../components/ui/Boton'
import { Campo, Entrada, Seleccion } from '../components/ui/Campos'
import { Insignia, TipoAtencionInsignia } from '../components/ui/Insignias'
import { EncabezadoPagina } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useClinicas } from '../hooks/useCatalogos'
import { useAuth } from '../stores/auth'
import { fechaHora, hoyISO } from '../utils/formato'

export default function Atenciones() {
  const navegar = useNavigate()
  const esAdmin = useAuth((s) => s.tieneRol('ADMIN'))
  const { data: clinicas } = useClinicas()
  const [filtro, setFiltro] = useState({ desde: hoyISO(-30), hasta: hoyISO(), clinica_id: '' as number | '' })
  const { data, isLoading } = useQuery({ queryKey: ['atenciones', filtro], queryFn: () => clinicoApi.atenciones(filtro) })

  return (
    <>
      <EncabezadoPagina
        titulo="Atenciones"
        descripcion="Consultas, controles y urgencias registradas"
        acciones={<Boton icono={<Add size={16} />} onClick={() => navegar('/atenciones/nueva')}>Nueva atención</Boton>}
      />
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
      </div>
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(a) => a.id}
        alHacerClic={(a) => navegar(`/mascotas/${a.mascota.id}`)}
        columnas={[
          { titulo: 'Fecha', celda: (a) => fechaHora(a.fecha) },
          { titulo: 'Tipo', celda: (a) => <TipoAtencionInsignia tipo={a.tipo} /> },
          { titulo: 'Mascota', celda: (a) => <span className="font-medium">{a.mascota.nombre}</span> },
          { titulo: 'Responsable', celda: (a) => a.responsable.nombre_completo },
          { titulo: 'Motivo', celda: (a) => <span className="line-clamp-1 max-w-56">{a.motivo}</span> },
          { titulo: 'Clínica', celda: (a) => a.clinica.nombre },
          { titulo: 'Profesional', celda: (a) => a.profesional.nombre_completo },
          {
            titulo: 'Derivación',
            celda: (a) => {
              const muestras = a.ordenes.reduce((total, o) => total + o.muestras.length, 0)
              return muestras ? <Insignia color="indigo">{muestras} muestra{muestras > 1 ? 's' : ''}</Insignia> : '—'
            },
          },
          { titulo: 'Comprobante', celda: (a) => (a.comprobante_id ? <Insignia color="verde">Emitido</Insignia> : <Insignia>Pendiente</Insignia>) },
        ]}
      />
    </>
  )
}
