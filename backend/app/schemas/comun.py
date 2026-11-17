from pydantic import BaseModel, ConfigDict


class Esquema(BaseModel):
    """Base de todos los schemas: permite construirlos desde objetos ORM."""

    model_config = ConfigDict(from_attributes=True)


class Mensaje(Esquema):
    mensaje: str
