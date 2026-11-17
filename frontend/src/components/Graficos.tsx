import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Gráficos de los reportes. Paleta categórica validada (orden fijo, nunca
 * se cicla): cada serie conserva su color aunque cambien los filtros.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const
const GRILLA = '#e2e8f0'
const TEXTO_EJE = { fontSize: 12, fill: '#64748b' }
const SUPERFICIE = '#ffffff'

export interface Serie {
  clave: string
  nombre: string
}

type Formateador = (valor: number) => string

/** Recharts tipa las claves según los datos; acá las recibimos como texto ya validado. */
const clave = (nombre: string) => nombre as never
const sinFormato: Formateador = (v) => v.toLocaleString('es-AR')

const estiloTooltip = {
  contentStyle: { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)' },
  cursor: { fill: 'rgb(148 163 184 / 0.12)' },
}

/** Barras verticales apiladas (una por categoría del eje X). */
export function BarrasApiladas<T extends object>({
  datos, ejeX, series, formato = sinFormato, etiquetaX = (v: string) => v, alto = 280,
}: { datos: T[]; ejeX: keyof T & string; series: Serie[]; formato?: Formateador; etiquetaX?: (v: string) => string; alto?: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRILLA} />
        <XAxis dataKey={clave(ejeX)} tick={TEXTO_EJE} tickLine={false} axisLine={{ stroke: GRILLA }} tickFormatter={etiquetaX} />
        <YAxis tick={TEXTO_EJE} tickLine={false} axisLine={false} tickFormatter={formato} width={72} />
        <Tooltip {...estiloTooltip} formatter={(v) => formato(Number(v))} labelFormatter={(v) => etiquetaX(String(v))} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#334155' }} />
        {series.map((s, i) => (
          <Bar
            key={s.clave}
            dataKey={s.clave}
            name={s.nombre}
            stackId="pila"
            fill={SERIES[i]}
            stroke={SUPERFICIE}
            strokeWidth={1}
            maxBarSize={40}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Barras horizontales de una sola serie (ranking). */
export function BarrasHorizontales<T extends object>({
  datos, ejeY, valor, nombre, formato = sinFormato, alto,
}: { datos: T[]; ejeY: keyof T & string; valor: keyof T & string; nombre: string; formato?: Formateador; alto?: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto ?? Math.max(120, datos.length * 36 + 30)}>
      <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 48, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRILLA} />
        <XAxis type="number" tick={TEXTO_EJE} tickLine={false} axisLine={false} tickFormatter={formato} />
        <YAxis type="category" dataKey={clave(ejeY)} tick={TEXTO_EJE} tickLine={false} axisLine={false} width={170} />
        <Tooltip {...estiloTooltip} formatter={(v) => [formato(Number(v)), nombre]} />
        <Bar
          dataKey={clave(valor)}
          name={nombre}
          fill={SERIES[0]}
          maxBarSize={20}
          radius={[0, 4, 4, 0]}
          label={{ position: 'right', fontSize: 12, fill: '#334155', formatter: (v: unknown) => formato(Number(v)) }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Líneas en una misma escala (nunca doble eje). */
export function Lineas<T extends object>({
  datos, ejeX, series, formato = sinFormato, etiquetaX = (v: string) => v, alto = 280,
}: { datos: T[]; ejeX: keyof T & string; series: Serie[]; formato?: Formateador; etiquetaX?: (v: string) => string; alto?: number }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <LineChart data={datos} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRILLA} />
        <XAxis dataKey={clave(ejeX)} tick={TEXTO_EJE} tickLine={false} axisLine={{ stroke: GRILLA }} tickFormatter={etiquetaX} />
        <YAxis tick={TEXTO_EJE} tickLine={false} axisLine={false} tickFormatter={formato} width={56} />
        <Tooltip
          contentStyle={estiloTooltip.contentStyle}
          cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
          formatter={(v) => formato(Number(v))}
          labelFormatter={(v) => etiquetaX(String(v))}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#334155' }} />
        {series.map((s, i) => (
          <Line
            key={s.clave}
            type="monotone"
            dataKey={s.clave}
            name={s.nombre}
            stroke={SERIES[i]}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: SUPERFICIE, fill: SERIES[i] }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: SUPERFICIE }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
