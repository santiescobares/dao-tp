import type {
  EstadoConservadora,
  EstadoMuestra,
  EstadoRemito,
  MotivoRechazo,
  TipoAtencion,
  TipoItem,
  TipoMuestra,
} from '../api/tipos'

const formatoFecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const formatoFechaHora = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

/** Las fechas "YYYY-MM-DD" se interpretan en hora local (no UTC). */
const aFecha = (valor: string) => new Date(valor.length === 10 ? `${valor}T00:00:00` : valor)

export const fecha = (valor: string | null | undefined) => (valor ? formatoFecha.format(aFecha(valor)) : '—')
export const fechaHora = (valor: string | null | undefined) => (valor ? formatoFechaHora.format(aFecha(valor)) : '—')
export const moneda = (valor: number) => formatoMoneda.format(valor)
export const horas = (valor: number | null | undefined) => (valor == null ? '—' : `${valor.toLocaleString('es-AR')} h`)
export const temperatura = (valor: number | null | undefined) => (valor == null ? '—' : `${valor.toLocaleString('es-AR')} °C`)

export function edad(fechaNacimiento: string): string {
  const meses = Math.floor((Date.now() - aFecha(fechaNacimiento).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(meses / 12)
  return `${anios} ${anios === 1 ? 'año' : 'años'}`
}

/** Fecha de hoy en formato YYYY-MM-DD (hora local) para inputs de tipo date. */
export function hoyISO(desplazamientoDias = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + desplazamientoDias)
  return d.toLocaleDateString('sv-SE')
}

export const mesLegible = (mes: string) => {
  const [anio, numero] = mes.split('-').map(Number)
  return new Date(anio, numero - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

// ---------- Etiquetas de enumeraciones ----------
export const ETIQUETA_ESTADO_MUESTRA: Record<EstadoMuestra, string> = {
  EXTRAIDA: 'Extraída',
  EMPAQUETADA: 'Empaquetada',
  EN_TRANSITO: 'En tránsito',
  RECIBIDA: 'Recibida',
  ANALIZADA: 'Analizada',
  RECHAZADA: 'Rechazada',
}
export const ETIQUETA_ESTADO_REMITO: Record<EstadoRemito, string> = {
  PREPARADO: 'Preparado',
  EN_TRANSITO: 'En tránsito',
  RECIBIDO: 'Recibido',
  RECHAZADO: 'Rechazado',
}
export const ETIQUETA_MOTIVO: Record<MotivoRechazo, string> = {
  PRECINTO_ROTO: 'Precinto roto',
  TEMPERATURA_FUERA_RANGO: 'Temperatura fuera de rango',
  TIEMPO_EXCEDIDO: 'Tiempo de viabilidad excedido',
  MUESTRA_NO_APTA: 'Muestra no apta',
}
export const ETIQUETA_TIPO_ATENCION: Record<TipoAtencion, string> = {
  CONSULTA: 'Consulta',
  CONTROL: 'Control',
  URGENCIA: 'Urgencia',
}
export const ETIQUETA_SERVICIO: Record<TipoItem, string> = {
  CONSULTA: 'Consultas',
  CONTROL: 'Controles',
  URGENCIA: 'Urgencias',
  VACUNA: 'Vacunas',
  LABORATORIO: 'Laboratorio',
}
export const ETIQUETA_TIPO_MUESTRA: Record<TipoMuestra, string> = {
  SANGRE: 'Sangre',
  ORINA: 'Orina',
  HECES: 'Heces',
  TEJIDO: 'Tejido',
  HISOPADO: 'Hisopado',
}
export const ETIQUETA_CONSERVADORA: Record<EstadoConservadora, string> = {
  DISPONIBLE: 'Disponible',
  EN_USO: 'En uso',
  MANTENIMIENTO: 'Mantenimiento',
  BAJA: 'Baja',
}
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** Descarga una tabla como CSV (separador ";" para que Excel en español la abra bien). */
export function descargarCSV(nombre: string, filas: Record<string, unknown>[]): void {
  if (filas.length === 0) return
  const columnas = Object.keys(filas[0])
  const escapar = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const contenido = [columnas.join(';'), ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(';'))].join('\n')
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${nombre}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}
