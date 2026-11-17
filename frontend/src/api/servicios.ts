import { api } from './cliente'
import type * as T from './tipos'

/** Funciones de acceso a la API agrupadas por módulo. */

const obtener = <R>(url: string, params?: object) => api.get<R>(url, { params }).then((r) => r.data)
const crear = <R>(url: string, datos?: unknown) => api.post<R>(url, datos).then((r) => r.data)
const modificar = <R>(url: string, datos: unknown) => api.put<R>(url, datos).then((r) => r.data)
const borrar = (url: string) => api.delete(url).then(() => undefined)

/** Quita parámetros vacíos para no mandar "?clinica_id=" */
const limpiar = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))

export const authApi = {
  login: (email: string, password: string) =>
    crear<{ token: string; usuario: T.Usuario }>('/auth/login', { email, password }),
}

export const adminApi = {
  clinicas: () => obtener<T.Clinica[]>('/clinicas'),
  crearClinica: (d: T.ClinicaEntrada) => crear<T.Clinica>('/clinicas', d),
  editarClinica: (id: number, d: T.ClinicaEntrada) => modificar<T.Clinica>(`/clinicas/${id}`, d),
  profesionales: (params: { tipo?: T.TipoProfesional; clinica_id?: number } = {}) =>
    obtener<T.Profesional[]>('/profesionales', limpiar(params)),
  crearProfesional: (d: T.ProfesionalEntrada) => crear<T.Profesional>('/profesionales', d),
  editarProfesional: (id: number, d: T.ProfesionalEntrada) => modificar<T.Profesional>(`/profesionales/${id}`, d),
  usuarios: () => obtener<T.Usuario[]>('/usuarios'),
  crearUsuario: (d: T.UsuarioEntrada) => crear<T.Usuario>('/usuarios', d),
  editarUsuario: (id: number, d: T.UsuarioEntrada) => modificar<T.Usuario>(`/usuarios/${id}`, d),
  especies: () => obtener<T.Especie[]>('/especies'),
  crearEspecie: (nombre: string) => crear<T.Especie>('/especies', { nombre }),
  vacunas: (especie_id?: number) => obtener<T.Vacuna[]>('/vacunas', limpiar({ especie_id })),
  crearVacuna: (d: T.VacunaEntrada) => crear<T.Vacuna>('/vacunas', d),
  editarVacuna: (id: number, d: T.VacunaEntrada) => modificar<T.Vacuna>(`/vacunas/${id}`, d),
  tiposAnalisis: (solo_activos = false) => obtener<T.TipoAnalisis[]>('/tipos-analisis', { solo_activos }),
  crearTipoAnalisis: (d: T.TipoAnalisisEntrada) => crear<T.TipoAnalisis>('/tipos-analisis', d),
  editarTipoAnalisis: (id: number, d: T.TipoAnalisisEntrada) => modificar<T.TipoAnalisis>(`/tipos-analisis/${id}`, d),
}

export const clinicoApi = {
  clientes: (q?: string) => obtener<T.Cliente[]>('/clientes', limpiar({ q })),
  crearCliente: (d: T.ClienteEntrada) => crear<T.Cliente>('/clientes', d),
  editarCliente: (id: number, d: T.ClienteEntrada) => modificar<T.Cliente>(`/clientes/${id}`, d),
  eliminarCliente: (id: number) => borrar(`/clientes/${id}`),
  mascotas: (params: { q?: string; cliente_id?: number } = {}) => obtener<T.Mascota[]>('/mascotas', limpiar(params)),
  mascota: (id: number) => obtener<T.Mascota>(`/mascotas/${id}`),
  crearMascota: (d: T.MascotaEntrada) => crear<T.Mascota>('/mascotas', d),
  editarMascota: (id: number, d: T.MascotaEntrada) => modificar<T.Mascota>(`/mascotas/${id}`, d),
  editarHistoria: (id: number, d: { alergias: string | null; observaciones: string | null }) =>
    modificar<T.Mascota>(`/mascotas/${id}/historia`, d),
  historia: (id: number) => obtener<T.HistoriaClinica>(`/mascotas/${id}/historia`),
  vacunasPendientes: (id: number) => obtener<T.VacunaPendiente[]>(`/mascotas/${id}/vacunas-pendientes`),
  atenciones: (params: { clinica_id?: number | ''; mascota_id?: number; desde?: string; hasta?: string } = {}) =>
    obtener<T.Atencion[]>('/atenciones', limpiar(params)),
  atencion: (id: number) => obtener<T.Atencion>(`/atenciones/${id}`),
  registrarAtencion: (d: T.AtencionEntrada) => crear<T.AtencionRegistrada>('/atenciones', d),
}

export const laboratorioApi = {
  muestras: (params: { estado?: string; clinica_id?: number | ''; q?: string } = {}) =>
    obtener<T.Muestra[]>('/muestras', limpiar(params)),
  trazabilidad: (id: number) => obtener<T.Trazabilidad>(`/muestras/${id}/trazabilidad`),
  cargarResultado: (id: number, d: { valores: string; conclusion: string; observaciones?: string | null }) =>
    crear<T.Muestra>(`/muestras/${id}/resultado`, d),
  rechazarMuestra: (id: number, d: { motivo: T.MotivoRechazo; observacion?: string | null }) =>
    crear<T.Muestra>(`/muestras/${id}/rechazar`, d),
  remitos: (params: { estado?: string; clinica_id?: number | '' } = {}) => obtener<T.Remito[]>('/remitos', limpiar(params)),
  remito: (id: number) => obtener<T.Remito>(`/remitos/${id}`),
  empaquetar: (d: { conservadora_id: number; muestra_ids: number[]; observaciones?: string | null }) =>
    crear<T.Remito>('/remitos', d),
  despachar: (id: number, d: { transportista: string; ubicacion: string; temperatura?: number | null; observacion?: string | null }) =>
    crear<T.Remito>(`/remitos/${id}/despachar`, d),
  registrarEvento: (id: number, d: { ubicacion: string; responsable: string; temperatura?: number | null; observacion?: string | null }) =>
    crear<T.Remito>(`/remitos/${id}/eventos`, d),
  recibir: (id: number, d: T.RecepcionEntrada) => crear<T.Remito>(`/remitos/${id}/recepcion`, d),
}

export const gestionApi = {
  emitirComprobante: (atencionId: number) => crear<T.Comprobante>(`/atenciones/${atencionId}/comprobante`),
  comprobantes: (params: { clinica_id?: number | ''; desde?: string; hasta?: string } = {}) =>
    obtener<T.Comprobante[]>('/comprobantes', limpiar(params)),
  comprobante: (id: number) => obtener<T.Comprobante>(`/comprobantes/${id}`),
  conservadoras: (params: { clinica_id?: number | ''; estado?: string } = {}) =>
    obtener<T.Conservadora[]>('/conservadoras', limpiar(params)),
  crearConservadora: (d: T.ConservadoraEntrada) => crear<T.Conservadora>('/conservadoras', d),
  editarConservadora: (id: number, d: T.ConservadoraEntrada) => modificar<T.Conservadora>(`/conservadoras/${id}`, d),
  insumos: (params: { clinica_id?: number | ''; bajo_minimo?: boolean } = {}) =>
    obtener<T.Insumo[]>('/insumos', limpiar(params)),
  crearInsumo: (d: T.InsumoEntrada) => crear<T.Insumo>('/insumos', d),
  editarInsumo: (id: number, d: T.InsumoEntrada) => modificar<T.Insumo>(`/insumos/${id}`, d),
  movimientos: (id: number) => obtener<T.Movimiento[]>(`/insumos/${id}/movimientos`),
  registrarMovimiento: (id: number, d: { tipo: T.TipoMovimiento; cantidad: number; motivo: string }) =>
    crear<T.Movimiento>(`/insumos/${id}/movimientos`, d),
  horarios: (profesional_id?: number) => obtener<T.Horario[]>('/horarios', limpiar({ profesional_id })),
  crearHorario: (d: Omit<T.Horario, 'id'>) => crear<T.Horario>('/horarios', d),
  eliminarHorario: (id: number) => borrar(`/horarios/${id}`),
  turnos: (params: { profesional_id?: number; desde?: string; hasta?: string; clinica_id?: number } = {}) =>
    obtener<T.Turno[]>('/turnos', limpiar(params)),
  reservarTurno: (d: T.TurnoEntrada) => crear<T.Turno>('/turnos', d),
  cancelarTurno: (id: number) => crear<T.Turno>(`/turnos/${id}/cancelar`),
}

export const reportesApi = {
  tablero: () => obtener<T.Tablero>('/reportes/tablero'),
  atenciones: (f: T.FiltroReporte) => obtener<T.ReporteAtenciones>('/reportes/atenciones', limpiar({ ...f })),
  rechazos: (f: T.FiltroReporte) => obtener<T.ReporteRechazos>('/reportes/rechazos', limpiar({ ...f })),
  tiempos: (f: T.FiltroReporte) => obtener<T.ReporteTiempos>('/reportes/tiempos', limpiar({ ...f })),
  facturacion: (f: T.FiltroReporte) => obtener<T.ReporteFacturacion>('/reportes/facturacion', limpiar({ ...f })),
  tratamientosVacunas: (f: T.FiltroReporte) =>
    obtener<T.ReporteTratamientosVacunas>('/reportes/tratamientos-vacunas', limpiar({ ...f })),
}
