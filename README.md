# VetRed · Red de Clínicas y Derivación de Laboratorio

TP Integrador 2026 · Desarrollo de Aplicaciones con Objetos · **Tema 2**

Sistema web que integra la atención clínica de una red de clínicas veterinarias con la derivación de
muestras biológicas a un laboratorio central, con cadena de custodia y trazabilidad completa de cada
muestra (Extraída → Empaquetada → En tránsito → Recibida → Analizada / Rechazada).

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2.0 · SQLite · Pydantic · PyJWT · bcrypt · pytest |
| Frontend | React + TypeScript (Vite) · Tailwind CSS · React Router · TanStack Query · React Hook Form + Zod · Zustand · Axios · Recharts · Carbon Icons · Sonner |

## Cómo levantarlo

Requisitos: Python 3.12 y Node 20 o superior.

**Backend** (puerto 8000):

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m app.seed
.venv\Scripts\python -m uvicorn app.main:app --reload
```

`app.seed` recrea `backend/veterinaria.db` con unos 6 meses de actividad simulada (atenciones, remitos,
rechazos, resultados, comprobantes y turnos). Se puede volver a correr para resetear la demo.
La documentación interactiva de la API queda en http://localhost:8000/docs.

**Frontend** (puerto 5173, las llamadas a `/api` se redirigen al backend):

```bash
cd frontend
npm install
npm run dev
```

**Tests del backend:**

```bash
cd backend
.venv\Scripts\python -m pytest
```

## Usuarios de demostración

| Rol | Email | Contraseña | Puede |
|---|---|---|---|
| Administrador | admin@vetred.com | admin123 | Todo, en toda la red, y datos maestros |
| Veterinaria (Clínica Centro) | vet1@vetred.com | vet123 | Clientes, atenciones, empaquetado, envíos, stock y agenda de su clínica |
| Laboratorio central | lab1@vetred.com | lab123 | Recepción de remitos, resultados y agenda del laboratorio |

También existen `vet2` a `vet6` (las otras clínicas) y `lab2`, `lab3`, con las mismas contraseñas.

## Qué cubre

**Procesos obligatorios:** clientes · mascotas e historias clínicas · atenciones y órdenes de derivación ·
empaquetado en conservadoras con remito y precinto sanitario · cadena de envío · recepción con
verificación del precinto · resultados y comprobantes de atención.

**Procesos opcionales:** stock de conservadoras e insumos médicos · agenda de profesionales.

**Validaciones:** responsable obligatorio de cada mascota · muestras rechazadas si el precinto llega roto
(y el State impide analizarlas) · historial de estados inmutable · sin turnos superpuestos · control del
esquema de vacunas obligatorias al registrar atenciones (advierte y permite aplicarlas en la misma atención).

**Reportes:** atenciones y derivaciones · rechazos por fallas de transporte · tiempos de tránsito y
procesamiento (calculados del historial) · facturación por clínica y servicio · tratamientos y vacunas pendientes.

## Patrones de diseño

| Patrón | Dónde | Para qué |
|---|---|---|
| **State** | `backend/app/dominio/estados_muestra.py`, `estados_remito.py` | Cada estado define qué operaciones admite la muestra o el remito. `Muestra` y `RemitoBiologico` (en `app/modelos`) son los contextos: delegan en su estado y registran el historial. |
| **Singleton** | `backend/app/core/singleton.py` (metaclase), `config.py`, `database.py` | Una única `Configuracion` y una única `BaseDeDatos` (engine + fábrica de sesiones). |
| **Strategy** | `backend/app/dominio/tarifas.py` | `TarifaConsulta`, `TarifaControl` y `TarifaUrgencia` calculan el importe de la atención; `ServicioFacturacion` elige la estrategia según el tipo. |

Los diagramas de clases UML están en `docs/diagramas/` (fuente PlantUML `.puml` + imagen `.png`).
Para regenerarlos: `java -jar plantuml.jar -tpng docs/diagramas/*.puml`.

## Estructura

```
backend/app/
  core/        Singleton, configuración, base de datos, seguridad JWT, excepciones de negocio
  dominio/     Patrones State (muestra y remito) y Strategy (tarifas)
  modelos/     Entidades SQLAlchemy por área (clínico, laboratorio, envío, stock, agenda, facturación)
  schemas/     Entrada y salida de la API (Pydantic)
  servicios/   Reglas de negocio de cada proceso y reportes
  routers/     Endpoints REST (/api/...)
  seed.py      Datos de demostración
backend/tests/ Pruebas de patrones, validaciones y API
frontend/src/
  api/         Cliente Axios, tipos y funciones por módulo
  stores/      Sesión (Zustand persistido en localStorage)
  components/  UI reutilizable, layout, gráficos y ciclo de vida de la muestra
  pages/       Una página por sección del menú
docs/diagramas Diagramas de clases UML
```

## Guion para la exposición (≈10 minutos)

1. **Login como veterinaria** (`vet1`). Mostrar el tablero: muestras por etapa de la cadena de custodia.
2. **Mascotas → una mascota → Nueva atención.** Elegir una mascota con vacunas pendientes: aparece la
   advertencia del esquema obligatorio. Aplicar una vacuna, pedir dos análisis y registrar. Se emite la
   orden y las muestras quedan *Extraídas*.
3. **Empaquetado.** Seleccionar las muestras y probar primero el contenedor de temperatura ambiente:
   el sistema avisa que no es compatible. Elegir una conservadora refrigerada → se genera el remito y el
   precinto. **Imprimir remito**.
4. **Despachar** el remito y registrar un **punto de control**.
5. **Login como laboratorio** (`lab1`). Abrir el remito y registrar la recepción con **precinto roto**:
   todas las muestras pasan a *Rechazada*. Abrir una muestra → **Trazabilidad**: ciclo de vida
   cortado y registro de custodia.
6. **Laboratorio:** cargar el resultado de una muestra recibida → pasa a *Analizada*.
7. **Login como admin.** Emitir el **comprobante** de la atención desde la historia clínica (no cobra las
   muestras rechazadas). Mostrar la **agenda** e intentar reservar un turno superpuesto.
8. **Reportes:** recorrer los cinco reportes y exportar uno a CSV.
9. En el código: `estados_muestra.py` (State), `tarifas.py` (Strategy), `singleton.py` (Singleton) y
   `tests/test_patrones.py`.
