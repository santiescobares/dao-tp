import axios, { AxiosError } from 'axios'
import { useAuth } from '../stores/auth'

/** Instancia única de Axios: agrega el JWT y maneja la sesión vencida. */
export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error: AxiosError) => {
    const esLogin = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !esLogin) {
      useAuth.getState().cerrarSesion()
    }
    return Promise.reject(error)
  },
)

/** Traduce cualquier error de la API a un mensaje legible para el usuario. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof AxiosError) {
    const detalle = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detalle === 'string') return detalle
    // Errores de validación de FastAPI (422): lista de campos
    if (Array.isArray(detalle) && detalle.length > 0) {
      const primero = detalle[0] as { loc?: string[]; msg?: string }
      const campo = primero.loc?.slice(1).join('.') ?? 'dato'
      return `Dato inválido en "${campo}": ${primero.msg ?? 'revisá el formulario'}`
    }
    if (!error.response) return 'No se pudo conectar con el servidor.'
  }
  return 'Ocurrió un error inesperado.'
}
