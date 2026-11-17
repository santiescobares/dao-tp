"""Empaquetado, cadena de envío y recepción en el laboratorio central."""
import secrets
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.excepciones import ErrorNegocio
from app.dominio.estados_muestra import RegistroCambio
from app.dominio.estados_remito import Preparado
from app.modelos.enums import (
    EstadoConservadora,
    EstadoPrecinto,
    MotivoRechazo,
    TipoEventoEnvio,
)
from app.modelos.envio import (
    Conservadora,
    EventoEnvio,
    PrecintoSanitario,
    RecepcionLaboratorio,
    RemitoBiologico,
)
from app.modelos.laboratorio import Muestra
from app.modelos.organizacion import Laboratorio, Usuario
from app.schemas.laboratorio import (
    ConservadoraResumen,
    DespachoEntrada,
    EventoEnvioEntrada,
    EventoEnvioSalida,
    MuestraSalida,
    PrecintoSalida,
    RecepcionEntrada,
    RecepcionSalida,
    RemitoEntrada,
    RemitoSalida,
)
from app.schemas.organizacion import ClinicaResumen
from app.servicios.comun import (
    clinica_en_alcance,
    generar_numero,
    obtener_o_error,
    verificar_clinica,
)


def remito_a_salida(remito: RemitoBiologico) -> RemitoSalida:
    return RemitoSalida(
        id=remito.id,
        numero=remito.numero,
        estado=remito.estado,
        estado_descripcion=remito.estado_actual.descripcion,
        clinica=ClinicaResumen.model_validate(remito.clinica),
        laboratorio=remito.laboratorio.nombre,
        conservadora=ConservadoraResumen.model_validate(remito.conservadora),
        fecha_emision=remito.fecha_emision,
        fecha_despacho=remito.fecha_despacho,
        fecha_recepcion=remito.fecha_recepcion,
        horas_en_transito=remito.horas_en_transito,
        transportista=remito.transportista,
        observaciones=remito.observaciones,
        emisor=remito.usuario_emisor.nombre if remito.usuario_emisor else None,
        precinto=PrecintoSalida.model_validate(remito.precinto),
        muestras=[MuestraSalida.desde(m) for m in remito.muestras],
        eventos=[EventoEnvioSalida.model_validate(e) for e in remito.eventos],
        recepcion=RecepcionSalida.model_validate(remito.recepcion) if remito.recepcion else None,
    )


class ServicioRemitos:
    def __init__(self, sesion: Session) -> None:
        self.sesion = sesion

    def listar(
        self, usuario: Usuario, estado: str | None = None, clinica_id: int | None = None
    ) -> list[RemitoBiologico]:
        consulta = select(RemitoBiologico).order_by(RemitoBiologico.fecha_emision.desc())
        clinica_id = clinica_en_alcance(usuario, clinica_id)
        if clinica_id:
            consulta = consulta.where(RemitoBiologico.clinica_id == clinica_id)
        if estado:
            consulta = consulta.where(RemitoBiologico.estado == estado)
        return list(self.sesion.scalars(consulta.limit(300)))

    def obtener(self, remito_id: int, usuario: Usuario | None = None) -> RemitoBiologico:
        remito = obtener_o_error(self.sesion, RemitoBiologico, remito_id, "el remito")
        if usuario:
            verificar_clinica(usuario, remito.clinica_id)
        return remito

    # ---------- Proceso 4: empaquetado ----------
    def crear(
        self, datos: RemitoEntrada, usuario: Usuario, fecha: datetime | None = None
    ) -> RemitoBiologico:
        """Empaqueta muestras en una conservadora, generando remito y precinto sanitario."""
        fecha = fecha or datetime.now()
        conservadora = obtener_o_error(
            self.sesion, Conservadora, datos.conservadora_id, "la conservadora"
        )
        verificar_clinica(usuario, conservadora.clinica_id)
        if conservadora.estado != EstadoConservadora.DISPONIBLE:
            raise ErrorNegocio(f"La conservadora {conservadora.codigo} no está disponible.")
        if len(set(datos.muestra_ids)) > conservadora.capacidad:
            raise ErrorNegocio(
                f"La conservadora {conservadora.codigo} admite hasta {conservadora.capacidad} muestras."
            )

        muestras: list[Muestra] = []
        for muestra_id in dict.fromkeys(datos.muestra_ids):
            muestra = obtener_o_error(self.sesion, Muestra, muestra_id, "la muestra")
            if muestra.orden.atencion.clinica_id != conservadora.clinica_id:
                raise ErrorNegocio(f"La muestra {muestra.codigo} es de otra clínica.")
            tipo = muestra.tipo_analisis
            # La conservadora debe mantener la temperatura que exige cada análisis
            if not (
                tipo.temperatura_min <= conservadora.temperatura_min
                and conservadora.temperatura_max <= tipo.temperatura_max
            ):
                raise ErrorNegocio(
                    f"La muestra {muestra.codigo} ({tipo.nombre}) requiere entre "
                    f"{tipo.temperatura_min:g} y {tipo.temperatura_max:g} °C y la conservadora "
                    f"trabaja entre {conservadora.temperatura_min:g} y {conservadora.temperatura_max:g} °C."
                )
            muestras.append(muestra)

        laboratorio = self.sesion.scalar(select(Laboratorio))
        if laboratorio is None:
            raise ErrorNegocio("No hay un laboratorio central configurado.")

        remito = RemitoBiologico(
            numero=generar_numero(self.sesion, RemitoBiologico, "RB"),
            clinica_id=conservadora.clinica_id,
            laboratorio=laboratorio,
            conservadora=conservadora,
            usuario_emisor_id=usuario.id,
            fecha_emision=fecha,
            estado=Preparado.nombre,
            observaciones=datos.observaciones,
        )
        remito.precinto = PrecintoSanitario(
            codigo=f"PS-{secrets.token_hex(4).upper()}", fecha_colocacion=fecha
        )
        registro = RegistroCambio(usuario.id, f"Empaquetada en {conservadora.codigo}", fecha)
        for muestra in muestras:
            muestra.empaquetar(registro)  # el State rechaza muestras que no estén Extraídas
            remito.muestras.append(muestra)
        conservadora.estado = EstadoConservadora.EN_USO
        self.sesion.add(remito)
        self.sesion.commit()
        return remito

    # ---------- Proceso 5: cadena de envío ----------
    def despachar(
        self, remito_id: int, datos: DespachoEntrada, usuario: Usuario, fecha: datetime | None = None
    ) -> RemitoBiologico:
        remito = self.obtener(remito_id, usuario)
        fecha = fecha or datetime.now()
        remito.transportista = datos.transportista
        remito.despachar(RegistroCambio(usuario.id, f"Despachado con {datos.transportista}", fecha))
        self._agregar_evento(
            remito, TipoEventoEnvio.DESPACHO, datos.ubicacion, datos.transportista,
            datos.temperatura, datos.observacion, usuario, fecha,
        )
        self.sesion.commit()
        return remito

    def registrar_evento(
        self, remito_id: int, datos: EventoEnvioEntrada, usuario: Usuario, fecha: datetime | None = None
    ) -> RemitoBiologico:
        remito = self.obtener(remito_id)
        remito.validar_evento_envio()  # solo en tránsito
        self._agregar_evento(
            remito, TipoEventoEnvio.PUNTO_CONTROL, datos.ubicacion, datos.responsable,
            datos.temperatura, datos.observacion, usuario, fecha or datetime.now(),
        )
        self.sesion.commit()
        return remito

    def _agregar_evento(
        self, remito, tipo, ubicacion, responsable, temperatura, observacion, usuario, fecha
    ) -> EventoEnvio:
        conservadora = remito.conservadora
        fuera_de_rango = temperatura is not None and not (
            conservadora.temperatura_min <= temperatura <= conservadora.temperatura_max
        )
        evento = EventoEnvio(
            tipo=tipo, ubicacion=ubicacion, responsable=responsable, temperatura=temperatura,
            fuera_de_rango=fuera_de_rango, observacion=observacion, usuario_id=usuario.id,
            fecha=fecha,
        )
        remito.eventos.append(evento)
        return evento

    # ---------- Proceso 6: recepción en el laboratorio ----------
    def recibir(
        self, remito_id: int, datos: RecepcionEntrada, usuario: Usuario, fecha: datetime | None = None
    ) -> RemitoBiologico:
        """Verifica el precinto. Si llega roto, se rechaza todo el remito."""
        remito = self.obtener(remito_id)
        fecha = fecha or datetime.now()
        precinto = remito.precinto
        precinto_ok = datos.estado_precinto == EstadoPrecinto.INTACTO
        # Un precinto declarado intacto tiene que coincidir con el emitido: si no,
        # se pide revisar el dato (no se rechaza por un error de tipeo). Para
        # rechazar un precinto cambiado hay que declararlo roto.
        if precinto_ok and datos.codigo_precinto.strip().upper() != precinto.codigo.upper():
            raise ErrorNegocio(
                "El código ingresado no coincide con el precinto emitido para este remito. "
                "Verificalo; si el precinto fue reemplazado o violado, registralo como roto."
            )

        if precinto_ok:
            rechazos = self._rechazos_por_viabilidad(remito, datos, fecha)
            remito.recibir(RegistroCambio(usuario.id, "Recepción conforme", fecha), rechazos)
        else:
            remito.rechazar(MotivoRechazo.PRECINTO_ROTO, RegistroCambio(usuario.id, "Precinto roto", fecha))

        precinto.estado = EstadoPrecinto.INTACTO if precinto_ok else EstadoPrecinto.ROTO
        precinto.fecha_verificacion = fecha
        precinto.verificado_por_id = usuario.id
        remito.recepcion = RecepcionLaboratorio(
            fecha=fecha,
            usuario_id=usuario.id,
            estado_precinto=precinto.estado,
            codigo_precinto_verificado=datos.codigo_precinto.strip().upper(),
            temperatura_llegada=datos.temperatura_llegada,
            aceptada=precinto_ok,
            observaciones=datos.observaciones,
        )
        self._agregar_evento(
            remito, TipoEventoEnvio.ENTREGA, remito.laboratorio.nombre, usuario.nombre,
            datos.temperatura_llegada, "Entrega en laboratorio central", usuario, fecha,
        )
        # La conservadora vuelve a quedar disponible para su clínica
        remito.conservadora.estado = EstadoConservadora.DISPONIBLE
        self.sesion.commit()
        return remito

    def _rechazos_por_viabilidad(
        self, remito: RemitoBiologico, datos: RecepcionEntrada, fecha: datetime
    ) -> dict[int, MotivoRechazo]:
        """Rechazos indicados por el laboratorista más los detectados automáticamente."""
        ids_remito = {m.id for m in remito.muestras}
        rechazos: dict[int, MotivoRechazo] = {}
        for rechazo in datos.rechazos:
            if rechazo.muestra_id not in ids_remito:
                raise ErrorNegocio(f"La muestra {rechazo.muestra_id} no pertenece al remito.")
            rechazos[rechazo.muestra_id] = rechazo.motivo
        for muestra in remito.muestras:
            if muestra.id in rechazos:
                continue
            tipo = muestra.tipo_analisis
            temperatura = datos.temperatura_llegada
            if temperatura is not None and not (tipo.temperatura_min <= temperatura <= tipo.temperatura_max):
                rechazos[muestra.id] = MotivoRechazo.TEMPERATURA_FUERA_RANGO
            elif (fecha - muestra.fecha_extraccion).total_seconds() / 3600 > tipo.horas_viabilidad:
                rechazos[muestra.id] = MotivoRechazo.TIEMPO_EXCEDIDO
        return rechazos
