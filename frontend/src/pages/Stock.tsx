import { Add, Edit, RecentlyViewed, WarningAlt } from '@carbon/icons-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { gestionApi } from '../api/servicios'
import type { Conservadora, Insumo } from '../api/tipos'
import { Boton } from '../components/ui/Boton'
import { Campo, Casilla, Entrada, Seleccion } from '../components/ui/Campos'
import { ConservadoraInsignia, Insignia } from '../components/ui/Insignias'
import { Modal } from '../components/ui/Modal'
import { EncabezadoPagina, Pestanas } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useClinicas, useInsumos } from '../hooks/useCatalogos'
import { useMutacion } from '../hooks/useMutacion'
import { useAuth } from '../stores/auth'
import { fechaHora, temperatura } from '../utils/formato'
import { idRequerido, numeroRequerido } from '../utils/esquemas'

type Vista = 'insumos' | 'conservadoras'

export default function Stock() {
  const usuario = useAuth((s) => s.usuario)!
  const [vista, setVista] = useState<Vista>('insumos')
  const [clinicaId, setClinicaId] = useState<number | ''>('')
  const { data: clinicas } = useClinicas()

  return (
    <>
      <EncabezadoPagina titulo="Stock" descripcion="Conservadoras isotérmicas e insumos médicos de cada clínica" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Pestanas
          opciones={[{ valor: 'insumos', etiqueta: 'Insumos médicos' }, { valor: 'conservadoras', etiqueta: 'Conservadoras' }]}
          activa={vista}
          alCambiar={setVista}
        />
        {usuario.rol === 'ADMIN' && (
          <div className="mb-5 w-56">
            <Seleccion value={clinicaId} onChange={(e) => setClinicaId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Todas las clínicas</option>
              {clinicas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          </div>
        )}
      </div>
      {vista === 'insumos' ? <Insumos clinicaId={clinicaId} /> : <Conservadoras clinicaId={clinicaId} />}
    </>
  )
}

// ---------------- Insumos ----------------
function Insumos({ clinicaId }: { clinicaId: number | '' }) {
  const { data, isLoading } = useInsumos(clinicaId)
  const [editando, setEditando] = useState<Insumo | 'nuevo' | null>(null)
  const [movimiento, setMovimiento] = useState<Insumo | null>(null)
  const [historial, setHistorial] = useState<Insumo | null>(null)

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Boton icono={<Add size={16} />} onClick={() => setEditando('nuevo')}>Nuevo insumo</Boton>
      </div>
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(i) => i.id}
        columnas={[
          { titulo: 'Insumo', celda: (i) => <span className="font-medium">{i.nombre}</span> },
          { titulo: 'Clínica', celda: (i) => i.clinica.nombre },
          {
            titulo: 'Stock',
            className: 'text-right',
            celda: (i) => (
              <span className={`tabular-nums ${i.bajo_minimo ? 'font-semibold text-rose-600' : ''}`}>
                {i.stock_actual.toLocaleString('es-AR')} {i.unidad}
              </span>
            ),
          },
          { titulo: 'Mínimo', className: 'text-right', celda: (i) => <span className="tabular-nums text-slate-500">{i.stock_minimo} {i.unidad}</span> },
          {
            titulo: 'Situación',
            celda: (i) =>
              i.bajo_minimo ? (
                <Insignia color="rojo"><WarningAlt size={12} className="mr-1" /> Reponer</Insignia>
              ) : (
                <Insignia color="verde">OK</Insignia>
              ),
          },
          {
            titulo: 'Acciones',
            className: 'text-right',
            celda: (i) => (
              <div className="flex justify-end gap-1">
                <Boton chico variante="secundario" onClick={() => setMovimiento(i)}>Movimiento</Boton>
                <Boton chico variante="fantasma" icono={<RecentlyViewed size={16} />} aria-label="Historial" onClick={() => setHistorial(i)} />
                <Boton chico variante="fantasma" icono={<Edit size={16} />} aria-label="Editar" onClick={() => setEditando(i)} />
              </div>
            ),
          },
        ]}
      />
      {editando && <FormularioInsumo insumo={editando === 'nuevo' ? undefined : editando} alCerrar={() => setEditando(null)} />}
      {movimiento && <FormularioMovimiento insumo={movimiento} alCerrar={() => setMovimiento(null)} />}
      {historial && <HistorialInsumo insumo={historial} alCerrar={() => setHistorial(null)} />}
    </>
  )
}

const esquemaInsumo = z.object({
  clinica_id: idRequerido('Elegí la clínica'),
  nombre: z.string().min(2, 'Ingresá el nombre'),
  unidad: z.string().min(1, 'Ingresá la unidad'),
  stock_minimo: numeroRequerido(),
  activo: z.boolean(),
})

function FormularioInsumo({ insumo, alCerrar }: { insumo?: Insumo; alCerrar: () => void }) {
  const usuario = useAuth((s) => s.usuario)!
  const { data: clinicas } = useClinicas()
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaInsumo),
    defaultValues: {
      clinica_id: insumo?.clinica_id ?? usuario.clinica_id ?? '',
      nombre: insumo?.nombre ?? '',
      unidad: insumo?.unidad ?? 'u',
      stock_minimo: insumo?.stock_minimo ?? 0,
      activo: insumo?.activo ?? true,
    },
  })
  const guardar = useMutacion(
    (d: z.output<typeof esquemaInsumo>) => (insumo ? gestionApi.editarInsumo(insumo.id, d) : gestionApi.crearInsumo(d)),
    { exito: 'Insumo guardado', invalidar: ['insumos', 'tablero'], alTerminar: alCerrar },
  )
  return (
    <Modal
      abierto
      titulo={insumo ? 'Editar insumo' : 'Nuevo insumo'}
      alCerrar={alCerrar}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-insumo" cargando={guardar.isPending}>Guardar</Boton></>}
    >
      <form id="form-insumo" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Clínica" error={formState.errors.clinica_id?.message} className="sm:col-span-2">
          <Seleccion disabled={usuario.rol !== 'ADMIN'} {...register('clinica_id')}>
            <option value="">Seleccioná…</option>
            {clinicas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Nombre" error={formState.errors.nombre?.message} className="sm:col-span-2"><Entrada {...register('nombre')} /></Campo>
        <Campo etiqueta="Unidad" error={formState.errors.unidad?.message}><Entrada {...register('unidad')} /></Campo>
        <Campo etiqueta="Stock mínimo" error={formState.errors.stock_minimo?.message}><Entrada type="number" min="0" {...register('stock_minimo')} /></Campo>
        {insumo && <Casilla etiqueta="Activo" {...register('activo')} />}
      </form>
      {!insumo && <p className="mt-3 text-xs text-slate-500">El stock inicial se carga después con un movimiento de ingreso.</p>}
    </Modal>
  )
}

const esquemaMovimiento = z.object({
  tipo: z.enum(['INGRESO', 'EGRESO', 'AJUSTE']),
  cantidad: numeroRequerido('Ingresá la cantidad').pipe(z.number().min(0, 'No puede ser negativa')),
  motivo: z.string().min(2, 'Indicá el motivo'),
})

function FormularioMovimiento({ insumo, alCerrar }: { insumo: Insumo; alCerrar: () => void }) {
  const { register, handleSubmit, formState, watch } = useForm({
    resolver: zodResolver(esquemaMovimiento),
    defaultValues: { tipo: 'INGRESO', cantidad: '', motivo: '' },
  })
  const guardar = useMutacion((d: z.output<typeof esquemaMovimiento>) => gestionApi.registrarMovimiento(insumo.id, d), {
    exito: (m) => `Movimiento registrado. Stock actual: ${m.stock_resultante} ${insumo.unidad}`,
    invalidar: ['insumos', 'movimientos', 'tablero'],
    alTerminar: alCerrar,
  })
  return (
    <Modal
      abierto
      titulo={`Movimiento · ${insumo.nombre}`}
      alCerrar={alCerrar}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-mov" cargando={guardar.isPending}>Registrar</Boton></>}
    >
      <p className="mb-4 text-sm text-slate-500">Stock actual: {insumo.stock_actual} {insumo.unidad}</p>
      <form id="form-mov" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Tipo">
          <Seleccion {...register('tipo')}>
            <option value="INGRESO">Ingreso (compra / reposición)</option>
            <option value="EGRESO">Egreso (consumo)</option>
            <option value="AJUSTE">Ajuste de inventario</option>
          </Seleccion>
        </Campo>
        <Campo
          etiqueta={watch('tipo') === 'AJUSTE' ? 'Stock contado' : 'Cantidad'}
          error={formState.errors.cantidad?.message}
        >
          <Entrada type="number" min="0" step="any" {...register('cantidad')} />
        </Campo>
        <Campo etiqueta="Motivo" error={formState.errors.motivo?.message} className="sm:col-span-2"><Entrada {...register('motivo')} /></Campo>
      </form>
    </Modal>
  )
}

function HistorialInsumo({ insumo, alCerrar }: { insumo: Insumo; alCerrar: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['movimientos', insumo.id], queryFn: () => gestionApi.movimientos(insumo.id) })
  return (
    <Modal abierto ancho="lg" titulo={`Movimientos · ${insumo.nombre}`} alCerrar={alCerrar}>
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(m) => m.id}
        columnas={[
          { titulo: 'Fecha', celda: (m) => fechaHora(m.fecha) },
          { titulo: 'Tipo', celda: (m) => <Insignia color={m.tipo === 'INGRESO' ? 'verde' : m.tipo === 'EGRESO' ? 'ambar' : 'gris'}>{m.tipo}</Insignia> },
          { titulo: 'Cantidad', className: 'text-right', celda: (m) => <span className="tabular-nums">{m.cantidad}</span> },
          { titulo: 'Stock', className: 'text-right', celda: (m) => <span className="tabular-nums">{m.stock_resultante}</span> },
          { titulo: 'Motivo', celda: (m) => m.motivo },
        ]}
      />
    </Modal>
  )
}

// ---------------- Conservadoras ----------------
function Conservadoras({ clinicaId }: { clinicaId: number | '' }) {
  const { data, isLoading } = useQuery({ queryKey: ['conservadoras', clinicaId], queryFn: () => gestionApi.conservadoras({ clinica_id: clinicaId }) })
  const [editando, setEditando] = useState<Conservadora | 'nueva' | null>(null)
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Boton icono={<Add size={16} />} onClick={() => setEditando('nueva')}>Nueva conservadora</Boton>
      </div>
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(c) => c.id}
        columnas={[
          { titulo: 'Código', celda: (c) => <span className="font-mono text-xs font-medium">{c.codigo}</span> },
          { titulo: 'Descripción', celda: (c) => c.descripcion },
          { titulo: 'Clínica', celda: (c) => c.clinica.nombre },
          { titulo: 'Capacidad', className: 'text-center', celda: (c) => c.capacidad },
          { titulo: 'Rango', celda: (c) => `${temperatura(c.temperatura_min)} a ${temperatura(c.temperatura_max)}` },
          { titulo: 'Estado', celda: (c) => <ConservadoraInsignia estado={c.estado} /> },
          {
            titulo: '',
            className: 'text-right',
            celda: (c) =>
              c.estado !== 'EN_USO' && <Boton chico variante="fantasma" icono={<Edit size={16} />} aria-label="Editar" onClick={() => setEditando(c)} />,
          },
        ]}
      />
      {editando && <FormularioConservadora conservadora={editando === 'nueva' ? undefined : editando} alCerrar={() => setEditando(null)} />}
    </>
  )
}

const esquemaConservadora = z
  .object({
    codigo: z.string().min(2, 'Ingresá el código'),
    clinica_id: idRequerido('Elegí la clínica'),
    descripcion: z.string().min(2, 'Ingresá una descripción'),
    capacidad: numeroRequerido().pipe(z.number().int().min(1, 'Mínimo 1')),
    temperatura_min: numeroRequerido(),
    temperatura_max: numeroRequerido(),
    estado: z.enum(['DISPONIBLE', 'MANTENIMIENTO', 'BAJA']),
  })
  .refine((d) => d.temperatura_min < d.temperatura_max, { message: 'Debe ser mayor a la mínima', path: ['temperatura_max'] })

function FormularioConservadora({ conservadora, alCerrar }: { conservadora?: Conservadora; alCerrar: () => void }) {
  const usuario = useAuth((s) => s.usuario)!
  const { data: clinicas } = useClinicas()
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(esquemaConservadora),
    defaultValues: {
      codigo: conservadora?.codigo ?? '',
      clinica_id: conservadora?.clinica_id ?? usuario.clinica_id ?? '',
      descripcion: conservadora?.descripcion ?? '',
      capacidad: conservadora?.capacidad ?? 8,
      temperatura_min: conservadora?.temperatura_min ?? 2,
      temperatura_max: conservadora?.temperatura_max ?? 8,
      estado: conservadora && conservadora.estado !== 'EN_USO' ? conservadora.estado : 'DISPONIBLE',
    },
  })
  const guardar = useMutacion(
    (d: z.output<typeof esquemaConservadora>) =>
      conservadora ? gestionApi.editarConservadora(conservadora.id, d) : gestionApi.crearConservadora(d),
    { exito: 'Conservadora guardada', invalidar: ['conservadoras'], alTerminar: alCerrar },
  )
  const e = formState.errors
  return (
    <Modal
      abierto
      titulo={conservadora ? 'Editar conservadora' : 'Nueva conservadora'}
      alCerrar={alCerrar}
      pie={<><Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton><Boton type="submit" form="form-cons" cargando={guardar.isPending}>Guardar</Boton></>}
    >
      <form id="form-cons" onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Campo etiqueta="Código" error={e.codigo?.message}><Entrada {...register('codigo')} /></Campo>
        <Campo etiqueta="Clínica" error={e.clinica_id?.message}>
          <Seleccion disabled={usuario.rol !== 'ADMIN'} {...register('clinica_id')}>
            <option value="">Seleccioná…</option>
            {clinicas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Seleccion>
        </Campo>
        <Campo etiqueta="Descripción" error={e.descripcion?.message} className="sm:col-span-2"><Entrada {...register('descripcion')} /></Campo>
        <Campo etiqueta="Capacidad (muestras)" error={e.capacidad?.message}><Entrada type="number" min="1" {...register('capacidad')} /></Campo>
        <Campo etiqueta="Estado">
          <Seleccion {...register('estado')}>
            <option value="DISPONIBLE">Disponible</option>
            <option value="MANTENIMIENTO">Mantenimiento</option>
            <option value="BAJA">Baja</option>
          </Seleccion>
        </Campo>
        <Campo etiqueta="Temperatura mínima (°C)" error={e.temperatura_min?.message}><Entrada type="number" step="0.5" {...register('temperatura_min')} /></Campo>
        <Campo etiqueta="Temperatura máxima (°C)" error={e.temperatura_max?.message}><Entrada type="number" step="0.5" {...register('temperatura_max')} /></Campo>
      </form>
    </Modal>
  )
}
