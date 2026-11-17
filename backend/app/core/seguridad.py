"""Hash de contraseñas, emisión de JWT y dependencias de autorización."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Configuracion
from app.core.database import obtener_sesion
from app.modelos.enums import Rol
from app.modelos.organizacion import Usuario

esquema_bearer = HTTPBearer(auto_error=False)


def hashear_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verificar_password(password: str, hash_guardado: str) -> bool:
    return bcrypt.checkpw(password.encode(), hash_guardado.encode())


def crear_token(usuario: Usuario) -> str:
    config = Configuracion()
    expira = datetime.now(timezone.utc) + timedelta(minutes=config.minutos_expiracion_token)
    datos = {"sub": str(usuario.id), "rol": usuario.rol.value, "exp": expira}
    return jwt.encode(datos, config.secreto_jwt, algorithm=config.algoritmo_jwt)


def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(esquema_bearer),
    sesion: Session = Depends(obtener_sesion),
) -> Usuario:
    no_autorizado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesión inválida o vencida. Volvé a iniciar sesión.",
    )
    if credenciales is None:
        raise no_autorizado
    config = Configuracion()
    try:
        datos = jwt.decode(
            credenciales.credentials, config.secreto_jwt, algorithms=[config.algoritmo_jwt]
        )
    except jwt.PyJWTError:
        raise no_autorizado
    usuario = sesion.get(Usuario, int(datos["sub"]))
    if usuario is None or not usuario.activo:
        raise no_autorizado
    return usuario


def requiere_rol(*roles: Rol):
    """Devuelve una dependencia que solo deja pasar a los roles indicados."""

    def _verificar(usuario: Usuario = Depends(obtener_usuario_actual)) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés permisos para realizar esta acción.",
            )
        return usuario

    return _verificar
