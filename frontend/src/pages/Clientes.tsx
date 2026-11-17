import { Add, Edit, Search, TrashCan } from '@carbon/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clinicoApi } from '../api/servicios'
import type { Cliente } from '../api/tipos'
import { FormularioCliente } from '../components/formularios/FormularioCliente'
import { Boton } from '../components/ui/Boton'
import { Entrada } from '../components/ui/Campos'
import { EncabezadoPagina } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useClientes } from '../hooks/useCatalogos'
import { useMutacion } from '../hooks/useMutacion'
import { fecha } from '../utils/formato'

export default function Clientes() {
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<Cliente | 'nuevo' | null>(null)
  const navegar = useNavigate()
  const { data, isLoading } = useClientes(busqueda)
  const eliminar = useMutacion(clinicoApi.eliminarCliente, { exito: 'Cliente eliminado', invalidar: ['clientes'] })

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion="Responsables de las mascotas atendidas en la red"
        acciones={<Boton icono={<Add size={16} />} onClick={() => setEditando('nuevo')}>Nuevo cliente</Boton>}
      />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
        <Entrada className="pl-9" placeholder="Buscar por nombre, apellido o DNI" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(c) => c.id}
        alHacerClic={(c) => navegar(`/mascotas?cliente=${c.id}`)}
        columnas={[
          { titulo: 'Cliente', celda: (c) => <span className="font-medium">{c.nombre_completo}</span> },
          { titulo: 'DNI', celda: (c) => c.dni },
          { titulo: 'Teléfono', celda: (c) => c.telefono },
          { titulo: 'Email', celda: (c) => c.email ?? '—' },
          { titulo: 'Mascotas', celda: (c) => c.cantidad_mascotas, className: 'text-center' },
          { titulo: 'Alta', celda: (c) => fecha(c.fecha_alta) },
          {
            titulo: 'Acciones',
            className: 'text-right',
            celda: (c) => (
              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                <Boton variante="fantasma" chico icono={<Edit size={16} />} onClick={() => setEditando(c)} aria-label="Editar" />
                <Boton
                  variante="fantasma"
                  chico
                  icono={<TrashCan size={16} />}
                  aria-label="Eliminar"
                  onClick={() => confirm(`¿Eliminar a ${c.nombre_completo}?`) && eliminar.mutate(c.id)}
                />
              </div>
            ),
          },
        ]}
      />
      {editando && <FormularioCliente cliente={editando === 'nuevo' ? undefined : editando} alCerrar={() => setEditando(null)} />}
    </>
  )
}
