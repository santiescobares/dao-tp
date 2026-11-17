/** Tipos que reflejan los schemas de la API (backend/app/schemas). */

export type Rol = 'ADMIN' | 'VETERINARIO' | 'LABORATORISTA'
export type TipoProfesional = 'VETERINARIO' | 'LABORATORISTA'
export type Sexo = 'MACHO' | 'HEMBRA'
export type TipoAtencion = 'CONSULTA' | 'CONTROL' | 'URGENCIA'
export type TipoMuestra = 'SANGRE' | 'ORINA' | 'HECES' | 'TEJIDO' | 'HISOPADO'
export type EstadoMuestra = 'EXTRAIDA' | 'EMPAQUETADA' | 'EN_TRANSITO' | 'RECIBIDA' | 'ANALIZADA' | 'RECHAZADA'
export type EstadoRemito = 'PREPARADO' | 'EN_TRANSITO' | 'RECIBIDO' | 'RECHAZADO'
export type MotivoRechazo = 'PRECINTO_ROTO' | 'TEMPERATURA_FUERA_RANGO' | 'TIEMPO_EXCEDIDO' | 'MUESTRA_NO_APTA'
export type EstadoPrecinto = 'INTACTO' | 'ROTO'
export type EstadoConservadora = 'DISPONIBLE' | 'EN_USO' | 'MANTENIMIENTO' | 'BAJA'
export type TipoEventoEnvio = 'DESPACHO' | 'PUNTO_CONTROL' | 'ENTREGA'
export type TipoMovimiento = 'INGRESO' | 'EGRESO' | 'AJUSTE'
export type TipoTurno = 'ATENCION' | 'PROCESAMIENTO'
export type EstadoTurno = 'RESERVADO' | 'ATENDIDO' | 'CANCELADO'
export type TipoItem = 'CONSULTA' | 'CONTROL' | 'URGENCIA' | 'VACUNA' | 'LABORATORIO'

// ---------- Organización ----------
export interface Usuario {
  id: number
  email: string
  nombre: string
  rol: Rol
  activo: boolean
  profesional_id: number | null
  clinica_id: number | null
}
export interface UsuarioEntrada {
  email: string
  nombre: string
  rol: Rol
  profesional_id: number | null
  activo: boolean
  password?: string | null
}
export interface ClinicaResumen {
  id: number
  nombre: string
}
export interface Clinica extends ClinicaResumen {
  direccion: string
  telefono: string
  activa: boolean
}
export type ClinicaEntrada = Omit<Clinica, 'id'>
export interface ProfesionalResumen {
  id: number
  nombre_completo: string
  matricula: string
  tipo: TipoProfesional
}
export interface Profesional extends ProfesionalResumen {
  nombre: string
  apellido: string
  especialidad: string
  clinica_id: number | null
  clinica: ClinicaResumen | null
  activo: boolean
}
export type ProfesionalEntrada = Omit<Profesional, 'id' | 'nombre_completo' | 'clinica'>

// ---------- Catálogos ----------
export interface Especie {
  id: number
  nombre: string
}
export interface Vacuna {
  id: number
  nombre: string
  especie_id: number
  especie: Especie
  obligatoria: boolean
  edad_minima_semanas: number
  refuerzo_meses: number | null
  precio: number
}
export type VacunaEntrada = Omit<Vacuna, 'id' | 'especie'>
export interface TipoAnalisis {
  id: number
  nombre: string
  tipo_muestra: TipoMuestra
  precio: number
  temperatura_min: number
  temperatura_max: number
  horas_viabilidad: number
  activo: boolean
}
export type TipoAnalisisEntrada = Omit<TipoAnalisis, 'id'>

// ---------- Clínica ----------
export interface ClienteResumen {
  id: number
  dni: string
  nombre_completo: string
  telefono: string
  email: string | null
}
export interface Cliente extends ClienteResumen {
  nombre: string
  apellido: string
  direccion: string | null
  fecha_alta: string
  cantidad_mascotas: number
}
export interface ClienteEntrada {
  dni: string
  nombre: string
  apellido: string
  telefono: string
  email?: string | null
  direccion?: string | null
}
export interface HistoriaResumen {
  id: number
  numero: string
  fecha_apertura: string
  alergias: string | null
  observaciones: string | null
}
export interface MascotaResumen {
  id: number
  nombre: string
  especie: Especie
  raza: string | null
}
export interface Mascota extends MascotaResumen {
  especie_id: number
  sexo: Sexo
  fecha_nacimiento: string
  peso_kg: number | null
  cliente_id: number
  responsable: ClienteResumen
  activa: boolean
  historia: HistoriaResumen
}
export interface MascotaEntrada {
  nombre: string
  especie_id: number
  raza?: string | null
  sexo: Sexo
  fecha_nacimiento: string
  peso_kg?: number | null
  cliente_id: number
  activa: boolean
}
export interface VacunaPendiente {
  vacuna_id: number
  nombre: string
  situacion: 'NUNCA_APLICADA' | 'REFUERZO_VENCIDO'
  ultima_aplicacion: string | null
  vencimiento: string | null
}
export interface Tratamiento {
  id: number
  descripcion: string
  medicamento: string | null
  dosis: string | null
  duracion_dias: number | null
}
export interface AplicacionVacuna {
  id: number
  vacuna_id: number
  nombre_vacuna: string
  fecha: string
  lote: string | null
}
export interface MuestraResumen {
  id: number
  codigo: string
  estado: EstadoMuestra
  motivo_rechazo: MotivoRechazo | null
  nombre_analisis: string
  tiene_resultado: boolean
}
export interface Orden {
  id: number
  numero: string
  fecha_emision: string
  urgente: boolean
  estado: 'PENDIENTE' | 'EN_CURSO' | 'FINALIZADA'
  observaciones: string | null
  muestras: MuestraResumen[]
}
export interface Atencion {
  id: number
  fecha: string
  tipo: TipoAtencion
  motivo: string
  diagnostico: string | null
  observaciones: string | null
  peso_kg: number | null
  clinica: ClinicaResumen
  profesional: ProfesionalResumen
  mascota: MascotaResumen
  responsable: ClienteResumen
  tratamientos: Tratamiento[]
  vacunas_aplicadas: AplicacionVacuna[]
  ordenes: Orden[]
  comprobante_id: number | null
}
export interface AtencionEntrada {
  mascota_id: number
  tipo: TipoAtencion
  motivo: string
  diagnostico?: string | null
  observaciones?: string | null
  peso_kg?: number | null
  turno_id?: number | null
  profesional_id?: number | null
  tratamientos: { descripcion: string; medicamento?: string | null; dosis?: string | null; duracion_dias?: number | null }[]
  vacunas: { vacuna_id: number; lote?: string | null }[]
  insumos: { insumo_id: number; cantidad: number }[]
  analisis: number[]
  derivacion_urgente: boolean
  observaciones_derivacion?: string | null
}
export interface AtencionRegistrada {
  atencion: Atencion
  advertencias: string[]
}
export interface HistoriaClinica {
  mascota: Mascota
  atenciones: Atencion[]
  vacunas_aplicadas: AplicacionVacuna[]
  vacunas_pendientes: VacunaPendiente[]
}

// ---------- Laboratorio y envíos ----------
export interface Muestra {
  id: number
  codigo: string
  estado: EstadoMuestra
  estado_descripcion: string
  es_final: boolean
  motivo_rechazo: MotivoRechazo | null
  fecha_extraccion: string
  tipo_analisis_id: number
  nombre_analisis: string
  tipo_muestra: TipoMuestra
  temperatura_min: number
  temperatura_max: number
  horas_viabilidad: number
  orden_id: number
  orden_numero: string
  urgente: boolean
  atencion_id: number
  mascota: string
  especie: string
  responsable: string
  clinica_id: number
  clinica: string
  remito_id: number | null
  remito_numero: string | null
  tiene_resultado: boolean
}
export interface RegistroHistorial {
  id: number
  estado_anterior: EstadoMuestra | null
  estado_nuevo: EstadoMuestra
  fecha: string
  usuario: string | null
  observacion: string | null
}
export interface Resultado {
  id: number
  fecha: string
  valores: string
  conclusion: string
  observaciones: string | null
  profesional: ProfesionalResumen
}
export interface Conservadora {
  id: number
  codigo: string
  clinica_id: number
  clinica: ClinicaResumen
  descripcion: string
  capacidad: number
  temperatura_min: number
  temperatura_max: number
  estado: EstadoConservadora
}
export type ConservadoraEntrada = Omit<Conservadora, 'id' | 'clinica'>
export interface EventoEnvio {
  id: number
  fecha: string
  tipo: TipoEventoEnvio
  ubicacion: string
  responsable: string
  temperatura: number | null
  fuera_de_rango: boolean
  observacion: string | null
}
export interface Recepcion {
  id: number
  fecha: string
  estado_precinto: EstadoPrecinto
  codigo_precinto_verificado: string
  temperatura_llegada: number | null
  aceptada: boolean
  observaciones: string | null
}
export interface Remito {
  id: number
  numero: string
  estado: EstadoRemito
  estado_descripcion: string
  clinica: ClinicaResumen
  laboratorio: string
  conservadora: Pick<Conservadora, 'id' | 'codigo' | 'descripcion' | 'temperatura_min' | 'temperatura_max'>
  fecha_emision: string
  fecha_despacho: string | null
  fecha_recepcion: string | null
  horas_en_transito: number | null
  transportista: string | null
  observaciones: string | null
  emisor: string | null
  precinto: { codigo: string; estado: EstadoPrecinto; fecha_colocacion: string; fecha_verificacion: string | null }
  muestras: Muestra[]
  eventos: EventoEnvio[]
  recepcion: Recepcion | null
}
export interface Trazabilidad {
  muestra: Muestra
  profesional_solicitante: string
  fecha_atencion: string
  historial: RegistroHistorial[]
  remito: Remito | null
  resultado: Resultado | null
}
export interface RecepcionEntrada {
  estado_precinto: EstadoPrecinto
  codigo_precinto: string
  temperatura_llegada?: number | null
  observaciones?: string | null
  rechazos: { muestra_id: number; motivo: MotivoRechazo }[]
}

// ---------- Stock, agenda y facturación ----------
export interface Insumo {
  id: number
  clinica_id: number
  clinica: ClinicaResumen
  nombre: string
  unidad: string
  stock_actual: number
  stock_minimo: number
  bajo_minimo: boolean
  activo: boolean
}
export interface InsumoEntrada {
  clinica_id: number
  nombre: string
  unidad: string
  stock_minimo: number
  activo: boolean
}
export interface Movimiento {
  id: number
  tipo: TipoMovimiento
  cantidad: number
  stock_resultante: number
  fecha: string
  motivo: string
  atencion_id: number | null
}
export interface Horario {
  id: number
  profesional_id: number
  dia_semana: number
  hora_desde: string
  hora_hasta: string
}
export interface Turno {
  id: number
  profesional_id: number
  profesional: ProfesionalResumen
  inicio: string
  fin: string
  tipo: TipoTurno
  estado: EstadoTurno
  motivo: string
  mascota_id: number | null
  mascota_nombre: string | null
  muestra_id: number | null
  muestra_codigo: string | null
}
export interface TurnoEntrada {
  profesional_id: number
  inicio: string
  fin: string
  tipo: TipoTurno
  motivo: string
  mascota_id?: number | null
  muestra_id?: number | null
}
export interface ItemComprobante {
  id: number
  concepto: string
  tipo: TipoItem
  cantidad: number
  precio_unitario: number
  subtotal: number
}
export interface Comprobante {
  id: number
  numero: string
  fecha: string
  total: number
  atencion_id: number
  clinica: ClinicaResumen
  mascota: string
  responsable: string
  responsable_dni: string
  profesional: string
  tipo_atencion: TipoAtencion
  items: ItemComprobante[]
}

// ---------- Reportes ----------
export interface Tablero {
  atenciones_hoy: number
  atenciones_mes: number
  muestras_por_estado: Partial<Record<EstadoMuestra, number>>
  remitos_en_transito: number
  turnos_hoy: number
  facturado_mes: number
  insumos_bajo_minimo: { id: number; nombre: string; clinica: string; stock_actual: number; stock_minimo: number; unidad: string }[]
}
export interface FiltroReporte {
  desde: string
  hasta: string
  clinica_id?: number | ''
}
export interface ReporteAtenciones {
  resumen: { total_atenciones: number; con_derivacion: number; porcentaje_derivacion: number; total_muestras: number }
  por_clinica: { clinica: string; consultas: number; controles: number; urgencias: number; total: number; con_derivacion: number; porcentaje_derivacion: number }[]
  por_mes: { mes: string; CONSULTA: number; CONTROL: number; URGENCIA: number; derivaciones: number }[]
  top_analisis: { analisis: string; cantidad: number }[]
}
export interface ReporteRechazos {
  resumen: { enviadas: number; rechazadas: number; tasa_rechazo: number }
  por_motivo: { motivo: MotivoRechazo; cantidad: number }[]
  por_clinica: { clinica: string; enviadas: number; rechazadas: number; tasa_rechazo: number }[]
  por_transportista: { transportista: string; remitos: number; remitos_rechazados: number; muestras_rechazadas: number }[]
  detalle: { codigo: string; analisis: string; clinica: string; remito: string; transportista: string | null; motivo: MotivoRechazo; fecha: string }[]
}
interface FilaTiempos {
  transito_promedio_h: number | null
  procesamiento_promedio_h: number | null
  muestras: number
}
export interface ReporteTiempos {
  resumen: {
    transito_promedio_h: number | null
    transito_maximo_h: number | null
    procesamiento_promedio_h: number | null
    procesamiento_maximo_h: number | null
    ciclo_completo_promedio_h: number | null
    muestras_medidas: number
  }
  por_clinica: (FilaTiempos & { clinica: string })[]
  por_analisis: (FilaTiempos & { analisis: string })[]
  por_mes: (FilaTiempos & { mes: string })[]
}
type MontosPorServicio = Record<TipoItem, number> & { total: number }
export interface ReporteFacturacion {
  resumen: { total_facturado: number; comprobantes: number; ticket_promedio: number }
  por_clinica: (MontosPorServicio & { clinica: string })[]
  por_mes: (MontosPorServicio & { mes: string })[]
  por_servicio: { servicio: TipoItem; total: number; porcentaje: number }[]
}
export interface ReporteTratamientosVacunas {
  resumen: { tratamientos: number; mascotas_con_pendientes: number; vacunas_pendientes: number }
  tratamientos_por_medicamento: { medicamento: string; especie: string; cantidad: number }[]
  tratamientos: { fecha: string; mascota: string; especie: string; clinica: string; descripcion: string; medicamento: string | null; dosis: string | null; duracion_dias: number | null }[]
  resumen_vacunas: { vacuna: string; especie: string; pendientes: number }[]
  vacunas_pendientes: { mascota_id: number; mascota: string; especie: string; responsable: string; telefono: string; vacuna: string; situacion: string; vencimiento: string | null }[]
}
