import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { clinicoApi } from '../../api/servicios'
import type { Mascota } from '../../api/tipos'
import { useClientes, useEspecies } from '../../hooks/useCatalogos'
import { useMutacion } from '../../hooks/useMutacion'
import { hoyISO } from '../../utils/formato'
import { idRequerido, numeroOpcional, textoOpcional } from '../../utils/esquemas'
import { Boton } from '../ui/Boton'
import { Campo, Casilla, Entrada, Seleccion } from '../ui/Campos'
import { Modal } from '../ui/Modal'

const esquema = z.object({
  nombre: z.string().min(1, 'Ingresá el nombre'),
  especie_id: idRequerido('Seleccioná la especie'),
  raza: textoOpcional,
  sexo: z.enum(['MACHO', 'HEMBRA']),
  fecha_nacimiento: z.string().min(1, 'Ingresá la fecha de nacimiento').refine((f) => f <= hoyISO(), 'No puede ser futura'),
  peso_kg: numeroOpcional,
  // Validación de negocio: toda mascota debe tener un responsable
  cliente_id: idRequerido('Toda mascota debe tener un responsable'),
  activa: z.boolean(),
})

interface Props {
  mascota?: Mascota
  clienteInicial?: number
  alCerrar: () => void
  alGuardar?: (mascota: Mascota) => void
}

export function FormularioMascota({ mascota, clienteInicial, alCerrar, alGuardar }: Props) {
  const { data: especies } = useEspecies()
  const { data: clientes } = useClientes()
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: mascota?.nombre ?? '',
      especie_id: mascota?.especie_id ?? '',
      raza: mascota?.raza ?? '',
      sexo: mascota?.sexo ?? 'MACHO',
      fecha_nacimiento: mascota?.fecha_nacimiento ?? '',
      peso_kg: mascota?.peso_kg ?? '',
      cliente_id: mascota?.cliente_id ?? clienteInicial ?? '',
      activa: mascota?.activa ?? true,
    },
  })
  const guardar = useMutacion(
    (datos: z.output<typeof esquema>) =>
      mascota ? clinicoApi.editarMascota(mascota.id, datos) : clinicoApi.crearMascota(datos),
    {
      exito: (m) => (mascota ? 'Mascota actualizada' : `Mascota registrada con historia clínica ${m.historia.numero}`),
      invalidar: ['mascotas', 'historia', 'clientes'],
      alTerminar: (m) => {
        alGuardar?.(m)
        alCerrar()
      },
    },
  )
  const errores = formState.errors

  return (
    <Modal
      abierto
      titulo={mascota ? 'Editar mascota' : 'Nueva mascota'}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" form="form-mascota" cargando={guardar.isPending}>Guardar</Boton>
        </>
      }
    >
      <form id="form-mascota" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Responsable" error={errores.cliente_id?.message} className="sm:col-span-2">
          <Seleccion {...register('cliente_id')}>
            <option value="">Seleccioná el cliente responsable…</option>
            {clientes?.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre_completo} · DNI {c.dni}</option>
            ))}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Nombre" error={errores.nombre?.message}><Entrada {...register('nombre')} /></Campo>
        <Campo etiqueta="Especie" error={errores.especie_id?.message}>
          <Seleccion {...register('especie_id')}>
            <option value="">Seleccioná…</option>
            {especies?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Raza"><Entrada {...register('raza')} /></Campo>
        <Campo etiqueta="Sexo">
          <Seleccion {...register('sexo')}>
            <option value="MACHO">Macho</option>
            <option value="HEMBRA">Hembra</option>
          </Seleccion>
        </Campo>
        <Campo etiqueta="Fecha de nacimiento" error={errores.fecha_nacimiento?.message}>
          <Entrada type="date" max={hoyISO()} {...register('fecha_nacimiento')} />
        </Campo>
        <Campo etiqueta="Peso (kg)" error={errores.peso_kg?.message}>
          <Entrada type="number" step="0.1" min="0" {...register('peso_kg')} />
        </Campo>
        {mascota && <Casilla etiqueta="Mascota activa" {...register('activa')} />}
      </form>
    </Modal>
  )
}
