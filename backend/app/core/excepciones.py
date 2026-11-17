"""Excepciones de negocio. Cada una sabe con qué código HTTP se informa."""


class ErrorNegocio(Exception):
    codigo_http = 400

    def __init__(self, mensaje: str) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje


class NoEncontradoError(ErrorNegocio):
    codigo_http = 404


class PermisoDenegadoError(ErrorNegocio):
    codigo_http = 403


class TransicionInvalidaError(ErrorNegocio):
    """Se intentó un cambio de estado que el estado actual no permite."""

    codigo_http = 409


class TurnoSuperpuestoError(ErrorNegocio):
    codigo_http = 409


class TrazabilidadInmutableError(ErrorNegocio):
    codigo_http = 409
