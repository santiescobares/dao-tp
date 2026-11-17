import {
  Box,
  Calendar,
  ChartBar,
  Chemistry,
  Dashboard,
  DeliveryTruck,
  DogWalker,
  InventoryManagement,
  Logout,
  Menu,
  Microscope,
  Receipt,
  Settings,
  Stethoscope,
  UserMultiple,
} from '@carbon/icons-react'
import { useState, type ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Rol } from '../../api/tipos'
import { useClinicas } from '../../hooks/useCatalogos'
import { useAuth } from '../../stores/auth'

interface ItemMenu {
  ruta: string
  etiqueta: string
  icono: ComponentType<{ size?: number }>
  roles: Rol[]
}

const TODOS: Rol[] = ['ADMIN', 'VETERINARIO', 'LABORATORISTA']
const CLINICA: Rol[] = ['ADMIN', 'VETERINARIO']
const LABORATORIO: Rol[] = ['ADMIN', 'LABORATORISTA']

export const SECCIONES: { titulo: string; items: ItemMenu[] }[] = [
  {
    titulo: 'General',
    items: [{ ruta: '/', etiqueta: 'Tablero', icono: Dashboard, roles: TODOS }],
  },
  {
    titulo: 'Atención clínica',
    items: [
      { ruta: '/clientes', etiqueta: 'Clientes', icono: UserMultiple, roles: CLINICA },
      { ruta: '/mascotas', etiqueta: 'Mascotas', icono: DogWalker, roles: TODOS },
      { ruta: '/atenciones', etiqueta: 'Atenciones', icono: Stethoscope, roles: CLINICA },
      { ruta: '/comprobantes', etiqueta: 'Comprobantes', icono: Receipt, roles: CLINICA },
    ],
  },
  {
    titulo: 'Derivaciones',
    items: [
      { ruta: '/muestras', etiqueta: 'Muestras', icono: Chemistry, roles: TODOS },
      { ruta: '/empaquetado', etiqueta: 'Empaquetado', icono: Box, roles: CLINICA },
      { ruta: '/remitos', etiqueta: 'Remitos y envíos', icono: DeliveryTruck, roles: TODOS },
      { ruta: '/laboratorio', etiqueta: 'Laboratorio', icono: Microscope, roles: LABORATORIO },
    ],
  },
  {
    titulo: 'Gestión',
    items: [
      { ruta: '/stock', etiqueta: 'Stock', icono: InventoryManagement, roles: CLINICA },
      { ruta: '/agenda', etiqueta: 'Agenda', icono: Calendar, roles: TODOS },
      { ruta: '/reportes', etiqueta: 'Reportes', icono: ChartBar, roles: TODOS },
      { ruta: '/administracion', etiqueta: 'Administración', icono: Settings, roles: ['ADMIN'] },
    ],
  },
]

const ETIQUETA_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  VETERINARIO: 'Veterinario/a',
  LABORATORISTA: 'Laboratorio central',
}

export function Layout() {
  const { usuario, cerrarSesion } = useAuth()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { data: clinicas } = useClinicas()
  const clinica = clinicas?.find((c) => c.id === usuario?.clinica_id)

  if (!usuario) return null

  const salir = () => {
    cerrarSesion()
    navegar('/login')
  }

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Barra lateral */}
      <aside
        className={`no-imprimir fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform lg:translate-x-0 ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <img src="/favicon.svg" alt="" className="size-9" />
          <div>
            <p className="font-semibold text-white">VetRed</p>
            <p className="text-xs text-slate-400">Red de clínicas veterinarias</p>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {SECCIONES.map((seccion) => {
            const items = seccion.items.filter((i) => i.roles.includes(usuario.rol))
            if (items.length === 0) return null
            return (
              <div key={seccion.titulo}>
                <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{seccion.titulo}</p>
                {items.map(({ ruta, etiqueta, icono: Icono }) => (
                  <NavLink
                    key={ruta}
                    to={ruta}
                    end={ruta === '/'}
                    onClick={() => setMenuAbierto(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive ? 'bg-marca-700 text-white' : 'hover:bg-slate-800 hover:text-white'
                      }`
                    }
                  >
                    <Icono size={18} />
                    {etiqueta}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
        <div className="border-t border-slate-800 px-4 py-4">
          <p className="truncate text-sm font-medium text-white">{usuario.nombre}</p>
          <p className="truncate text-xs text-slate-400">
            {ETIQUETA_ROL[usuario.rol]}
            {clinica && ` · ${clinica.nombre}`}
          </p>
          <button type="button" onClick={salir} className="mt-3 inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white">
            <Logout size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>
      {menuAbierto && <div className="no-imprimir fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={() => setMenuAbierto(false)} />}

      {/* Barra superior en pantallas chicas */}
      <header className="no-imprimir sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="rounded-md p-1 hover:bg-slate-100">
          <Menu size={24} />
        </button>
        <span className="font-semibold">VetRed</span>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
