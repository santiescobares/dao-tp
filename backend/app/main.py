"""Punto de entrada de la API. Ejecutar con: uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import Configuracion
from app.core.database import BaseDeDatos
from app.core.excepciones import ErrorNegocio
from app.routers import administracion, auth, clinico, gestion, laboratorio, reportes


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    BaseDeDatos().crear_tablas()
    yield


config = Configuracion()
app = FastAPI(title=config.nombre_app, version="1.0.0", lifespan=ciclo_de_vida)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.origenes_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ErrorNegocio)
async def manejar_error_negocio(_request: Request, error: ErrorNegocio):
    """Toda regla de negocio violada llega al frontend como {detail: mensaje}."""
    return JSONResponse(status_code=error.codigo_http, content={"detail": error.mensaje})


for modulo in (auth, administracion, clinico, laboratorio, gestion, reportes):
    app.include_router(modulo.router, prefix="/api")


@app.get("/api/salud", tags=["Sistema"])
def salud():
    return {"estado": "ok"}
