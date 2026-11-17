from datetime import date, datetime

from pydantic import EmailStr, Field

from app.modelos.enums import MotivoRechazo, Sexo, TipoAtencion
from app.schemas.catalogos import EspecieSalida
from app.schemas.comun import Esquema
from app.schemas.organizacion import ClinicaResumen, ProfesionalResumen


# ---------- Clientes ----------
class ClienteEntrada(Esquema):
    dni: str = Field(pattern=r"^\d{7,9}$")
    nombre: str = Field(min_length=2)
    apellido: str = Field(min_length=2)
    telefono: str = Field(min_length=6)
    email: EmailStr | None = None
    direccion: str | None = None


class ClienteResumen(Esquema):
    id: int
    dni: str
    nombre_completo: str
    telefono: str
    email: str | None


class ClienteSalida(ClienteEntrada):
    id: int
    nombre_completo: str
    fecha_alta: date
    email: str | None = None
    cantidad_mascotas: int = 0


# ---------- Mascotas ----------
class MascotaEntrada(Esquema):
    nombre: str = Field(min_length=1)
    especie_id: int
    raza: str | None = None
    sexo: Sexo
    fecha_nacimiento: date
    peso_kg: float | None = Field(default=None, gt=0)
    # Validación de negocio: toda mascota debe tener un responsable
    cliente_id: int
    activa: bool = True


class HistoriaResumen(Esquema):
    id: int
    numero: str
    fecha_apertura: date
    alergias: str | None
    observaciones: str | None


class HistoriaEntrada(Esquema):
    alergias: str | None = None
    observaciones: str | None = None


class MascotaResumen(Esquema):
    id: int
    nombre: str
    especie: EspecieSalida
    raza: str | None


class MascotaSalida(Esquema):
    id: int
    nombre: str
    especie_id: int
    especie: EspecieSalida
    raza: str | None
    sexo: Sexo
    fecha_nacimiento: date
    peso_kg: float | None
    cliente_id: int
    responsable: ClienteResumen
    activa: bool
    historia: HistoriaResumen


class VacunaPendiente(Esquema):
    vacuna_id: int
    nombre: str
    situacion: str  # NUNCA_APLICADA | REFUERZO_VENCIDO
    ultima_aplicacion: date | None
    vencimiento: date | None


# ---------- Atenciones ----------
class TratamientoEntrada(Esquema):
    descripcion: str = Field(min_length=2)
    medicamento: str | None = None
    dosis: str | None = None
    duracion_dias: int | None = Field(default=None, ge=1)


class TratamientoSalida(TratamientoEntrada):
    id: int


class VacunaAplicadaEntrada(Esquema):
    vacuna_id: int
    lote: str | None = None


class InsumoUsadoEntrada(Esquema):
    insumo_id: int
    cantidad: float = Field(gt=0)


class AtencionEntrada(Esquema):
    mascota_id: int
    tipo: TipoAtencion
    motivo: str = Field(min_length=3)
    diagnostico: str | None = None
    observaciones: str | None = None
    peso_kg: float | None = Field(default=None, gt=0)
    fecha: datetime | None = None
    turno_id: int | None = None
    # Solo el ADMIN indica el profesional; un veterinario registra a su nombre
    profesional_id: int | None = None
    tratamientos: list[TratamientoEntrada] = []
    vacunas: list[VacunaAplicadaEntrada] = []
    insumos: list[InsumoUsadoEntrada] = []
    # Tipos de análisis a derivar al laboratorio (genera la orden de derivación)
    analisis: list[int] = []
    derivacion_urgente: bool = False
    observaciones_derivacion: str | None = None


class AplicacionVacunaSalida(Esquema):
    id: int
    vacuna_id: int
    nombre_vacuna: str
    fecha: date
    lote: str | None


class MuestraResumen(Esquema):
    id: int
    codigo: str
    estado: str
    motivo_rechazo: MotivoRechazo | None
    nombre_analisis: str
    tiene_resultado: bool


class OrdenSalida(Esquema):
    id: int
    numero: str
    fecha_emision: datetime
    urgente: bool
    estado: str
    observaciones: str | None
    muestras: list[MuestraResumen]


class AtencionSalida(Esquema):
    id: int
    fecha: datetime
    tipo: TipoAtencion
    motivo: str
    diagnostico: str | None
    observaciones: str | None
    peso_kg: float | None
    clinica: ClinicaResumen
    profesional: ProfesionalResumen
    mascota: MascotaResumen
    responsable: ClienteResumen
    tratamientos: list[TratamientoSalida]
    vacunas_aplicadas: list[AplicacionVacunaSalida]
    ordenes: list[OrdenSalida]
    comprobante_id: int | None


class AtencionRegistrada(Esquema):
    atencion: AtencionSalida
    advertencias: list[str]


class HistoriaClinicaSalida(Esquema):
    mascota: MascotaSalida
    atenciones: list[AtencionSalida]
    vacunas_aplicadas: list[AplicacionVacunaSalida]
    vacunas_pendientes: list[VacunaPendiente]
