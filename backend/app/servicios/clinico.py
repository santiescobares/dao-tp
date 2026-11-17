"""Servicios del área clínica: clientes, mascotas, vacunación y atenciones."""
from datetime import date, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.excepciones import ErrorNegocio
from app.dominio.estados_muestra import RegistroCambio
from app.modelos.agenda import Turno
from app.modelos.clinico import (
    AplicacionVacuna,
    Atencion,
    Cliente,
    Especie,
    HistoriaClinica,
    Mascota,
    Tratamiento,
    Vacuna,
)
from app.modelos.enums import EstadoTurno, Rol, TipoMovimiento, TipoProfesional
from app.modelos.laboratorio import Muestra, OrdenDerivacion, TipoAnalisis
from app.modelos.organizacion import Profesional, Usuario
from app.modelos.stock import Insumo
from app.schemas.clinico import (
    AtencionEntrada,
    ClienteEntrada,
    HistoriaEntrada,
    MascotaEntrada,
    VacunaPendiente,
)
from app.servicios.comun import (
    clinica_en_alcance,
    generar_numero,
    obtener_o_error,
    sumar_meses,
    verificar_clinica,
)


class ServicioClientes:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def listar(self, texto: str | None = None) -> list[Cliente]:
        consulta = select(Cliente).order_by(Cliente.apellido, Cliente.nombre)
        if texto:
            patron = f"%{texto}%"
            consulta = consulta.where(
                or_(
                    Cliente.nombre.ilike(patron),
                    Cliente.apellido.ilike(patron),
                    Cliente.dni.ilike(patron),
                )
            )
        return list(self.sesion.scalars(consulta))

    def obtener(self, cliente_id: int) -> Cliente:
        return obtener_o_error(self.sesion, Cliente, cliente_id, "el cliente")

    def _validar_dni_unico(self, dni: str, excluir_id: int | None = None) -> None:
        existente = self.sesion.scalar(select(Cliente).where(Cliente.dni == dni))
        if existente and existente.id != excluir_id:
            raise ErrorNegocio(f"Ya existe un cliente con DNI {dni}.")

    def crear(self, datos: ClienteEntrada) -> Cliente:
        self._validar_dni_unico(datos.dni)
        cliente = Cliente(**datos.model_dump())
        self.sesion.add(cliente)
        self.sesion.commit()
        return cliente

    def actualizar(self, cliente_id: int, datos: ClienteEntrada) -> Cliente:
        cliente = self.obtener(cliente_id)
        self._validar_dni_unico(datos.dni, excluir_id=cliente_id)
        for campo, valor in datos.model_dump().items():
            setattr(cliente, campo, valor)
        self.sesion.commit()
        return cliente

    def eliminar(self, cliente_id: int) -> None:
        cliente = self.obtener(cliente_id)
        if cliente.mascotas:
            raise ErrorNegocio(
                "No se puede eliminar un cliente que es responsable de mascotas. "
                "Primero reasigná las mascotas a otro responsable."
            )
        self.sesion.delete(cliente)
        self.sesion.commit()


class ServicioMascotas:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def listar(self, texto: str | None = None, cliente_id: int | None = None) -> list[Mascota]:
        consulta = select(Mascota).join(Mascota.responsable).order_by(Mascota.nombre)
        if cliente_id:
            consulta = consulta.where(Mascota.cliente_id == cliente_id)
        if texto:
            patron = f"%{texto}%"
            consulta = consulta.where(
                or_(
                    Mascota.nombre.ilike(patron),
                    Cliente.apellido.ilike(patron),
                    Cliente.dni.ilike(patron),
                )
            )
        return list(self.sesion.scalars(consulta))

    def obtener(self, mascota_id: int) -> Mascota:
        return obtener_o_error(self.sesion, Mascota, mascota_id, "la mascota")

    def _validar(self, datos: MascotaEntrada) -> None:
        # Toda mascota debe tener un responsable existente
        obtener_o_error(self.sesion, Cliente, datos.cliente_id, "el cliente responsable")
        obtener_o_error(self.sesion, Especie, datos.especie_id, "la especie")
        if datos.fecha_nacimiento > date.today():
            raise ErrorNegocio("La fecha de nacimiento no puede ser futura.")

    def crear(self, datos: MascotaEntrada, fecha_apertura: date | None = None) -> Mascota:
        self._validar(datos)
        mascota = Mascota(**datos.model_dump())
        mascota.historia = HistoriaClinica(
            numero=generar_numero(self.sesion, HistoriaClinica, "HC"),
            fecha_apertura=fecha_apertura or date.today(),
        )
        self.sesion.add(mascota)
        self.sesion.commit()
        return mascota

    def actualizar(self, mascota_id: int, datos: MascotaEntrada) -> Mascota:
        mascota = self.obtener(mascota_id)
        self._validar(datos)
        for campo, valor in datos.model_dump().items():
            setattr(mascota, campo, valor)
        self.sesion.commit()
        return mascota

    def actualizar_historia(self, mascota_id: int, datos: HistoriaEntrada) -> Mascota:
        mascota = self.obtener(mascota_id)
        mascota.historia.alergias = datos.alergias
        mascota.historia.observaciones = datos.observaciones
        self.sesion.commit()
        return mascota


class ServicioVacunacion:
    """Control del esquema de vacunas obligatorias de cada especie."""

    def pendientes(
        self, mascota: Mascota, al_dia: date | None = None, excluir: set[int] | None = None
    ) -> list[VacunaPendiente]:
        hoy = al_dia or date.today()
        excluir = excluir or set()
        edad = mascota.edad_en_semanas(hoy)
        resultado: list[VacunaPendiente] = []
        for vacuna in mascota.especie.vacunas:
            if not vacuna.obligatoria or vacuna.id in excluir or edad < vacuna.edad_minima_semanas:
                continue
            fechas = [
                a.fecha for a in mascota.vacunas_aplicadas if a.vacuna_id == vacuna.id and a.fecha <= hoy
            ]
            if not fechas:
                resultado.append(
                    VacunaPendiente(
                        vacuna_id=vacuna.id,
                        nombre=vacuna.nombre,
                        situacion="NUNCA_APLICADA",
                        ultima_aplicacion=None,
                        vencimiento=None,
                    )
                )
            elif vacuna.refuerzo_meses:
                ultima = max(fechas)
                vencimiento = sumar_meses(ultima, vacuna.refuerzo_meses)
                if vencimiento < hoy:
                    resultado.append(
                        VacunaPendiente(
                            vacuna_id=vacuna.id,
                            nombre=vacuna.nombre,
                            situacion="REFUERZO_VENCIDO",
                            ultima_aplicacion=ultima,
                            vencimiento=vencimiento,
                        )
                    )
        return resultado

    @staticmethod
    def describir(pendiente: VacunaPendiente) -> str:
        if pendiente.situacion == "NUNCA_APLICADA":
            return f"Vacuna obligatoria pendiente: {pendiente.nombre} (nunca aplicada)."
        return (
            f"Vacuna obligatoria vencida: {pendiente.nombre} "
            f"(refuerzo vencido el {pendiente.vencimiento:%d/%m/%Y})."
        )


class ServicioAtenciones:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def listar(
        self,
        usuario: Usuario,
        clinica_id: int | None = None,
        mascota_id: int | None = None,
        desde: date | None = None,
        hasta: date | None = None,
        limite: int = 200,
    ) -> list[Atencion]:
        consulta = select(Atencion).order_by(Atencion.fecha.desc()).limit(limite)
        clinica_id = clinica_en_alcance(usuario, clinica_id)
        if clinica_id:
            consulta = consulta.where(Atencion.clinica_id == clinica_id)
        if mascota_id:
            consulta = consulta.join(Atencion.historia).where(
                HistoriaClinica.mascota_id == mascota_id
            )
        if desde:
            consulta = consulta.where(Atencion.fecha >= datetime.combine(desde, datetime.min.time()))
        if hasta:
            consulta = consulta.where(Atencion.fecha <= datetime.combine(hasta, datetime.max.time()))
        return list(self.sesion.scalars(consulta))

    def obtener(self, atencion_id: int) -> Atencion:
        return obtener_o_error(self.sesion, Atencion, atencion_id, "la atención")

    def _profesional_que_atiende(self, datos: AtencionEntrada, usuario: Usuario) -> Profesional:
        if usuario.rol == Rol.VETERINARIO:
            profesional = usuario.profesional
        else:
            if datos.profesional_id is None:
                raise ErrorNegocio("Indicá el profesional que realizó la atención.")
            profesional = obtener_o_error(
                self.sesion, Profesional, datos.profesional_id, "el profesional"
            )
        if profesional is None or profesional.tipo != TipoProfesional.VETERINARIO:
            raise ErrorNegocio("Las atenciones solo pueden registrarlas veterinarios.")
        if profesional.clinica_id is None:
            raise ErrorNegocio("El veterinario no tiene una clínica asignada.")
        return profesional

    def registrar(self, datos: AtencionEntrada, usuario: Usuario) -> tuple[Atencion, list[str]]:
        """Registra la atención con sus tratamientos, vacunas, insumos y derivación.

        Devuelve también las advertencias del esquema de vacunación: la atención
        se registra igual (podría ser una urgencia), pero se informa lo pendiente.
        """
        mascota = obtener_o_error(self.sesion, Mascota, datos.mascota_id, "la mascota")
        if not mascota.activa:
            raise ErrorNegocio("La mascota está dada de baja.")
        profesional = self._profesional_que_atiende(datos, usuario)
        fecha = datos.fecha or datetime.now()

        # Validación: esquema de vacunas obligatorias (advertencia, no bloqueo)
        vacunas_hoy = {v.vacuna_id for v in datos.vacunas}
        servicio_vacunas = ServicioVacunacion()
        advertencias = [
            servicio_vacunas.describir(p)
            for p in servicio_vacunas.pendientes(mascota, fecha.date(), excluir=vacunas_hoy)
        ]

        atencion = Atencion(
            historia=mascota.historia,
            clinica_id=profesional.clinica_id,
            profesional=profesional,
            tipo=datos.tipo,
            fecha=fecha,
            motivo=datos.motivo,
            diagnostico=datos.diagnostico,
            observaciones=datos.observaciones,
            peso_kg=datos.peso_kg,
        )
        self.sesion.add(atencion)
        if datos.peso_kg:
            mascota.peso_kg = datos.peso_kg

        if datos.turno_id:
            turno = obtener_o_error(self.sesion, Turno, datos.turno_id, "el turno")
            if turno.profesional_id != profesional.id or turno.estado != EstadoTurno.RESERVADO:
                raise ErrorNegocio("El turno indicado no está reservado para este profesional.")
            turno.estado = EstadoTurno.ATENDIDO
            atencion.turno_id = turno.id

        for tratamiento in datos.tratamientos:
            atencion.tratamientos.append(Tratamiento(**tratamiento.model_dump()))

        for aplicada in datos.vacunas:
            vacuna = obtener_o_error(self.sesion, Vacuna, aplicada.vacuna_id, "la vacuna")
            if vacuna.especie_id != mascota.especie_id:
                raise ErrorNegocio(f"La vacuna {vacuna.nombre} no corresponde a la especie.")
            self.sesion.add(
                AplicacionVacuna(
                    mascota=mascota, vacuna=vacuna, atencion=atencion,
                    fecha=fecha.date(), lote=aplicada.lote,
                )
            )

        self.sesion.flush()  # necesitamos el id de la atención para los movimientos

        for usado in datos.insumos:
            insumo = obtener_o_error(self.sesion, Insumo, usado.insumo_id, "el insumo")
            if insumo.clinica_id != atencion.clinica_id:
                raise ErrorNegocio(f"El insumo {insumo.nombre} no pertenece a la clínica.")
            insumo.registrar_movimiento(
                TipoMovimiento.EGRESO, usado.cantidad,
                f"Atención de {mascota.nombre}", usuario.id, atencion.id, fecha,
            )

        if datos.analisis:
            self._emitir_orden_derivacion(atencion, datos, usuario, fecha)

        self.sesion.commit()
        return atencion, advertencias

    def _emitir_orden_derivacion(
        self, atencion: Atencion, datos: AtencionEntrada, usuario: Usuario, fecha: datetime
    ) -> OrdenDerivacion:
        orden = OrdenDerivacion(
            numero=generar_numero(self.sesion, OrdenDerivacion, "OD"),
            atencion=atencion,
            fecha_emision=fecha,
            urgente=datos.derivacion_urgente,
            observaciones=datos.observaciones_derivacion,
        )
        registro = RegistroCambio(usuario.id, fecha=fecha)
        for indice, tipo_id in enumerate(datos.analisis, start=1):
            tipo = obtener_o_error(self.sesion, TipoAnalisis, tipo_id, "el tipo de análisis")
            if not tipo.activo:
                raise ErrorNegocio(f"El análisis {tipo.nombre} no está disponible.")
            orden.muestras.append(Muestra.extraer(f"{orden.numero}-{indice:02d}", tipo, registro))
        self.sesion.add(orden)
        self.sesion.flush()
        return orden

    def verificar_acceso(self, atencion: Atencion, usuario: Usuario) -> None:
        verificar_clinica(usuario, atencion.clinica_id)
