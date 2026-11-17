import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { mensajeDeError } from '../api/cliente'

interface Opciones<R> {
  /** Mensaje de éxito (o función que lo arma con la respuesta). */
  exito?: string | ((respuesta: R) => string)
  /** Claves de consultas a refrescar al terminar bien. */
  invalidar?: string[]
  alTerminar?: (respuesta: R) => void
}

/** useMutation con toasts de éxito/error y refresco de consultas relacionadas. */
export function useMutacion<V, R>(funcion: (variables: V) => Promise<R>, opciones: Opciones<R> = {}) {
  const clienteQuery = useQueryClient()
  return useMutation({
    mutationFn: funcion,
    onSuccess: (respuesta) => {
      if (opciones.exito) {
        toast.success(typeof opciones.exito === 'function' ? opciones.exito(respuesta) : opciones.exito)
      }
      opciones.invalidar?.forEach((clave) => clienteQuery.invalidateQueries({ queryKey: [clave] }))
      opciones.alTerminar?.(respuesta)
    },
    onError: (error) => toast.error(mensajeDeError(error)),
  })
}
