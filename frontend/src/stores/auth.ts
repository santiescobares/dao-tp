import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Rol, Usuario } from '../api/tipos'

interface EstadoAuth {
  token: string | null
  usuario: Usuario | null
  iniciarSesion: (token: string, usuario: Usuario) => void
  cerrarSesion: () => void
  tieneRol: (...roles: Rol[]) => boolean
}

/** Sesión del usuario. `persist` la guarda en localStorage para sobrevivir a recargas. */
export const useAuth = create<EstadoAuth>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      iniciarSesion: (token, usuario) => set({ token, usuario }),
      cerrarSesion: () => set({ token: null, usuario: null }),
      tieneRol: (...roles) => {
        const rol = get().usuario?.rol
        return rol !== undefined && roles.includes(rol)
      },
    }),
    { name: 'vetred-sesion', partialize: (estado) => ({ token: estado.token, usuario: estado.usuario }) },
  ),
)
