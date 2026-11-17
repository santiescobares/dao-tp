"""Agenda de profesionales: horarios semanales y turnos sin superposición."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.excepciones import ErrorNegocio, TurnoSuperpuestoError
from app.dominio.estados_muestra import Recibida
from app.modelos.agenda import DIAS_SEMANA, HorarioProfesional, Turno
from app.modelos.clinico import Mascota
from app.modelos.enums import EstadoTurno, Rol, TipoProfesional, TipoTurno
from app.modelos.laboratorio import Muestra
from app.modelos.organizacion import Profesional, Usuario
from app.schemas.gestion import HorarioEntrada, TurnoEntrada
from app.servicios.comun import obtener_o_error, verificar_clinica


class ServicioAgenda:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    # ---------- Horarios ----------
    def listar_horarios(self, profesional_id: int | None = None) -> list[HorarioProfesional]:
        consulta = select(HorarioProfesional).order_by(
            HorarioProfesional.profesional_id, HorarioProfesional.dia_semana, HorarioProfesional.hora_desde
        )
        if profesional_id:
            consulta = consulta.where(HorarioProfesional.profesional_id == profesional_id)
        return list(self.sesion.scalars(consulta))

    def crear_horario(self, datos: HorarioEntrada) -> HorarioProfesional:
        obtener_o_error(self.sesion, Profesional, datos.profesional_id, "el profesional")
        if datos.hora_desde >= datos.hora_hasta:
            raise ErrorNegocio("La hora de inicio debe ser anterior a la de fin.")
        for existente in self.listar_horarios(datos.profesional_id):
            if (
                existente.dia_semana == datos.dia_semana
                and existente.hora_desde < datos.hora_hasta
                and datos.hora_desde < existente.hora_hasta
            ):
                raise ErrorNegocio(
                    f"Se superpone con otra franja del {DIAS_SEMANA[datos.dia_semana]}."
                )
        horario = HorarioProfesional(**datos.model_dump())
        self.sesion.add(horario)
        self.sesion.commit()
        return horario

    def eliminar_horario(self, horario_id: int) -> None:
        horario = obtener_o_error(self.sesion, HorarioProfesional, horario_id, "el horario")
        self.sesion.delete(horario)
        self.sesion.commit()

    # ---------- Turnos ----------
    def listar_turnos(
        self,
        profesional_id: int | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
        clinica_id: int | None = None,
        incluir_cancelados: bool = False,
    ) -> list[Turno]:
        consulta = select(Turno).join(Turno.profesional).order_by(Turno.inicio)
        if profesional_id:
            consulta = consulta.where(Turno.profesional_id == profesional_id)
        if clinica_id:
            consulta = consulta.where(Profesional.clinica_id == clinica_id)
        if desde:
            consulta = consulta.where(Turno.fin > desde)
        if hasta:
            consulta = consulta.where(Turno.inicio < hasta)
        if not incluir_cancelados:
            consulta = consulta.where(Turno.estado != EstadoTurno.CANCELADO)
        return list(self.sesion.scalars(consulta))

    def _verificar_permiso(self, profesional: Profesional, usuario: Usuario) -> None:
        if usuario.rol == Rol.VETERINARIO:
            verificar_clinica(usuario, profesional.clinica_id or -1)
        if usuario.rol == Rol.LABORATORISTA and profesional.tipo != TipoProfesional.LABORATORISTA:
            raise ErrorNegocio("Solo podés gestionar la agenda del laboratorio.")

    def reservar(self, datos: TurnoEntrada, usuario: Usuario) -> Turno:
        profesional = obtener_o_error(self.sesion, Profesional, datos.profesional_id, "el profesional")
        self._verificar_permiso(profesional, usuario)
        if datos.fin <= datos.inicio:
            raise ErrorNegocio("El turno debe terminar después de empezar.")

        # Tipo de turno coherente con el profesional
        if datos.tipo == TipoTurno.ATENCION:
            if profesional.tipo != TipoProfesional.VETERINARIO:
                raise ErrorNegocio("Los turnos de atención son solo para veterinarios.")
            if datos.mascota_id is None:
                raise ErrorNegocio("Indicá la mascota del turno.")
            obtener_o_error(self.sesion, Mascota, datos.mascota_id, "la mascota")
        else:
            if profesional.tipo != TipoProfesional.LABORATORISTA:
                raise ErrorNegocio("Los turnos de procesamiento son para profesionales del laboratorio.")
            if datos.muestra_id is not None:
                muestra = obtener_o_error(self.sesion, Muestra, datos.muestra_id, "la muestra")
                if muestra.estado != Recibida.nombre:
                    raise ErrorNegocio("Solo se agenda el procesamiento de muestras recibidas.")

        # El turno tiene que caer dentro de una franja de atención del profesional
        horarios = self.listar_horarios(profesional.id)
        if not any(h.contiene(datos.inicio, datos.fin) for h in horarios):
            raise ErrorNegocio(
                f"{profesional.nombre_completo} no atiende el "
                f"{DIAS_SEMANA[datos.inicio.weekday()]} en ese horario."
            )

        # Validación de negocio: evitar superposición de turnos en la agenda
        for otro in self.listar_turnos(profesional.id, datos.inicio, datos.fin):
            if otro.se_superpone_con(datos.inicio, datos.fin):
                raise TurnoSuperpuestoError(
                    f"El turno se superpone con otro de {profesional.nombre_completo} "
                    f"({otro.inicio:%d/%m %H:%M} a {otro.fin:%H:%M})."
                )

        turno = Turno(**datos.model_dump())
        self.sesion.add(turno)
        self.sesion.commit()
        return turno

    def cancelar(self, turno_id: int, usuario: Usuario) -> Turno:
        turno = obtener_o_error(self.sesion, Turno, turno_id, "el turno")
        self._verificar_permiso(turno.profesional, usuario)
        if turno.estado != EstadoTurno.RESERVADO:
            raise ErrorNegocio("Solo se pueden cancelar turnos reservados.")
        turno.estado = EstadoTurno.CANCELADO
        self.sesion.commit()
        return turno
