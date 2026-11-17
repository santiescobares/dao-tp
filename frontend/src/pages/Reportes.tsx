import { Download } from '@carbon/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { reportesApi } from '../api/servicios'
import type { FiltroReporte, TipoItem } from '../api/tipos'
import { BarrasApiladas, BarrasHorizontales, Lineas } from '../components/Graficos'
import { Boton } from '../components/ui/Boton'
import { Campo, Entrada, Seleccion } from '../components/ui/Campos'
import { Insignia } from '../components/ui/Insignias'
import { Cargando, EncabezadoPagina, Kpi, Pestanas, Tarjeta } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { useClinicas } from '../hooks/useCatalogos'
import { useAuth } from '../stores/auth'
import {
  descargarCSV,
  ETIQUETA_MOTIVO,
  ETIQUETA_SERVICIO,
  fecha,
  fechaHora,
  horas,
  hoyISO,
  mesLegible,
  moneda,
} from '../utils/formato'

type Reporte = 'atenciones' | 'rechazos' | 'tiempos' | 'facturacion' | 'tratamientos'

const PESTANAS: { valor: Reporte; etiqueta: string }[] = [
  { valor: 'atenciones', etiqueta: 'Atenciones y derivaciones' },
  { valor: 'rechazos', etiqueta: 'Rechazos en transporte' },
  { valor: 'tiempos', etiqueta: 'Tiempos' },
  { valor: 'facturacion', etiqueta: 'Facturación' },
  { valor: 'tratamientos', etiqueta: 'Tratamientos y vacunas' },
]

export default function Reportes() {
  const esVeterinario = useAuth((s) => s.tieneRol('VETERINARIO'))
  const { data: clinicas } = useClinicas()
  const [reporte, setReporte] = useState<Reporte>('atenciones')
  const [filtro, setFiltro] = useState<FiltroReporte>({ desde: hoyISO(-180), hasta: hoyISO(), clinica_id: '' })

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes de gestión"
        descripcion={esVeterinario ? 'Datos de tu clínica' : 'Indicadores de toda la red'}
      />
      <Pestanas opciones={PESTANAS} activa={reporte} alCambiar={setReporte} />
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Desde"><Entrada type="date" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} /></Campo>
        <Campo etiqueta="Hasta"><Entrada type="date" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} /></Campo>
        {!esVeterinario && (
          <Campo etiqueta="Clínica">
            <Seleccion value={filtro.clinica_id} onChange={(e) => setFiltro({ ...filtro, clinica_id: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">Toda la red</option>
              {clinicas?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Seleccion>
          </Campo>
        )}
      </div>
      {reporte === 'atenciones' && <ReporteAtenciones filtro={filtro} />}
      {reporte === 'rechazos' && <ReporteRechazos filtro={filtro} />}
      {reporte === 'tiempos' && <ReporteTiempos filtro={filtro} />}
      {reporte === 'facturacion' && <ReporteFacturacion filtro={filtro} />}
      {reporte === 'tratamientos' && <ReporteTratamientos filtro={filtro} />}
    </>
  )
}

function BotonCSV({ nombre, filas }: { nombre: string; filas: object[] }) {
  return (
    <Boton variante="fantasma" chico icono={<Download size={14} />} disabled={!filas.length} onClick={() => descargarCSV(nombre, filas as Record<string, unknown>[])}>
      CSV
    </Boton>
  )
}

const Grilla = ({ children }: { children: ReactNode }) => <div className="grid gap-6 lg:grid-cols-2">{children}</div>
const Kpis = ({ children }: { children: ReactNode }) => <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>

// ---------------------------------------------------------------- 1
function ReporteAtenciones({ filtro }: { filtro: FiltroReporte }) {
  const { data } = useQuery({ queryKey: ['reporte-atenciones', filtro], queryFn: () => reportesApi.atenciones(filtro) })
  if (!data) return <Cargando />
  const { resumen } = data
  return (
    <>
      <Kpis>
        <Kpi etiqueta="Atenciones" valor={resumen.total_atenciones} />
        <Kpi etiqueta="Con derivación" valor={resumen.con_derivacion} detalle={`${resumen.porcentaje_derivacion} % de las atenciones`} />
        <Kpi etiqueta="Muestras derivadas" valor={resumen.total_muestras} />
        <Kpi etiqueta="Muestras por derivación" valor={resumen.con_derivacion ? (resumen.total_muestras / resumen.con_derivacion).toFixed(1) : '—'} />
      </Kpis>
      <Grilla>
        <Tarjeta titulo="Atenciones por mes y tipo">
          <BarrasApiladas
            datos={data.por_mes}
            ejeX="mes"
            etiquetaX={mesLegible}
            series={[{ clave: 'CONSULTA', nombre: 'Consultas' }, { clave: 'CONTROL', nombre: 'Controles' }, { clave: 'URGENCIA', nombre: 'Urgencias' }]}
          />
        </Tarjeta>
        <Tarjeta titulo="Análisis más derivados">
          <BarrasHorizontales datos={data.top_analisis} ejeY="analisis" valor="cantidad" nombre="Muestras" />
        </Tarjeta>
      </Grilla>
      <Tarjeta titulo="Detalle por clínica" className="mt-6" acciones={<BotonCSV nombre="atenciones-por-clinica" filas={data.por_clinica} />}>
        <Tabla
          filas={data.por_clinica}
          clave={(f) => f.clinica}
          columnas={[
            { titulo: 'Clínica', celda: (f) => <span className="font-medium">{f.clinica}</span> },
            { titulo: 'Consultas', className: 'text-right tabular-nums', celda: (f) => f.consultas },
            { titulo: 'Controles', className: 'text-right tabular-nums', celda: (f) => f.controles },
            { titulo: 'Urgencias', className: 'text-right tabular-nums', celda: (f) => f.urgencias },
            { titulo: 'Total', className: 'text-right tabular-nums font-medium', celda: (f) => f.total },
            { titulo: 'Con derivación', className: 'text-right tabular-nums', celda: (f) => `${f.con_derivacion} (${f.porcentaje_derivacion} %)` },
          ]}
        />
      </Tarjeta>
    </>
  )
}

// ---------------------------------------------------------------- 2
function ReporteRechazos({ filtro }: { filtro: FiltroReporte }) {
  const { data } = useQuery({ queryKey: ['reporte-rechazos', filtro], queryFn: () => reportesApi.rechazos(filtro) })
  if (!data) return <Cargando />
  const motivos = data.por_motivo.map((m) => ({ ...m, motivo: ETIQUETA_MOTIVO[m.motivo] })).sort((a, b) => b.cantidad - a.cantidad)
  return (
    <>
      <Kpis>
        <Kpi etiqueta="Muestras enviadas" valor={data.resumen.enviadas} />
        <Kpi etiqueta="Rechazadas por transporte" valor={data.resumen.rechazadas} tono="alerta" />
        <Kpi etiqueta="Tasa de rechazo" valor={`${data.resumen.tasa_rechazo} %`} tono={data.resumen.tasa_rechazo > 10 ? 'alerta' : 'normal'} />
        <Kpi etiqueta="Motivo principal" valor={<span className="text-base">{motivos[0]?.motivo ?? '—'}</span>} />
      </Kpis>
      <Grilla>
        <Tarjeta titulo="Rechazos por motivo">
          <BarrasHorizontales datos={motivos} ejeY="motivo" valor="cantidad" nombre="Muestras" />
        </Tarjeta>
        <Tarjeta titulo="Tasa de rechazo por clínica (%)">
          <BarrasHorizontales datos={data.por_clinica} ejeY="clinica" valor="tasa_rechazo" nombre="Tasa" formato={(v) => `${v} %`} />
        </Tarjeta>
      </Grilla>
      <Tarjeta titulo="Por transportista" className="mt-6" acciones={<BotonCSV nombre="rechazos-por-transportista" filas={data.por_transportista} />}>
        <Tabla
          filas={data.por_transportista}
          clave={(f) => f.transportista}
          columnas={[
            { titulo: 'Transportista', celda: (f) => <span className="font-medium">{f.transportista}</span> },
            { titulo: 'Remitos', className: 'text-right tabular-nums', celda: (f) => f.remitos },
            { titulo: 'Remitos rechazados', className: 'text-right tabular-nums', celda: (f) => f.remitos_rechazados },
            { titulo: 'Muestras rechazadas', className: 'text-right tabular-nums', celda: (f) => f.muestras_rechazadas },
          ]}
        />
      </Tarjeta>
      <Tarjeta titulo="Detalle de muestras rechazadas" className="mt-6" acciones={<BotonCSV nombre="muestras-rechazadas" filas={data.detalle} />}>
        <Tabla
          filas={data.detalle}
          clave={(f) => f.codigo}
          vacio="Sin rechazos en el período."
          columnas={[
            { titulo: 'Muestra', celda: (f) => <span className="font-mono text-xs">{f.codigo}</span> },
            { titulo: 'Análisis', celda: (f) => f.analisis },
            { titulo: 'Clínica', celda: (f) => f.clinica },
            { titulo: 'Remito', celda: (f) => f.remito },
            { titulo: 'Transportista', celda: (f) => f.transportista ?? '—' },
            { titulo: 'Motivo', celda: (f) => <Insignia color="rojo">{ETIQUETA_MOTIVO[f.motivo]}</Insignia> },
            { titulo: 'Recepción', celda: (f) => fechaHora(f.fecha) },
          ]}
        />
      </Tarjeta>
    </>
  )
}

// ---------------------------------------------------------------- 3
function ReporteTiempos({ filtro }: { filtro: FiltroReporte }) {
  const { data } = useQuery({ queryKey: ['reporte-tiempos', filtro], queryFn: () => reportesApi.tiempos(filtro) })
  if (!data) return <Cargando />
  const r = data.resumen
  const series = [
    { clave: 'transito_promedio_h', nombre: 'Tránsito (despacho → recepción)' },
    { clave: 'procesamiento_promedio_h', nombre: 'Procesamiento (recepción → resultado)' },
  ]
  return (
    <>
      <Kpis>
        <Kpi etiqueta="Tránsito promedio" valor={horas(r.transito_promedio_h)} detalle={`Máximo ${horas(r.transito_maximo_h)}`} />
        <Kpi etiqueta="Procesamiento promedio" valor={horas(r.procesamiento_promedio_h)} detalle={`Máximo ${horas(r.procesamiento_maximo_h)}`} />
        <Kpi etiqueta="Ciclo completo" valor={horas(r.ciclo_completo_promedio_h)} detalle="Extracción → resultado" />
        <Kpi etiqueta="Muestras medidas" valor={r.muestras_medidas} detalle="Según el historial de estados" />
      </Kpis>
      <Tarjeta titulo="Evolución mensual de los tiempos promedio (horas)">
        <Lineas datos={data.por_mes} ejeX="mes" etiquetaX={mesLegible} series={series} formato={(v) => `${v} h`} />
      </Tarjeta>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <TablaTiempos titulo="Por clínica" columna="Clínica" archivo="tiempos-por-clinica" filas={data.por_clinica.map((f) => ({ ...f, nombre: f.clinica }))} />
        <TablaTiempos titulo="Por tipo de análisis" columna="Análisis" archivo="tiempos-por-analisis" filas={data.por_analisis.map((f) => ({ ...f, nombre: f.analisis }))} />
      </div>
    </>
  )
}

interface FilaTiempo {
  nombre: string
  transito_promedio_h: number | null
  procesamiento_promedio_h: number | null
  muestras: number
}

function TablaTiempos({ titulo, columna, archivo, filas }: { titulo: string; columna: string; archivo: string; filas: FilaTiempo[] }) {
  return (
    <Tarjeta titulo={titulo} acciones={<BotonCSV nombre={archivo} filas={filas} />}>
      <Tabla
        filas={filas}
        clave={(f) => f.nombre}
        columnas={[
          { titulo: columna, celda: (f) => <span className="font-medium">{f.nombre}</span> },
          { titulo: 'Tránsito', className: 'text-right tabular-nums', celda: (f) => horas(f.transito_promedio_h) },
          { titulo: 'Proceso', className: 'text-right tabular-nums', celda: (f) => horas(f.procesamiento_promedio_h) },
          { titulo: 'Muestras', className: 'text-right tabular-nums', celda: (f) => f.muestras },
        ]}
      />
    </Tarjeta>
  )
}

// ---------------------------------------------------------------- 4
const SERVICIOS: TipoItem[] = ['CONSULTA', 'CONTROL', 'URGENCIA', 'VACUNA', 'LABORATORIO']

function ReporteFacturacion({ filtro }: { filtro: FiltroReporte }) {
  const { data } = useQuery({ queryKey: ['reporte-facturacion', filtro], queryFn: () => reportesApi.facturacion(filtro) })
  if (!data) return <Cargando />
  const series = SERVICIOS.map((s) => ({ clave: s, nombre: ETIQUETA_SERVICIO[s] }))
  const laboratorio = data.por_servicio.find((s) => s.servicio === 'LABORATORIO')
  return (
    <>
      <Kpis>
        <Kpi etiqueta="Total facturado" valor={moneda(data.resumen.total_facturado)} />
        <Kpi etiqueta="Comprobantes" valor={data.resumen.comprobantes} />
        <Kpi etiqueta="Ticket promedio" valor={moneda(data.resumen.ticket_promedio)} />
        <Kpi etiqueta="Servicios de laboratorio" valor={moneda(laboratorio?.total ?? 0)} detalle={`${laboratorio?.porcentaje ?? 0} % del total`} />
      </Kpis>
      <Grilla>
        <Tarjeta titulo="Facturación por clínica y servicio">
          <BarrasApiladas datos={data.por_clinica} ejeX="clinica" series={series} formato={moneda} alto={300} />
        </Tarjeta>
        <Tarjeta titulo="Facturación mensual por servicio">
          <BarrasApiladas datos={data.por_mes} ejeX="mes" etiquetaX={mesLegible} series={series} formato={moneda} alto={300} />
        </Tarjeta>
      </Grilla>
      <Tarjeta titulo="Desglose por clínica" className="mt-6" acciones={<BotonCSV nombre="facturacion-por-clinica" filas={data.por_clinica} />}>
        <Tabla
          filas={data.por_clinica}
          clave={(f) => f.clinica}
          columnas={[
            { titulo: 'Clínica', celda: (f) => <span className="font-medium">{f.clinica}</span> },
            ...SERVICIOS.map((s) => ({ titulo: ETIQUETA_SERVICIO[s], className: 'text-right tabular-nums', celda: (f: (typeof data.por_clinica)[number]) => moneda(f[s]) })),
            { titulo: 'Total', className: 'text-right tabular-nums font-semibold', celda: (f) => moneda(f.total) },
          ]}
        />
      </Tarjeta>
    </>
  )
}

// ---------------------------------------------------------------- 5
function ReporteTratamientos({ filtro }: { filtro: FiltroReporte }) {
  const { data } = useQuery({ queryKey: ['reporte-tratamientos', filtro], queryFn: () => reportesApi.tratamientosVacunas(filtro) })
  if (!data) return <Cargando />
  const resumenVacunas = data.resumen_vacunas.map((v) => ({ ...v, etiqueta: `${v.vacuna} (${v.especie})` }))
  return (
    <>
      <Kpis>
        <Kpi etiqueta="Tratamientos aplicados" valor={data.resumen.tratamientos} detalle="En el período" />
        <Kpi etiqueta="Mascotas con vacunas pendientes" valor={data.resumen.mascotas_con_pendientes} tono="alerta" />
        <Kpi etiqueta="Vacunas obligatorias pendientes" valor={data.resumen.vacunas_pendientes} detalle="Al día de hoy" />
        <Kpi etiqueta="Medicación más indicada" valor={<span className="text-base">{data.tratamientos_por_medicamento[0]?.medicamento ?? '—'}</span>} />
      </Kpis>
      <Grilla>
        <Tarjeta titulo="Vacunas obligatorias pendientes">
          <BarrasHorizontales datos={resumenVacunas} ejeY="etiqueta" valor="pendientes" nombre="Mascotas" />
        </Tarjeta>
        <Tarjeta titulo="Tratamientos por medicamento" acciones={<BotonCSV nombre="tratamientos-por-medicamento" filas={data.tratamientos_por_medicamento} />}>
          <Tabla
            filas={data.tratamientos_por_medicamento.slice(0, 10)}
            clave={(f) => `${f.medicamento}-${f.especie}`}
            columnas={[
              { titulo: 'Medicamento', celda: (f) => f.medicamento },
              { titulo: 'Especie', celda: (f) => f.especie },
              { titulo: 'Indicaciones', className: 'text-right tabular-nums', celda: (f) => f.cantidad },
            ]}
          />
        </Tarjeta>
      </Grilla>
      <Tarjeta titulo="Mascotas a contactar por vacunas pendientes" className="mt-6" acciones={<BotonCSV nombre="vacunas-pendientes" filas={data.vacunas_pendientes} />}>
        <Tabla
          filas={data.vacunas_pendientes}
          clave={(f) => `${f.mascota_id}-${f.vacuna}`}
          vacio="Todas las mascotas tienen el esquema obligatorio al día."
          columnas={[
            { titulo: 'Mascota', celda: (f) => <Link to={`/mascotas/${f.mascota_id}`} className="font-medium text-marca-700 hover:underline">{f.mascota}</Link> },
            { titulo: 'Especie', celda: (f) => f.especie },
            { titulo: 'Vacuna', celda: (f) => f.vacuna },
            { titulo: 'Situación', celda: (f) => (f.situacion === 'NUNCA_APLICADA' ? <Insignia color="ambar">Nunca aplicada</Insignia> : <Insignia color="rojo">Vencida {fecha(f.vencimiento)}</Insignia>) },
            { titulo: 'Responsable', celda: (f) => f.responsable },
            { titulo: 'Teléfono', celda: (f) => f.telefono },
          ]}
        />
      </Tarjeta>
    </>
  )
}
