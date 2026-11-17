import { Route, Routes } from 'react-router-dom'
import type { Rol } from './api/tipos'
import { Layout } from './components/layout/Layout'
import { RutaProtegida } from './components/layout/RutaProtegida'
import Administracion from './pages/Administracion'
import Agenda from './pages/Agenda'
import Atenciones from './pages/Atenciones'
import Clientes from './pages/Clientes'
import ComprobanteImprimible from './pages/ComprobanteImprimible'
import Comprobantes from './pages/Comprobantes'
import Empaquetado from './pages/Empaquetado'
import HistoriaClinica from './pages/HistoriaClinica'
import Laboratorio from './pages/Laboratorio'
import Login from './pages/Login'
import Mascotas from './pages/Mascotas'
import Muestras from './pages/Muestras'
import NuevaAtencion from './pages/NuevaAtencion'
import RemitoDetalle from './pages/RemitoDetalle'
import Remitos from './pages/Remitos'
import Reportes from './pages/Reportes'
import Stock from './pages/Stock'
import Tablero from './pages/Tablero'
import Trazabilidad from './pages/Trazabilidad'

const CLINICA: Rol[] = ['ADMIN', 'VETERINARIO']
const LABORATORIO: Rol[] = ['ADMIN', 'LABORATORISTA']

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route index element={<Tablero />} />
        <Route path="clientes" element={<RutaProtegida roles={CLINICA}><Clientes /></RutaProtegida>} />
        <Route path="mascotas" element={<Mascotas />} />
        <Route path="mascotas/:id" element={<HistoriaClinica />} />
        <Route path="atenciones" element={<RutaProtegida roles={CLINICA}><Atenciones /></RutaProtegida>} />
        <Route path="atenciones/nueva" element={<RutaProtegida roles={CLINICA}><NuevaAtencion /></RutaProtegida>} />
        <Route path="comprobantes" element={<RutaProtegida roles={CLINICA}><Comprobantes /></RutaProtegida>} />
        <Route path="comprobantes/:id" element={<RutaProtegida roles={CLINICA}><ComprobanteImprimible /></RutaProtegida>} />
        <Route path="muestras" element={<Muestras />} />
        <Route path="muestras/:id" element={<Trazabilidad />} />
        <Route path="empaquetado" element={<RutaProtegida roles={CLINICA}><Empaquetado /></RutaProtegida>} />
        <Route path="remitos" element={<Remitos />} />
        <Route path="remitos/:id" element={<RemitoDetalle />} />
        <Route path="laboratorio" element={<RutaProtegida roles={LABORATORIO}><Laboratorio /></RutaProtegida>} />
        <Route path="stock" element={<RutaProtegida roles={CLINICA}><Stock /></RutaProtegida>} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="administracion" element={<RutaProtegida roles={['ADMIN']}><Administracion /></RutaProtegida>} />
        <Route path="*" element={<p className="py-24 text-center text-slate-500">Página no encontrada.</p>} />
      </Route>
    </Routes>
  )
}
