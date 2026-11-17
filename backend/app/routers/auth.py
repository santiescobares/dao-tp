from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.seguridad import crear_token, verificar_password
from app.modelos.organizacion import Usuario
from app.routers.dependencias import Sesion, UsuarioActual
from app.schemas.organizacion import LoginEntrada, TokenSalida, UsuarioSalida

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenSalida)
def login(datos: LoginEntrada, sesion: Sesion):
    usuario = sesion.scalar(select(Usuario).where(Usuario.email == datos.email))
    if usuario is None or not verificar_password(datos.password, usuario.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email o contraseña incorrectos.")
    if not usuario.activo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El usuario está deshabilitado.")
    return TokenSalida(token=crear_token(usuario), usuario=UsuarioSalida.model_validate(usuario))


@router.get("/me", response_model=UsuarioSalida)
def usuario_actual(usuario: UsuarioActual):
    return usuario
