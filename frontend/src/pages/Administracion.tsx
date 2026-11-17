import { Add, Edit, TrashCan } from '@carbon/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { adminApi, gestionApi } from '../api/servicios'
import type { Clinica, Profesional, TipoAnalisis, Usuario, Vacuna } from '../api/tipos'
import { Boton } from '../components/ui/Boton'
import { Campo, Casilla, Entrada, Seleccion } from '../components/ui/Campos'
import { Insignia } from '../components/ui/Insignias'
import { Modal } from '../components/ui/Modal'
import { EncabezadoPagina, Pestanas } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useClinicas, useEspecies, useProfesionales, useTiposAnalisis, useVacunas } from '../hooks/useCatalogos'
import { useMutacion } from '../hooks/useMutacion'
import { DIAS_SEMANA, ETIQUETA_TIPO_MUESTRA, moneda, temperatura } from '../utils/formato'
import { idRequerido, numeroOpcional, numeroRequerido } from '../utils/esquemas'

type Seccion = 'clinicas' | 'profesionales' | 'usuarios' | 'vacunas' | 'analisis' | 'horarios'

export default function Administracion() {
  const [seccion, setSeccion] = useState<Seccion>('clinicas')
  return (
    <>
      <EncabezadoPagina titulo="Administración" descripcion="Datos maestros de la red" />
      <Pestanas
        opciones={[
          { valor: 'clinicas', etiqueta: 'Clínicas' },
          { valor: 'profesionales', etiqueta: 'Profesionales' },
          { valor: 'usuarios', etiqueta: 'Usuarios' },
          { valor: 'horarios', etiqueta: 'Horarios de atención' },
          { valor: 'vacunas', etiqueta: 'Esquema de vacunas' },
          { valor: 'analisis', etiqueta: 'Tipos de análisis' },
        ]}
        activa={seccion}
        alCambiar={setSeccion}
      />
      {seccion === 'clinicas' && <Clinicas />}
      {seccion === 'profesionales' && <Profesionales />}
      {seccion === 'usuarios' && <Usuarios />}
      {seccion === 'horarios' && <Horarios />}
      {seccion === 'vacunas' && <Vacunas />}
      {seccion === 'analisis' && <TiposAnalisis />}
    </>
  )
}

/** Pie estándar de los modales de formulario. */
const Pie = ({ formulario, alCerrar, cargando }: { formulario: string; alCerrar: () => void; cargando: boolean }) => (
  <>
    <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
    <Boton type="submit" form={formulario} cargando={cargando}>Guardar</Boton>
  </>
)
const BotonEditar = ({ alHacerClic }: { alHacerClic: () => void }) => (
  <Boton chico variante="fantasma" icono={<Edit size={16} />} aria-label="Editar" onClick={alHacerClic} />
)
const BarraNuevo = ({ texto, alHacerClic }: { texto: string; alHacerClic: () => void }) => (
  <div className="mb-3 flex justify-end"><Boton icono={<Add size={16} />} onClick={alHacerClic}>{texto}</Boton></div>
)

// ---------------- Clínicas ----------------
const esquemaClinica = z.object({
  nombre: z.string().min(2, 'Ingresá el nombre'),
  direccion: z.string().min(2, 'Ingresá la dirección'),
  telefono: z.string().min(6, 'Teléfono inválido'),
  activa: z.boolean(),
})

function Clinicas() {
  const { data, isLoading } = useClinicas()
  const [editando, setEditando] = useState<Clinica | 'nueva' | null>(null)
  return (
    <>
      <BarraNuevo texto="Nueva clínica" alHacerClic={() => setEditando('nueva')} />
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(c) => c.id}
        columnas={[
          { titulo: 'Clínica', celda: (c) => <span className="font-medium">{c.nombre}</span> },
          { titulo: 'Dirección', celda: (c) => c.direccion },
          { titulo: 'Teléfono', celda: (c) => c.telefono },
          { titulo: 'Estado', celda: (c) => (c.activa ? <Insignia color="verde">Activa</Insignia> : <Insignia>Inactiva</Insignia>) },
          { titulo: '', className: 'text-right', celda: (c) => <BotonEditar alHacerClic={() => setEditando(c)} /> },
        ]}
      />
      {editando && <FormClinica clinica={editando === 'nueva' ? undefined : editando} alCerrar={() => setEditando(null)} />}
    </>
  )
}

function FormClinica({ clinica, alCerrar }: { clinica?: Clinica; alCerrar: () => void }) {
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaClinica),
    defaultValues: { nombre: clinica?.nombre ?? '', direccion: clinica?.direccion ?? '', telefono: clinica?.telefono ?? '', activa: clinica?.activa ?? true },
  })
  const guardar = useMutacion(
    (d: z.output<typeof esquemaClinica>) => (clinica ? adminApi.editarClinica(clinica.id, d) : adminApi.crearClinica(d)),
    { exito: 'Clínica guardada', invalidar: ['clinicas'], alTerminar: alCerrar },
  )
  const e = formState.errors
  return (
    <Modal abierto titulo={clinica ? 'Editar clínica' : 'Nueva clínica'} alCerrar={alCerrar} pie={<Pie formulario="f-clinica" alCerrar={alCerrar} cargando={guardar.isPending} />}>
      <form id="f-clinica" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="space-y-4" noValidate>
        <Campo etiqueta="Nombre" error={e.nombre?.message}><Entrada {...register('nombre')} /></Campo>
        <Campo etiqueta="Dirección" error={e.direccion?.message}><Entrada {...register('direccion')} /></Campo>
        <Campo etiqueta="Teléfono" error={e.telefono?.message}><Entrada {...register('telefono')} /></Campo>
        <Casilla etiqueta="Activa" {...register('activa')} />
      </form>
    </Modal>
  )
}

// ---------------- Profesionales ----------------
const esquemaProfesional = z.object({
  nombre: z.string().min(2, 'Ingresá el nombre'),
  apellido: z.string().min(2, 'Ingresá el apellido'),
  matricula: z.string().min(2, 'Ingresá la matrícula'),
  especialidad: z.string().min(2, 'Ingresá la especialidad'),
  tipo: z.enum(['VETERINARIO', 'LABORATORISTA']),
  clinica_id: numeroOpcional,
  activo: z.boolean(),
})

function Profesionales() {
  const { data, isLoading } = useProfesionales()
  const [editando, setEditando] = useState<Profesional | 'nuevo' | null>(null)
  return (
    <>
      <BarraNuevo texto="Nuevo profesional" alHacerClic={() => setEditando('nuevo')} />
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(p) => p.id}
        columnas={[
          { titulo: 'Profesional', celda: (p) => <span className="font-medium">{p.nombre_completo}</span> },
          { titulo: 'Matrícula', celda: (p) => p.matricula },
          { titulo: 'Especialidad', celda: (p) => p.especialidad },
          { titulo: 'Tipo', celda: (p) => <Insignia color={p.tipo === 'VETERINARIO' ? 'marca' : 'indigo'}>{p.tipo === 'VETERINARIO' ? 'Veterinario/a' : 'Laboratorio'}</Insignia> },
          { titulo: 'Lugar de trabajo', celda: (p) => p.clinica?.nombre ?? 'Laboratorio central' },
          { titulo: '', className: 'text-right', celda: (p) => <BotonEditar alHacerClic={() => setEditando(p)} /> },
        ]}
      />
      {editando && <FormProfesional profesional={editando === 'nuevo' ? undefined : editando} alCerrar={() => setEditando(null)} />}
    </>
  )
}

function FormProfesional({ profesional, alCerrar }: { profesional?: Profesional; alCerrar: () => void }) {
  const { data: clinicas } = useClinicas()
  const { register, handleSubmit, formState, watch } = useForm({
    resolver: zodResolver(esquemaProfesional),
    defaultValues: {
      nombre: profesional?.nombre ?? '', apellido: profesional?.apellido ?? '', matricula: profesional?.matricula ?? '',
      especialidad: profesional?.especialidad ?? '', tipo: profesional?.tipo ?? 'VETERINARIO',
      clinica_id: profesional?.clinica_id ?? '', activo: profesional?.activo ?? true,
    },
  })
  const guardar = useMutacion(
    (d: z.output<typeof esquemaProfesional>) => {
      const datos = { ...d, clinica_id: d.tipo === 'LABORATORISTA' ? null : d.clinica_id }
      return profesional ? adminApi.editarProfesional(profesional.id, datos) : adminApi.crearProfesional(datos)
    },
    { exito: 'Profesional guardado', invalidar: ['profesionales'], alTerminar: alCerrar },
  )
  const e = formState.errors
  return (
    <Modal abierto titulo={profesional ? 'Editar profesional' : 'Nuevo profesional'} alCerrar={alCerrar} pie={<Pie formulario="f-prof" alCerrar={alCerrar} cargando={guardar.isPending} />}>
      <form id="f-prof" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Nombre" error={e.nombre?.message}><Entrada {...register('nombre')} /></Campo>
        <Campo etiqueta="Apellido" error={e.apellido?.message}><Entrada {...register('apellido')} /></Campo>
        <Campo etiqueta="Matrícula" error={e.matricula?.message}><Entrada {...register('matricula')} /></Campo>
        <Campo etiqueta="Especialidad" error={e.especialidad?.message}><Entrada {...register('especialidad')} /></Campo>
        <Campo etiqueta="Tipo">
          <Seleccion {...register('tipo')}>
            <option value="VETERINARIO">Veterinario/a de clínica</option>
            <option value="LABORATORISTA">Profesional del laboratorio</option>
          </Seleccion>
        </Campo>
        {watch('tipo') === 'VETERINARIO' && (
          <Campo etiqueta="Clínica" error={e.clinica_id?.message}>
            <Seleccion {...register('clinica_id')}>
              <option value="">Seleccioná…</option>
              {clinicas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
        <Casilla etiqueta="Activo" {...register('activo')} />
      </form>
    </Modal>
  )
}

// ---------------- Usuarios ----------------
function Usuarios() {
  const { data, isLoading } = useQuery({ queryKey: ['usuarios'], queryFn: adminApi.usuarios })
  const [editando, setEditando] = useState<Usuario | 'nuevo' | null>(null)
  const roles = { ADMIN: 'Administrador', VETERINARIO: 'Veterinario/a', LABORATORISTA: 'Laboratorio' }
  return (
    <>
      <BarraNuevo texto="Nuevo usuario" alHacerClic={() => setEditando('nuevo')} />
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(u) => u.id}
        columnas={[
          { titulo: 'Usuario', celda: (u) => <span className="font-medium">{u.nombre}</span> },
          { titulo: 'Email', celda: (u) => u.email },
          { titulo: 'Rol', celda: (u) => <Insignia color={u.rol === 'ADMIN' ? 'indigo' : u.rol === 'VETERINARIO' ? 'marca' : 'celeste'}>{roles[u.rol]}</Insignia> },
          { titulo: 'Estado', celda: (u) => (u.activo ? <Insignia color="verde">Activo</Insignia> : <Insignia>Deshabilitado</Insignia>) },
          { titulo: '', className: 'text-right', celda: (u) => <BotonEditar alHacerClic={() => setEditando(u)} /> },
        ]}
      />
      {editando && <FormUsuario usuario={editando === 'nuevo' ? undefined : editando} alCerrar={() => setEditando(null)} />}
    </>
  )
}

function FormUsuario({ usuario, alCerrar }: { usuario?: Usuario; alCerrar: () => void }) {
  const { data: profesionales } = useProfesionales()
  const esquema = z.object({
    email: z.email('Email inválido'),
    nombre: z.string().min(2, 'Ingresá el nombre'),
    rol: z.enum(['ADMIN', 'VETERINARIO', 'LABORATORISTA']),
    profesional_id: numeroOpcional,
    activo: z.boolean(),
    password: usuario
      ? z.string().refine((v) => v === '' || v.length >= 6, 'Mínimo 6 caracteres')
      : z.string().min(6, 'Mínimo 6 caracteres'),
  })
  const { register, handleSubmit, formState, watch } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      email: usuario?.email ?? '', nombre: usuario?.nombre ?? '', rol: usuario?.rol ?? 'VETERINARIO',
      profesional_id: usuario?.profesional_id ?? '', activo: usuario?.activo ?? true, password: '',
    },
  })
  const rol = watch('rol')
  const guardar = useMutacion(
    (d: z.output<typeof esquema>) => {
      const datos = { ...d, password: d.password || null, profesional_id: d.rol === 'ADMIN' ? null : d.profesional_id }
      return usuario ? adminApi.editarUsuario(usuario.id, datos) : adminApi.crearUsuario(datos)
    },
    { exito: 'Usuario guardado', invalidar: ['usuarios'], alTerminar: alCerrar },
  )
  const e = formState.errors
  return (
    <Modal abierto titulo={usuario ? 'Editar usuario' : 'Nuevo usuario'} alCerrar={alCerrar} pie={<Pie formulario="f-usuario" alCerrar={alCerrar} cargando={guardar.isPending} />}>
      <form id="f-usuario" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Nombre" error={e.nombre?.message}><Entrada {...register('nombre')} /></Campo>
        <Campo etiqueta="Email" error={e.email?.message}><Entrada type="email" {...register('email')} /></Campo>
        <Campo etiqueta="Rol">
          <Seleccion {...register('rol')}>
            <option value="ADMIN">Administrador</option>
            <option value="VETERINARIO">Veterinario/a</option>
            <option value="LABORATORISTA">Laboratorio</option>
          </Seleccion>
        </Campo>
        {rol !== 'ADMIN' && (
          <Campo etiqueta="Profesional vinculado" error={e.profesional_id?.message}>
            <Seleccion {...register('profesional_id')}>
              <option value="">Seleccioná…</option>
              {profesionales?.filter((p) => p.tipo === rol).map((p) => <option key={p.id} value={p.id}>{p.nombre_completo}</option>)}
            </Seleccion>
          </Campo>
        )}
        <Campo etiqueta={usuario ? 'Nueva contraseña (opcional)' : 'Contraseña'} error={e.password?.message}>
          <Entrada type="password" autoComplete="new-password" {...register('password')} />
        </Campo>
        <Casilla etiqueta="Usuario activo" {...register('activo')} />
      </form>
    </Modal>
  )
}

// ---------------- Horarios ----------------
function Horarios() {
  const { data: profesionales } = useProfesionales()
  const [profesionalId, setProfesionalId] = useState<number | ''>('')
  const [dia, setDia] = useState(0)
  const [desde, setDesde] = useState('09:00')
  const [hasta, setHasta] = useState('13:00')
  const { data, isLoading } = useQuery({
    queryKey: ['horarios', profesionalId],
    queryFn: () => gestionApi.horarios(Number(profesionalId)),
    enabled: profesionalId !== '',
  })
  const crear = useMutacion(
    () => gestionApi.crearHorario({ profesional_id: Number(profesionalId), dia_semana: dia, hora_desde: desde, hora_hasta: hasta }),
    { exito: 'Franja agregada', invalidar: ['horarios'] },
  )
  const eliminar = useMutacion(gestionApi.eliminarHorario, { exito: 'Franja eliminada', invalidar: ['horarios'] })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Profesional" className="w-72">
          <Seleccion value={profesionalId} onChange={(e) => setProfesionalId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Seleccioná…</option>
            {profesionales?.map((p) => <option key={p.id} value={p.id}>{p.nombre_completo} · {p.clinica?.nombre ?? 'Laboratorio'}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Día">
          <Seleccion value={dia} onChange={(e) => setDia(Number(e.target.value))}>
            {DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Desde"><Entrada type="time" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
        <Campo etiqueta="Hasta"><Entrada type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
        <Boton icono={<Add size={16} />} disabled={profesionalId === ''} cargando={crear.isPending} onClick={() => crear.mutate(undefined)}>Agregar franja</Boton>
      </div>
      {profesionalId !== '' && (
        <Tabla
          filas={data}
          cargando={isLoading}
          clave={(h) => h.id}
          vacio="El profesional no tiene franjas de atención cargadas."
          columnas={[
            { titulo: 'Día', celda: (h) => DIAS_SEMANA[h.dia_semana] },
            { titulo: 'Desde', celda: (h) => h.hora_desde.slice(0, 5) },
            { titulo: 'Hasta', celda: (h) => h.hora_hasta.slice(0, 5) },
            {
              titulo: '',
              className: 'text-right',
              celda: (h) => <Boton chico variante="fantasma" icono={<TrashCan size={16} />} aria-label="Eliminar" onClick={() => eliminar.mutate(h.id)} />,
            },
          ]}
        />
      )}
    </div>
  )
}

// ---------------- Vacunas ----------------
const esquemaVacuna = z.object({
  nombre: z.string().min(2, 'Ingresá el nombre'),
  especie_id: idRequerido('Elegí la especie'),
  obligatoria: z.boolean(),
  edad_minima_semanas: numeroRequerido(),
  refuerzo_meses: numeroOpcional,
  precio: numeroRequerido(),
})

function Vacunas() {
  const { data, isLoading } = useVacunas()
  const [editando, setEditando] = useState<Vacuna | 'nueva' | null>(null)
  return (
    <>
      <BarraNuevo texto="Nueva vacuna" alHacerClic={() => setEditando('nueva')} />
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(v) => v.id}
        columnas={[
          { titulo: 'Vacuna', celda: (v) => <span className="font-medium">{v.nombre}</span> },
          { titulo: 'Especie', celda: (v) => v.especie.nombre },
          { titulo: 'Esquema', celda: (v) => (v.obligatoria ? <Insignia color="marca">Obligatoria</Insignia> : <Insignia>Opcional</Insignia>) },
          { titulo: 'Desde', celda: (v) => `${v.edad_minima_semanas} semanas` },
          { titulo: 'Refuerzo', celda: (v) => (v.refuerzo_meses ? `cada ${v.refuerzo_meses} meses` : 'Dosis única') },
          { titulo: 'Precio', className: 'text-right tabular-nums', celda: (v) => moneda(v.precio) },
          { titulo: '', className: 'text-right', celda: (v) => <BotonEditar alHacerClic={() => setEditando(v)} /> },
        ]}
      />
      {editando && <FormVacuna vacuna={editando === 'nueva' ? undefined : editando} alCerrar={() => setEditando(null)} />}
    </>
  )
}

function FormVacuna({ vacuna, alCerrar }: { vacuna?: Vacuna; alCerrar: () => void }) {
  const { data: especies } = useEspecies()
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaVacuna),
    defaultValues: {
      nombre: vacuna?.nombre ?? '', especie_id: vacuna?.especie_id ?? '', obligatoria: vacuna?.obligatoria ?? true,
      edad_minima_semanas: vacuna?.edad_minima_semanas ?? 8, refuerzo_meses: vacuna?.refuerzo_meses ?? 12, precio: vacuna?.precio ?? 0,
    },
  })
  const guardar = useMutacion(
    (d: z.output<typeof esquemaVacuna>) => (vacuna ? adminApi.editarVacuna(vacuna.id, d) : adminApi.crearVacuna(d)),
    { exito: 'Vacuna guardada', invalidar: ['vacunas'], alTerminar: alCerrar },
  )
  const e = formState.errors
  return (
    <Modal abierto titulo={vacuna ? 'Editar vacuna' : 'Nueva vacuna'} alCerrar={alCerrar} pie={<Pie formulario="f-vacuna" alCerrar={alCerrar} cargando={guardar.isPending} />}>
      <form id="f-vacuna" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Nombre" error={e.nombre?.message}><Entrada {...register('nombre')} /></Campo>
        <Campo etiqueta="Especie" error={e.especie_id?.message}>
          <Seleccion {...register('especie_id')}>
            <option value="">Seleccioná…</option>
            {especies?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Edad mínima (semanas)" error={e.edad_minima_semanas?.message}><Entrada type="number" min="0" {...register('edad_minima_semanas')} /></Campo>
        <Campo etiqueta="Refuerzo cada (meses)" ayuda="Vacío = dosis única"><Entrada type="number" min="1" {...register('refuerzo_meses')} /></Campo>
        <Campo etiqueta="Precio" error={e.precio?.message}><Entrada type="number" min="0" {...register('precio')} /></Campo>
        <div className="flex items-end pb-2"><Casilla etiqueta="Obligatoria" {...register('obligatoria')} /></div>
      </form>
    </Modal>
  )
}

// ---------------- Tipos de análisis ----------------
const esquemaAnalisis = z
  .object({
    nombre: z.string().min(2, 'Ingresá el nombre'),
    tipo_muestra: z.enum(['SANGRE', 'ORINA', 'HECES', 'TEJIDO', 'HISOPADO']),
    precio: numeroRequerido(),
    temperatura_min: numeroRequerido(),
    temperatura_max: numeroRequerido(),
    horas_viabilidad: numeroRequerido().pipe(z.number().int().min(1, 'Mínimo 1')),
    activo: z.boolean(),
  })
  .refine((d) => d.temperatura_min < d.temperatura_max, { message: 'Debe ser mayor a la mínima', path: ['temperatura_max'] })

function TiposAnalisis() {
  const { data, isLoading } = useTiposAnalisis()
  const [editando, setEditando] = useState<TipoAnalisis | 'nuevo' | null>(null)
  return (
    <>
      <BarraNuevo texto="Nuevo tipo de análisis" alHacerClic={() => setEditando('nuevo')} />
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(t) => t.id}
        columnas={[
          { titulo: 'Análisis', celda: (t) => <span className="font-medium">{t.nombre}</span> },
          { titulo: 'Muestra', celda: (t) => ETIQUETA_TIPO_MUESTRA[t.tipo_muestra] },
          { titulo: 'Conservación', celda: (t) => `${temperatura(t.temperatura_min)} a ${temperatura(t.temperatura_max)}` },
          { titulo: 'Viabilidad', celda: (t) => `${t.horas_viabilidad} h` },
          { titulo: 'Precio', className: 'text-right tabular-nums', celda: (t) => moneda(t.precio) },
          { titulo: 'Estado', celda: (t) => (t.activo ? <Insignia color="verde">Activo</Insignia> : <Insignia>Inactivo</Insignia>) },
          { titulo: '', className: 'text-right', celda: (t) => <BotonEditar alHacerClic={() => setEditando(t)} /> },
        ]}
      />
      {editando && <FormAnalisis tipo={editando === 'nuevo' ? undefined : editando} alCerrar={() => setEditando(null)} />}
    </>
  )
}

function FormAnalisis({ tipo, alCerrar }: { tipo?: TipoAnalisis; alCerrar: () => void }) {
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaAnalisis),
    defaultValues: {
      nombre: tipo?.nombre ?? '', tipo_muestra: tipo?.tipo_muestra ?? 'SANGRE', precio: tipo?.precio ?? 0,
      temperatura_min: tipo?.temperatura_min ?? 2, temperatura_max: tipo?.temperatura_max ?? 8,
      horas_viabilidad: tipo?.horas_viabilidad ?? 48, activo: tipo?.activo ?? true,
    },
  })
  const guardar = useMutacion(
    (d: z.output<typeof esquemaAnalisis>) => (tipo ? adminApi.editarTipoAnalisis(tipo.id, d) : adminApi.crearTipoAnalisis(d)),
    { exito: 'Tipo de análisis guardado', invalidar: ['tipos-analisis'], alTerminar: alCerrar },
  )
  const e = formState.errors
  return (
    <Modal abierto titulo={tipo ? 'Editar análisis' : 'Nuevo tipo de análisis'} alCerrar={alCerrar} pie={<Pie formulario="f-analisis" alCerrar={alCerrar} cargando={guardar.isPending} />}>
      <form id="f-analisis" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Nombre" error={e.nombre?.message} className="sm:col-span-2"><Entrada {...register('nombre')} /></Campo>
        <Campo etiqueta="Tipo de muestra">
          <Seleccion {...register('tipo_muestra')}>
            {Object.entries(ETIQUETA_TIPO_MUESTRA).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Precio" error={e.precio?.message}><Entrada type="number" min="0" {...register('precio')} /></Campo>
        <Campo etiqueta="Temperatura mínima (°C)" error={e.temperatura_min?.message}><Entrada type="number" step="0.5" {...register('temperatura_min')} /></Campo>
        <Campo etiqueta="Temperatura máxima (°C)" error={e.temperatura_max?.message}><Entrada type="number" step="0.5" {...register('temperatura_max')} /></Campo>
        <Campo etiqueta="Horas de viabilidad" error={e.horas_viabilidad?.message}><Entrada type="number" min="1" {...register('horas_viabilidad')} /></Campo>
        <div className="flex items-end pb-2"><Casilla etiqueta="Activo" {...register('activo')} /></div>
      </form>
    </Modal>
  )
}
