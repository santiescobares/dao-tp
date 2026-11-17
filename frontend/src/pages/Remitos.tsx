import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { laboratorioApi } from '../api/servicios'
import type { EstadoRemito } from '../api/tipos'
import { EstadoRemitoInsignia } from '../components/ui/Insignias'
import { EncabezadoPagina, Pestanas } from '../components/ui/Pagina'
import { Tabla } from '../components/ui/Tabla'
import { fechaHora, horas } from '../utils/formato'

type Filtro = '' | EstadoRemito

const PESTANAS: { valor: Filtro; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'PREPARADO', etiqueta: 'Preparados' },
  { valor: 'EN_TRANSITO', etiqueta: 'En tránsito' },
  { valor: 'RECIBIDO', etiqueta: 'Recibidos' },
  { valor: 'RECHAZADO', etiqueta: 'Rechazados' },
]

export default function Remitos() {
  const [parametros, setParametros] = useSearchParams()
  const estado = (parametros.get('estado') ?? '') as Filtro
  const navegar = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ['remitos', estado], queryFn: () => laboratorioApi.remitos({ estado }) })

  return (
    <>
      <EncabezadoPagina
        titulo="Remitos y cadena de envío"
        descripcion="Conservadoras precintadas en viaje de las clínicas al laboratorio central"
      />
      <Pestanas opciones={PESTANAS} activa={estado} alCambiar={(v) => setParametros(v ? { estado: v } : {})} />
      <Tabla
        filas={data}
        cargando={isLoading}
        clave={(r) => r.id}
        alHacerClic={(r) => navegar(`/remitos/${r.id}`)}
        columnas={[
          { titulo: 'Remito', celda: (r) => <span className="font-medium">{r.numero}</span> },
          { titulo: 'Clínica', celda: (r) => r.clinica.nombre },
          { titulo: 'Conservadora', celda: (r) => r.conservadora.codigo },
          { titulo: 'Muestras', celda: (r) => r.muestras.length, className: 'text-center' },
          { titulo: 'Emisión', celda: (r) => fechaHora(r.fecha_emision) },
          { titulo: 'Despacho', celda: (r) => fechaHora(r.fecha_despacho) },
          { titulo: 'Recepción', celda: (r) => fechaHora(r.fecha_recepcion) },
          { titulo: 'Tránsito', celda: (r) => horas(r.horas_en_transito) },
          { titulo: 'Estado', celda: (r) => <EstadoRemitoInsignia estado={r.estado} /> },
        ]}
      />
    </>
  )
}
