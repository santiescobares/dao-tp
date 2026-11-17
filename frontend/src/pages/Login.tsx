import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { mensajeDeError } from '../api/cliente'
import { authApi } from '../api/servicios'
import { Boton } from '../components/ui/Boton'
import { Campo, Entrada } from '../components/ui/Campos'
import { useAuth } from '../stores/auth'

const esquema = z.object({
  email: z.email('Ingresá un email válido'),
  password: z.string().min(1, 'Ingresá la contraseña'),
})

const USUARIOS_DEMO = [
  { email: 'admin@vetred.com', password: 'admin123', rol: 'Administración' },
  { email: 'vet1@vetred.com', password: 'vet123', rol: 'Veterinaria · Clínica Centro' },
  { email: 'lab1@vetred.com', password: 'lab123', rol: 'Laboratorio central' },
]

export default function Login() {
  const { token, iniciarSesion } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const { register, handleSubmit, setValue, formState } = useForm({ resolver: zodResolver(esquema) })

  if (token) return <Navigate to="/" replace />

  const ingresar = handleSubmit(async ({ email, password }) => {
    try {
      const { token, usuario } = await authApi.login(email, password)
      iniciarSesion(token, usuario)
      toast.success(`¡Hola, ${usuario.nombre}!`)
      navegar((ubicacion.state as { desde?: string } | null)?.desde ?? '/', { replace: true })
    } catch (error) {
      toast.error(mensajeDeError(error))
    }
  })

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-marca-900 p-12 text-marca-50 lg:flex">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10" />
          <span className="text-lg font-semibold">VetRed</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl leading-tight font-semibold text-white">
            De la consulta al diagnóstico, con cada muestra bajo custodia.
          </h1>
          <p className="mt-4 text-marca-100/80">
            Historias clínicas, derivaciones al laboratorio central, transporte en conservadoras precintadas y
            resultados con trazabilidad completa.
          </p>
        </div>
        <p className="text-xs text-marca-200/60">Desarrollo de Aplicaciones con Objetos · TP Integrador 2026</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-slate-500">Ingresá con tu usuario de la red.</p>
          <form onSubmit={ingresar} className="mt-8 space-y-4" noValidate>
            <Campo etiqueta="Email" error={formState.errors.email?.message}>
              <Entrada type="email" autoComplete="username" {...register('email')} />
            </Campo>
            <Campo etiqueta="Contraseña" error={formState.errors.password?.message}>
              <Entrada type="password" autoComplete="current-password" {...register('password')} />
            </Campo>
            <Boton type="submit" className="w-full" cargando={formState.isSubmitting}>
              Ingresar
            </Boton>
          </form>

          <div className="mt-10 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Usuarios de demostración</p>
            <ul className="mt-2 space-y-1">
              {USUARIOS_DEMO.map((u) => (
                <li key={u.email}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setValue('email', u.email)
                      setValue('password', u.password)
                    }}
                  >
                    <span className="font-medium text-slate-800">{u.email}</span>
                    <span className="block text-xs text-slate-500">{u.rol}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
