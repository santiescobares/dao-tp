import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Rol } from '../../api/tipos'
import { useAuth } from '../../stores/auth'

/** Exige sesión iniciada y, opcionalmente, alguno de los roles indicados. */
export function RutaProtegida({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  const { token, usuario } = useAuth()
  const ubicacion = useLocation()

  if (!token || !usuario) return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
  if (roles && !roles.includes(usuario.rol)) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-lg font-semibold">Acceso restringido</h1>
        <p className="mt-1 text-sm text-slate-500">Tu rol no tiene permisos para ver esta sección.</p>
      </div>
    )
  }
  return children
}
