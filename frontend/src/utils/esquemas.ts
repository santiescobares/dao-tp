import { z } from 'zod'

/** Helpers de Zod para los valores que llegan como texto desde inputs y selects. */

const vacioAIndefinido = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : v)

export const textoOpcional = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.string().nullable().optional(),
)

export const numeroOpcional = z.preprocess(
  (v) => (vacioAIndefinido(v) === undefined ? null : Number(v)),
  z.number({ error: 'Ingresá un número' }).nullable(),
)

export const numeroRequerido = (mensaje = 'Campo obligatorio') =>
  z.preprocess((v) => (vacioAIndefinido(v) === undefined ? undefined : Number(v)), z.number({ error: mensaje }))

export const idRequerido = (mensaje = 'Seleccioná una opción') =>
  z.preprocess((v) => (vacioAIndefinido(v) === undefined ? undefined : Number(v)), z.number({ error: mensaje }).int().positive(mensaje))
