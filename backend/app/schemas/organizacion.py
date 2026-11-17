from pydantic import EmailStr, Field

from app.modelos.enums import Rol, TipoProfesional
from app.schemas.comun import Esquema


class LoginEntrada(Esquema):
    email: EmailStr
    password: str


class ClinicaResumen(Esquema):
    id: int
    nombre: str


class ClinicaEntrada(Esquema):
    nombre: str = Field(min_length=2, max_length=100)
    direccion: str = Field(min_length=2)
    telefono: str = Field(min_length=6)
    activa: bool = True


class ClinicaSalida(ClinicaEntrada):
    id: int


class ProfesionalResumen(Esquema):
    id: int
    nombre_completo: str
    matricula: str
    tipo: TipoProfesional


class ProfesionalEntrada(Esquema):
    nombre: str = Field(min_length=2)
    apellido: str = Field(min_length=2)
    matricula: str = Field(min_length=2)
    especialidad: str
    tipo: TipoProfesional
    clinica_id: int | None = None
    activo: bool = True


class ProfesionalSalida(ProfesionalEntrada):
    id: int
    nombre_completo: str
    clinica: ClinicaResumen | None


class UsuarioSalida(Esquema):
    id: int
    email: str
    nombre: str
    rol: Rol
    activo: bool
    profesional_id: int | None
    clinica_id: int | None


class UsuarioEntrada(Esquema):
    email: EmailStr
    nombre: str = Field(min_length=2)
    rol: Rol
    profesional_id: int | None = None
    activo: bool = True
    # Obligatoria al crear; si se deja vacía al editar, no se cambia
    password: str | None = Field(default=None, min_length=6)


class TokenSalida(Esquema):
    token: str
    usuario: UsuarioSalida
