import { Add, Search } from '@carbon/icons-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FormularioMascota } from '../components/formularios/FormularioMascota'
import { Boton } from '../components/ui/Boton'
import { Entrada } from '../components/ui/Campos'
import { Insignia } from '../components/ui/Insignias'
import { EncabezadoPagina } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useMascotas } from '../hooks/useCatalogos'
import { useAuth } from '../stores/auth'
import { edad } from '../utils/formato'

export default function Mascotas() {
  const [parametros, setParametros] = useSearchParams()
  const clienteId = parametros.get('cliente') ? Number(parametros.get('cliente')) : undefined
  const [busqueda, setBusqueda] = useState('')
  const [creando, setCreando] = useState(false)
  const navegar = useNavigate()
  const puedeEditar = useAuth((s) => s.tieneRol('ADMIN', 'VETERINARIO'))
  const { data, isLoading } = useMascotas(busqueda, clienteId)

  const responsable = clienteId && data?.[0]?.responsable

  return (
    <>
      <EncabezadoPagina
        titulo="Mascotas"
        descripcion={
          responsable ? (
            <>
              Mascotas de <strong>{responsable.nombre_completo}</strong> ·{' '}
              <button type="button" className="text-marca-700 hover:underline" onClick={() => setParametros({})}>ver todas</button>
            </>
          ) : (
            'Pacientes de la red con su historia clínica'
          )
        }
        acciones={puedeEditar && <Boton icono={<Add size={16} />} onClick={() => setCreando(true)}>Nueva mascota</Boton>}
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
        <Entrada className="pl-9" placeholder="Buscar por nombre, responsable o DNI" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(m) => m.id}
        alHacerClic={(m) => navegar(`/mascotas/${m.id}`)}
        columnas={[
          {
            titulo: 'Mascota',
            celda: (m) => (
              <div>
                <span className="font-medium">{m.nombre}</span>
                {!m.activa && <span className="ml-2"><Insignia>Inactiva</Insignia></span>}
              </div>
            ),
          },
          { titulo: 'Especie / raza', celda: (m) => `${m.especie.nombre}${m.raza ? ` · ${m.raza}` : ''}` },
          { titulo: 'Sexo', celda: (m) => (m.sexo === 'MACHO' ? 'Macho' : 'Hembra') },
          { titulo: 'Edad', celda: (m) => edad(m.fecha_nacimiento) },
          { titulo: 'Responsable', celda: (m) => m.responsable.nombre_completo },
          { titulo: 'Historia clínica', celda: (m) => <span className="font-mono text-xs">{m.historia.numero}</span> },
        ]}
      />
      {creando && (
        <FormularioMascota clienteInicial={clienteId} alCerrar={() => setCreando(false)} alGuardar={(m) => navegar(`/mascotas/${m.id}`)} />
      )}
    </>
  )
}
