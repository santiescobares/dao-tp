"""Atajos de dependencias para los routers."""
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import obtener_sesion
from app.core.seguridad import obtener_usuario_actual, requiere_rol
from app.modelos.enums import Rol
from app.modelos.organizacion import Usuario

Sesion = Annotated[Session, Depends(obtener_sesion)]
UsuarioActual = Annotated[Usuario, Depends(obtener_usuario_actual)]
SoloAdmin = Annotated[Usuario, Depends(requiere_rol(Rol.ADMIN))]
PersonalClinica = Annotated[Usuario, Depends(requiere_rol(Rol.ADMIN, Rol.VETERINARIO))]
PersonalLaboratorio = Annotated[Usuario, Depends(requiere_rol(Rol.ADMIN, Rol.LABORATORISTA))]
SoloLaboratorista = Annotated[Usuario, Depends(requiere_rol(Rol.LABORATORISTA))]
