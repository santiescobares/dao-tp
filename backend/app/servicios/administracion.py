"""ABM de datos maestros: clínicas, profesionales, usuarios y catálogos."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.excepciones import ErrorNegocio
from app.core.seguridad import hashear_password
from app.modelos.clinico import Especie, Vacuna
from app.modelos.enums import Rol, TipoProfesional
from app.modelos.laboratorio import TipoAnalisis
from app.modelos.organizacion import Clinica, Profesional, Usuario
from app.schemas.catalogos import EspecieEntrada, TipoAnalisisEntrada, VacunaEntrada
from app.schemas.organizacion import ClinicaEntrada, ProfesionalEntrada, UsuarioEntrada
from app.servicios.comun import obtener_o_error


class ServicioAdministracion:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def _guardar(self, entidad):
        self.sesion.add(entidad)
        self.sesion.commit()
        return entidad

    def _actualizar(self, entidad, datos):
        for campo, valor in datos.model_dump().items():
            setattr(entidad, campo, valor)
        self.sesion.commit()
        return entidad

    # ---------- Clínicas ----------
    def listar_clinicas(self) -> list[Clinica]:
        return list(self.sesion.scalars(select(Clinica).order_by(Clinica.nombre)))

    def crear_clinica(self, datos: ClinicaEntrada) -> Clinica:
        return self._guardar(Clinica(**datos.model_dump()))

    def actualizar_clinica(self, clinica_id: int, datos: ClinicaEntrada) -> Clinica:
        return self._actualizar(obtener_o_error(self.sesion, Clinica, clinica_id, "la clínica"), datos)

    # ---------- Profesionales ----------
    def listar_profesionales(
        self, tipo: TipoProfesional | None = None, clinica_id: int | None = None
    ) -> list[Profesional]:
        consulta = select(Profesional).order_by(Profesional.apellido, Profesional.nombre)
        if tipo:
            consulta = consulta.where(Profesional.tipo == tipo)
        if clinica_id:
            consulta = consulta.where(Profesional.clinica_id == clinica_id)
        return list(self.sesion.scalars(consulta))

    def _validar_profesional(self, datos: ProfesionalEntrada, excluir_id: int | None = None) -> None:
        if datos.tipo == TipoProfesional.VETERINARIO and datos.clinica_id is None:
            raise ErrorNegocio("Un veterinario debe estar asignado a una clínica.")
        if datos.tipo == TipoProfesional.LABORATORISTA and datos.clinica_id is not None:
            raise ErrorNegocio("Los profesionales del laboratorio no pertenecen a una clínica.")
        if datos.clinica_id:
            obtener_o_error(self.sesion, Clinica, datos.clinica_id, "la clínica")
        existente = self.sesion.scalar(
            select(Profesional).where(Profesional.matricula == datos.matricula)
        )
        if existente and existente.id != excluir_id:
            raise ErrorNegocio(f"Ya existe un profesional con matrícula {datos.matricula}.")

    def crear_profesional(self, datos: ProfesionalEntrada) -> Profesional:
        self._validar_profesional(datos)
        return self._guardar(Profesional(**datos.model_dump()))

    def actualizar_profesional(self, profesional_id: int, datos: ProfesionalEntrada) -> Profesional:
        profesional = obtener_o_error(self.sesion, Profesional, profesional_id, "el profesional")
        self._validar_profesional(datos, excluir_id=profesional_id)
        return self._actualizar(profesional, datos)

    # ---------- Usuarios ----------
    def listar_usuarios(self) -> list[Usuario]:
        return list(self.sesion.scalars(select(Usuario).order_by(Usuario.nombre)))

    def _validar_usuario(self, datos: UsuarioEntrada, excluir_id: int | None = None) -> None:
        existente = self.sesion.scalar(select(Usuario).where(Usuario.email == datos.email))
        if existente and existente.id != excluir_id:
            raise ErrorNegocio(f"El email {datos.email} ya está en uso.")
        if datos.rol == Rol.ADMIN:
            return
        if datos.profesional_id is None:
            raise ErrorNegocio("Los veterinarios y laboratoristas deben vincularse a un profesional.")
        profesional = obtener_o_error(self.sesion, Profesional, datos.profesional_id, "el profesional")
        if profesional.tipo.value != datos.rol.value:
            raise ErrorNegocio("El rol del usuario no coincide con el tipo de profesional.")

    def crear_usuario(self, datos: UsuarioEntrada) -> Usuario:
        self._validar_usuario(datos)
        if not datos.password:
            raise ErrorNegocio("La contraseña es obligatoria.")
        usuario = Usuario(
            email=datos.email,
            nombre=datos.nombre,
            rol=datos.rol,
            activo=datos.activo,
            profesional_id=datos.profesional_id if datos.rol != Rol.ADMIN else None,
            password_hash=hashear_password(datos.password),
        )
        return self._guardar(usuario)

    def actualizar_usuario(self, usuario_id: int, datos: UsuarioEntrada) -> Usuario:
        usuario = obtener_o_error(self.sesion, Usuario, usuario_id, "el usuario")
        self._validar_usuario(datos, excluir_id=usuario_id)
        usuario.email = datos.email
        usuario.nombre = datos.nombre
        usuario.rol = datos.rol
        usuario.activo = datos.activo
        usuario.profesional_id = datos.profesional_id if datos.rol != Rol.ADMIN else None
        if datos.password:
            usuario.password_hash = hashear_password(datos.password)
        self.sesion.commit()
        return usuario

    # ---------- Catálogos ----------
    def listar_especies(self) -> list[Especie]:
        return list(self.sesion.scalars(select(Especie).order_by(Especie.nombre)))

    def crear_especie(self, datos: EspecieEntrada) -> Especie:
        return self._guardar(Especie(**datos.model_dump()))

    def listar_vacunas(self, especie_id: int | None = None) -> list[Vacuna]:
        consulta = select(Vacuna).order_by(Vacuna.especie_id, Vacuna.nombre)
        if especie_id:
            consulta = consulta.where(Vacuna.especie_id == especie_id)
        return list(self.sesion.scalars(consulta))

    def crear_vacuna(self, datos: VacunaEntrada) -> Vacuna:
        obtener_o_error(self.sesion, Especie, datos.especie_id, "la especie")
        return self._guardar(Vacuna(**datos.model_dump()))

    def actualizar_vacuna(self, vacuna_id: int, datos: VacunaEntrada) -> Vacuna:
        return self._actualizar(obtener_o_error(self.sesion, Vacuna, vacuna_id, "la vacuna"), datos)

    def listar_tipos_analisis(self, solo_activos: bool = False) -> list[TipoAnalisis]:
        consulta = select(TipoAnalisis).order_by(TipoAnalisis.nombre)
        if solo_activos:
            consulta = consulta.where(TipoAnalisis.activo.is_(True))
        return list(self.sesion.scalars(consulta))

    def _validar_tipo_analisis(self, datos: TipoAnalisisEntrada) -> None:
        if datos.temperatura_min >= datos.temperatura_max:
            raise ErrorNegocio("La temperatura mínima debe ser menor a la máxima.")

    def crear_tipo_analisis(self, datos: TipoAnalisisEntrada) -> TipoAnalisis:
        self._validar_tipo_analisis(datos)
        return self._guardar(TipoAnalisis(**datos.model_dump()))

    def actualizar_tipo_analisis(self, tipo_id: int, datos: TipoAnalisisEntrada) -> TipoAnalisis:
        self._validar_tipo_analisis(datos)
        tipo = obtener_o_error(self.sesion, TipoAnalisis, tipo_id, "el tipo de análisis")
        return self._actualizar(tipo, datos)
