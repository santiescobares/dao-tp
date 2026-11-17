import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { clinicoApi } from '../../api/servicios'
import type { Cliente } from '../../api/tipos'
import { useMutacion } from '../../hooks/useMutacion'
import { textoOpcional } from '../../utils/esquemas'
import { Boton } from '../ui/Boton'
import { Campo, Entrada } from '../ui/Campos'
import { Modal } from '../ui/Modal'

const esquema = z.object({
  dni: z.string().regex(/^\d{7,9}$/, 'DNI de 7 a 9 dígitos, sin puntos'),
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  apellido: z.string().min(2, 'Mínimo 2 caracteres'),
  telefono: z.string().min(6, 'Teléfono inválido'),
  email: z.union([z.email('Email inválido'), z.literal('')]).transform((v) => v || null),
  direccion: textoOpcional,
})

interface Props {
  cliente?: Cliente
  alCerrar: () => void
}

export function FormularioCliente({ cliente, alCerrar }: Props) {
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      dni: cliente?.dni ?? '',
      nombre: cliente?.nombre ?? '',
      apellido: cliente?.apellido ?? '',
      telefono: cliente?.telefono ?? '',
      email: cliente?.email ?? '',
      direccion: cliente?.direccion ?? '',
    },
  })
  const guardar = useMutacion(
    (datos: z.output<typeof esquema>) =>
      cliente ? clinicoApi.editarCliente(cliente.id, datos) : clinicoApi.crearCliente(datos),
    { exito: cliente ? 'Cliente actualizado' : 'Cliente registrado', invalidar: ['clientes', 'mascotas'], alTerminar: alCerrar },
  )
  const errores = formState.errors

  return (
    <Modal
      abierto
      titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" form="form-cliente" cargando={guardar.isPending}>Guardar</Boton>
        </>
      }
    >
      <form id="form-cliente" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Nombre" error={errores.nombre?.message}><Entrada {...register('nombre')} /></Campo>
        <Campo etiqueta="Apellido" error={errores.apellido?.message}><Entrada {...register('apellido')} /></Campo>
        <Campo etiqueta="DNI" error={errores.dni?.message}><Entrada inputMode="numeric" {...register('dni')} /></Campo>
        <Campo etiqueta="Teléfono" error={errores.telefono?.message}><Entrada {...register('telefono')} /></Campo>
        <Campo etiqueta="Email" error={errores.email?.message}><Entrada type="email" {...register('email')} /></Campo>
        <Campo etiqueta="Dirección" error={errores.direccion?.message}><Entrada {...register('direccion')} /></Campo>
      </form>
    </Modal>
  )
}
