"""Prueba de humo de la API sobre la base de demostración."""
import pytest
from fastapi.testclient import TestClient

from app import seed
from app.core.database import BaseDeDatos
from app.core.singleton import SingletonMeta


@pytest.fixture(scope="module")
def api(tmp_path_factory):
    SingletonMeta.reiniciar(BaseDeDatos)
    ruta = tmp_path_factory.mktemp("api") / "demo.db"
    BaseDeDatos(f"sqlite:///{ruta.as_posix()}")
    seed.main()
    from app.main import app

    with TestClient(app) as cliente:
        yield cliente
    BaseDeDatos().engine.dispose()
    SingletonMeta.reiniciar(BaseDeDatos)


def _token(api, email, password):
    respuesta = api.post("/api/auth/login", json={"email": email, "password": password})
    assert respuesta.status_code == 200, respuesta.text
    return {"Authorization": f"Bearer {respuesta.json()['token']}"}


def test_login_incorrecto(api):
    assert api.post("/api/auth/login", json={"email": "admin@vetred.com", "password": "mal"}).status_code == 401


def test_sin_token_no_hay_acceso(api):
    assert api.get("/api/clientes").status_code == 401


@pytest.mark.parametrize("ruta", [
    "/api/auth/me", "/api/clientes", "/api/mascotas", "/api/mascotas/1/historia", "/api/atenciones",
    "/api/muestras", "/api/remitos", "/api/comprobantes", "/api/conservadoras", "/api/insumos",
    "/api/turnos", "/api/horarios", "/api/clinicas", "/api/profesionales", "/api/usuarios",
    "/api/especies", "/api/vacunas", "/api/tipos-analisis", "/api/reportes/tablero",
    "/api/reportes/atenciones", "/api/reportes/rechazos", "/api/reportes/tiempos",
    "/api/reportes/facturacion", "/api/reportes/tratamientos-vacunas", "/api/muestras/1/trazabilidad",
])
def test_endpoints_de_consulta_como_admin(api, ruta):
    respuesta = api.get(ruta, headers=_token(api, "admin@vetred.com", "admin123"))
    assert respuesta.status_code == 200, respuesta.text


def test_permisos_por_rol(api):
    vet = _token(api, "vet1@vetred.com", "vet123")
    lab = _token(api, "lab1@vetred.com", "lab123")
    assert api.get("/api/usuarios", headers=vet).status_code == 403
    assert api.post("/api/atenciones", json={}, headers=lab).status_code == 403
    # El veterinario solo ve las atenciones de su clínica
    atenciones = api.get("/api/atenciones", headers=vet).json()
    assert atenciones and {a["clinica"]["id"] for a in atenciones} == {1}


def test_flujo_de_recepcion_con_precinto_roto(api):
    lab = _token(api, "lab1@vetred.com", "lab123")
    remito = api.get("/api/remitos?estado=EN_TRANSITO", headers=lab).json()[0]
    respuesta = api.post(f"/api/remitos/{remito['id']}/recepcion", headers=lab, json={
        "estado_precinto": "ROTO", "codigo_precinto": remito["precinto"]["codigo"],
    })
    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "RECHAZADO"
    muestra_id = respuesta.json()["muestras"][0]["id"]
    error = api.post(f"/api/muestras/{muestra_id}/resultado", headers=lab,
                     json={"valores": "xxxx", "conclusion": "xxxx"})
    assert error.status_code == 409
    assert "rechazada" in error.json()["detail"]
