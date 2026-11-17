import { useQuery } from '@tanstack/react-query'
import { adminApi, clinicoApi, gestionApi } from '../api/servicios'
import type { TipoProfesional } from '../api/tipos'

/** Consultas de datos maestros reutilizadas en muchos formularios. */
const LARGO = 5 * 60_000

export const useClinicas = () => useQuery({ queryKey: ['clinicas'], queryFn: adminApi.clinicas, staleTime: LARGO })
export const useEspecies = () => useQuery({ queryKey: ['especies'], queryFn: adminApi.especies, staleTime: LARGO })
export const useVacunas = (especieId?: number) =>
  useQuery({ queryKey: ['vacunas', especieId], queryFn: () => adminApi.vacunas(especieId), staleTime: LARGO })
export const useTiposAnalisis = (soloActivos = false) =>
  useQuery({ queryKey: ['tipos-analisis', soloActivos], queryFn: () => adminApi.tiposAnalisis(soloActivos), staleTime: LARGO })
export const useProfesionales = (tipo?: TipoProfesional, clinicaId?: number) =>
  useQuery({
    queryKey: ['profesionales', tipo, clinicaId],
    queryFn: () => adminApi.profesionales({ tipo, clinica_id: clinicaId }),
    staleTime: LARGO,
  })
export const useClientes = (texto?: string) =>
  useQuery({ queryKey: ['clientes', texto], queryFn: () => clinicoApi.clientes(texto) })
export const useMascotas = (texto?: string, clienteId?: number) =>
  useQuery({ queryKey: ['mascotas', texto, clienteId], queryFn: () => clinicoApi.mascotas({ q: texto, cliente_id: clienteId }) })
export const useInsumos = (clinicaId?: number | '') =>
  useQuery({ queryKey: ['insumos', clinicaId], queryFn: () => gestionApi.insumos({ clinica_id: clinicaId }) })
