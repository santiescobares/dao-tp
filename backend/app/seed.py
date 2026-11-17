"""Carga datos de demostración. Ejecutar con: python -m app.seed

Recrea la base y simula ~6 meses de actividad de la red usando los mismos
servicios que la API, así todas las reglas de negocio se respetan y los
reportes tienen datos. Es determinístico (semilla fija).
"""
import random
import unicodedata
from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core.database import BaseDeDatos
from app.core.seguridad import hashear_password
from app.modelos.agenda import HorarioProfesional
from app.modelos.clinico import Especie, Vacuna
from app.modelos.enums import (
    EstadoConservadora,
    EstadoPrecinto,
    MotivoRechazo,
    Rol,
    Sexo,
    TipoAtencion,
    TipoMovimiento,
    TipoMuestra,
    TipoProfesional,
    TipoTurno,
)
from app.modelos.envio import Conservadora
from app.modelos.laboratorio import TipoAnalisis
from app.modelos.organizacion import Clinica, Laboratorio, Profesional, Usuario
from app.modelos.stock import Insumo
from app.schemas.clinico import (
    AtencionEntrada,
    ClienteEntrada,
    InsumoUsadoEntrada,
    MascotaEntrada,
    TratamientoEntrada,
    VacunaAplicadaEntrada,
)
from app.schemas.gestion import TurnoEntrada
from app.schemas.laboratorio import (
    DespachoEntrada,
    EventoEnvioEntrada,
    RecepcionEntrada,
    RechazoIndividual,
    RemitoEntrada,
    ResultadoEntrada,
)
from app.servicios.agenda import ServicioAgenda
from app.servicios.clinico import ServicioAtenciones, ServicioClientes, ServicioMascotas, ServicioVacunacion
from app.servicios.envios import ServicioRemitos
from app.servicios.facturacion import ServicioFacturacion
from app.servicios.laboratorio import ServicioMuestras

azar = random.Random(2026)
AHORA = datetime.now().replace(second=0, microsecond=0)
DIAS_DE_HISTORIA = 180

NOMBRES = ["Lucía", "Martín", "Sofía", "Juan", "Valentina", "Mateo", "Camila", "Santiago", "Julieta",
           "Tomás", "Florencia", "Agustín", "Micaela", "Nicolás", "Carolina", "Facundo", "Paula",
           "Joaquín", "Agustina", "Federico", "Rocío", "Ignacio", "Daniela", "Gonzalo", "Milagros",
           "Lautaro", "Victoria", "Franco", "Antonella", "Emiliano"]
APELLIDOS = ["González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez",
             "García", "Sánchez", "Romero", "Sosa", "Torres", "Álvarez", "Ruiz", "Ramírez", "Flores",
             "Benítez", "Acosta", "Medina", "Herrera", "Suárez", "Aguirre", "Giménez", "Gutiérrez",
             "Pereyra", "Molina", "Castro", "Ortiz", "Silva"]
CALLES = ["Av. Colón", "Bv. San Juan", "Duarte Quirós", "Av. Vélez Sarsfield", "Rondeau",
          "Obispo Trejo", "Av. Rafael Núñez", "Caseros", "Av. Hipólito Yrigoyen", "Belgrano"]
MASCOTAS = {
    "Perro": (["Toby", "Luna", "Rocky", "Mora", "Simón", "Nala", "Bruno", "Lola", "Rex", "Kira",
               "Thor", "Frida", "Coco", "Maya", "Felipe"],
              ["Mestizo", "Labrador", "Golden Retriever", "Caniche", "Bulldog Francés",
               "Ovejero Alemán", "Beagle", "Border Collie"]),
    "Gato": (["Michi", "Oliver", "Mía", "Garfield", "Kiara", "Salem", "Pelusa", "Tom", "Uma",
              "Felix"],
             ["Común europeo", "Siamés", "Persa", "Maine Coon", "Angora"]),
}
MOTIVOS = {
    TipoAtencion.CONSULTA: ["Decaimiento y falta de apetito", "Vómitos ocasionales", "Diarrea",
                            "Picazón y pérdida de pelo", "Tos persistente", "Cojera en miembro posterior",
                            "Otitis", "Control de peso"],
    TipoAtencion.CONTROL: ["Control anual", "Control post operatorio", "Control de vacunación",
                           "Control geriátrico", "Control de tratamiento dermatológico"],
    TipoAtencion.URGENCIA: ["Traumatismo por atropello", "Intoxicación", "Dificultad respiratoria",
                            "Convulsiones", "Herida por mordedura", "Golpe de calor"],
}
DIAGNOSTICOS = ["Gastroenteritis leve", "Dermatitis alérgica", "Otitis externa", "Sin hallazgos patológicos",
                "Infección urinaria", "Parasitosis intestinal", "Traqueobronquitis", "Esguince leve",
                "Insuficiencia renal en estudio", "Sobrepeso"]
TRATAMIENTOS = [
    ("Antibioticoterapia", "Amoxicilina + ác. clavulánico", "12,5 mg/kg cada 12 h", 7),
    ("Antiparasitario interno", "Praziquantel + pirantel", "1 comp. cada 10 kg", 1),
    ("Antiinflamatorio", "Meloxicam", "0,1 mg/kg cada 24 h", 5),
    ("Protector gástrico", "Omeprazol", "1 mg/kg cada 24 h", 10),
    ("Tratamiento ótico", "Gotas óticas con gentamicina", "5 gotas cada 12 h", 10),
    ("Dieta gastrointestinal", None, None, 15),
    ("Antialérgico", "Oclacitinib", "0,4 mg/kg cada 12 h", 14),
]
TRANSPORTISTAS = ["LogiVet Express", "BioCadena SRL", "Transporte Sanitario Córdoba"]


def sin_acentos(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()


def _usuario(sesion: Session, email: str, nombre: str, rol: Rol, password: str, profesional=None) -> Usuario:
    usuario = Usuario(
        email=email, nombre=nombre, rol=rol, password_hash=hashear_password(password),
        profesional=profesional,
    )
    sesion.add(usuario)
    return usuario


def cargar_maestros(sesion: Session) -> dict:
    lab = Laboratorio(nombre="Laboratorio Central VetRed", direccion="Av. Fuerza Aérea 2350, Córdoba")
    clinicas = [
        Clinica(nombre="Clínica Centro", direccion="Av. Colón 1250, Córdoba", telefono="351 422-1100"),
        Clinica(nombre="Clínica Norte", direccion="Av. Rafael Núñez 4560, Córdoba", telefono="351 481-2200"),
        Clinica(nombre="Clínica Sierras", direccion="Av. San Martín 820, Villa Carlos Paz", telefono="3541 43-3300"),
    ]
    sesion.add_all([lab, *clinicas])
    sesion.flush()

    datos_vets = [
        ("Ana", "Ferreyra", "MP-1021", "Clínica general", 0),
        ("Diego", "Barrionuevo", "MP-1188", "Cirugía", 0),
        ("Carla", "Mansilla", "MP-1340", "Dermatología", 1),
        ("Pablo", "Quinteros", "MP-1402", "Clínica general", 1),
        ("Laura", "Vaca", "MP-1517", "Cardiología", 2),
        ("Germán", "Olmedo", "MP-1633", "Clínica general", 2),
    ]
    veterinarios = []
    for nombre, apellido, matricula, especialidad, indice in datos_vets:
        veterinarios.append(Profesional(
            nombre=nombre, apellido=apellido, matricula=matricula, especialidad=especialidad,
            tipo=TipoProfesional.VETERINARIO, clinica=clinicas[indice],
        ))
    laboratoristas = [
        Profesional(nombre="Marta", apellido="Cabrera", matricula="BQ-0451", especialidad="Bioquímica clínica",
                    tipo=TipoProfesional.LABORATORISTA),
        Profesional(nombre="Hernán", apellido="Luna", matricula="BQ-0517", especialidad="Microbiología",
                    tipo=TipoProfesional.LABORATORISTA),
        Profesional(nombre="Silvina", apellido="Paz", matricula="BQ-0602", especialidad="Anatomía patológica",
                    tipo=TipoProfesional.LABORATORISTA),
    ]
    sesion.add_all(veterinarios + laboratoristas)
    sesion.flush()

    _usuario(sesion, "admin@vetred.com", "Administración VetRed", Rol.ADMIN, "admin123")
    usuarios_vet = {}
    for i, vet in enumerate(veterinarios, start=1):
        usuarios_vet[vet.id] = _usuario(
            sesion, f"vet{i}@vetred.com", f"{vet.nombre} {vet.apellido}", Rol.VETERINARIO, "vet123", vet
        )
    usuarios_lab = [
        _usuario(sesion, f"lab{i}@vetred.com", f"{p.nombre} {p.apellido}", Rol.LABORATORISTA, "lab123", p)
        for i, p in enumerate(laboratoristas, start=1)
    ]

    perro, gato = Especie(nombre="Perro"), Especie(nombre="Gato")
    sesion.add_all([perro, gato])
    sesion.flush()
    sesion.add_all([
        Vacuna(nombre="Séxtuple canina", especie=perro, obligatoria=True, edad_minima_semanas=8, refuerzo_meses=12, precio=9500),
        Vacuna(nombre="Antirrábica canina", especie=perro, obligatoria=True, edad_minima_semanas=12, refuerzo_meses=12, precio=6000),
        Vacuna(nombre="Tos de las perreras", especie=perro, obligatoria=False, edad_minima_semanas=12, refuerzo_meses=12, precio=8000),
        Vacuna(nombre="Triple felina", especie=gato, obligatoria=True, edad_minima_semanas=8, refuerzo_meses=12, precio=9000),
        Vacuna(nombre="Antirrábica felina", especie=gato, obligatoria=True, edad_minima_semanas=12, refuerzo_meses=12, precio=6000),
        Vacuna(nombre="Leucemia felina", especie=gato, obligatoria=False, edad_minima_semanas=9, refuerzo_meses=12, precio=11000),
    ])

    tipos = [
        TipoAnalisis(nombre="Hemograma completo", tipo_muestra=TipoMuestra.SANGRE, precio=9000, temperatura_min=2, temperatura_max=8, horas_viabilidad=48),
        TipoAnalisis(nombre="Bioquímica sérica", tipo_muestra=TipoMuestra.SANGRE, precio=12500, temperatura_min=2, temperatura_max=8, horas_viabilidad=48),
        TipoAnalisis(nombre="Urianálisis completo", tipo_muestra=TipoMuestra.ORINA, precio=7000, temperatura_min=2, temperatura_max=8, horas_viabilidad=24),
        TipoAnalisis(nombre="Coproparasitológico", tipo_muestra=TipoMuestra.HECES, precio=6000, temperatura_min=2, temperatura_max=8, horas_viabilidad=72),
        TipoAnalisis(nombre="Cultivo y antibiograma", tipo_muestra=TipoMuestra.HISOPADO, precio=15500, temperatura_min=2, temperatura_max=8, horas_viabilidad=48),
        TipoAnalisis(nombre="Histopatología", tipo_muestra=TipoMuestra.TEJIDO, precio=26000, temperatura_min=15, temperatura_max=25, horas_viabilidad=168),
    ]
    sesion.add_all(tipos)

    for clinica in clinicas:
        sigla = clinica.nombre.split()[-1][:3].upper()
        sesion.add_all([
            Conservadora(codigo=f"CR-{sigla}-01", clinica=clinica, descripcion="Conservadora refrigerada 12 L", capacidad=8, temperatura_min=2, temperatura_max=8),
            Conservadora(codigo=f"CR-{sigla}-02", clinica=clinica, descripcion="Conservadora refrigerada 12 L", capacidad=8, temperatura_min=2, temperatura_max=8),
            Conservadora(codigo=f"CA-{sigla}-01", clinica=clinica, descripcion="Contenedor rígido temperatura ambiente", capacidad=4, temperatura_min=15, temperatura_max=25),
            Conservadora(codigo=f"CR-{sigla}-03", clinica=clinica, descripcion="Conservadora refrigerada 6 L", capacidad=4, temperatura_min=2, temperatura_max=8, estado=EstadoConservadora.MANTENIMIENTO),
        ])
        for nombre, unidad, minimo, inicial in [
            ("Tubos EDTA 2 ml", "u", 30, 350), ("Tubos sin aditivo", "u", 30, 25),
            ("Frascos estériles de orina", "u", 20, 60), ("Geles refrigerantes", "u", 10, 40),
            ("Jeringas 5 ml", "u", 50, 300), ("Guantes de látex", "pares", 100, 80),
            ("Formol 10 %", "ml", 500, 2000),
        ]:
            insumo = Insumo(clinica=clinica, nombre=nombre, unidad=unidad, stock_minimo=minimo, stock_actual=0)
            sesion.add(insumo)
            insumo.registrar_movimiento(
                TipoMovimiento.INGRESO, inicial, "Stock inicial", None,
                fecha=AHORA - timedelta(days=DIAS_DE_HISTORIA + 5),
            )

    # Horarios: veterinarios lunes a sábado; laboratorio lunes a viernes
    for vet in veterinarios:
        for dia in range(6):
            sesion.add(HorarioProfesional(profesional=vet, dia_semana=dia, hora_desde=time(9), hora_hasta=time(13)))
            if dia < 5:
                sesion.add(HorarioProfesional(profesional=vet, dia_semana=dia, hora_desde=time(16), hora_hasta=time(20)))
    for lab_prof in laboratoristas:
        for dia in range(5):
            sesion.add(HorarioProfesional(profesional=lab_prof, dia_semana=dia, hora_desde=time(8), hora_hasta=time(17)))

    sesion.commit()
    return {
        "clinicas": clinicas, "veterinarios": veterinarios, "usuarios_vet": usuarios_vet,
        "usuarios_lab": usuarios_lab, "tipos": tipos, "especies": {"Perro": perro, "Gato": gato},
    }


def cargar_clientes_y_mascotas(sesion: Session, especies: dict) -> list:
    servicio_clientes, servicio_mascotas = ServicioClientes(sesion), ServicioMascotas(sesion)
    mascotas = []
    for i in range(30):
        cliente = servicio_clientes.crear(ClienteEntrada(
            dni=str(25_000_000 + i * 600_000 + azar.randint(0, 99_999)),
            nombre=NOMBRES[i], apellido=APELLIDOS[i],
            telefono=f"351 {azar.randint(400, 699)}-{azar.randint(1000, 9999)}",
            email=f"{sin_acentos(NOMBRES[i]).lower()}.{sin_acentos(APELLIDOS[i]).lower()}@correo.com",
            direccion=f"{azar.choice(CALLES)} {azar.randint(100, 4500)}",
        ))
        for _ in range(azar.choice([1, 1, 2, 2])):
            especie = azar.choice(["Perro", "Perro", "Gato"])
            nombres, razas = MASCOTAS[especie]
            nacimiento = date.today() - timedelta(days=azar.randint(70, 12 * 365))
            mascotas.append(servicio_mascotas.crear(
                MascotaEntrada(
                    nombre=azar.choice(nombres), especie_id=especies[especie].id, raza=azar.choice(razas),
                    sexo=azar.choice(list(Sexo)), fecha_nacimiento=nacimiento,
                    peso_kg=round(azar.uniform(3, 35) if especie == "Perro" else azar.uniform(2.5, 6), 1),
                    cliente_id=cliente.id,
                ),
                fecha_apertura=max(nacimiento, date.today() - timedelta(days=DIAS_DE_HISTORIA + 10)),
            ))
    return mascotas


def _fecha_atencion(tipo: TipoAtencion, dias_atras: int) -> datetime:
    dia = AHORA.date() - timedelta(days=dias_atras)
    if tipo == TipoAtencion.URGENCIA:
        hora = azar.choice([2, 8, 11, 15, 19, 21, 23])
    else:
        hora = azar.choice([9, 10, 11, 12, 16, 17, 18, 19])
    fecha = datetime.combine(dia, time(hora, azar.choice([0, 15, 30, 45])))
    return min(fecha, AHORA - timedelta(hours=1))


def simular_actividad(sesion: Session, maestros: dict, mascotas: list) -> None:
    atenciones_srv = ServicioAtenciones(sesion)
    remitos_srv = ServicioRemitos(sesion)
    muestras_srv = ServicioMuestras(sesion)
    facturacion_srv = ServicioFacturacion(sesion)
    vacunacion = ServicioVacunacion()
    tipos = maestros["tipos"]
    refrigerados = [t for t in tipos if t.temperatura_max <= 8]
    histopatologia = next(t for t in tipos if t.temperatura_min >= 15)

    # Las fechas se generan en orden cronológico para que la trazabilidad sea coherente
    dias = sorted((azar.randint(0, DIAS_DE_HISTORIA) for _ in range(160)), reverse=True)
    for dias_atras in dias:
        tipo = azar.choices(list(TipoAtencion), weights=[50, 35, 15])[0]
        fecha = _fecha_atencion(tipo, dias_atras)
        mascota = azar.choice([m for m in mascotas if m.fecha_nacimiento < fecha.date()])
        clinica = azar.choices(maestros["clinicas"], weights=[45, 35, 20])[0]
        vet = azar.choice([v for v in maestros["veterinarios"] if v.clinica_id == clinica.id])
        usuario_vet = maestros["usuarios_vet"][vet.id]

        pendientes = vacunacion.pendientes(mascota, fecha.date())
        vacunas = [VacunaAplicadaEntrada(vacuna_id=p.vacuna_id, lote=f"L{azar.randint(1000, 9999)}")
                   for p in pendientes if azar.random() < 0.55]
        tratamientos = [TratamientoEntrada(descripcion=t[0], medicamento=t[1], dosis=t[2], duracion_dias=t[3])
                        for t in azar.sample(TRATAMIENTOS, k=azar.choice([0, 1, 1, 2]))]
        analisis = []
        if azar.random() < 0.45:
            analisis = [t.id for t in azar.sample(refrigerados, k=azar.choice([1, 1, 2, 3]))]
            if azar.random() < 0.12:
                analisis.append(histopatologia.id)
        insumos = []
        if analisis:
            tubos = next(i for i in clinica_insumos(sesion, clinica.id) if i.nombre.startswith("Tubos EDTA"))
            insumos.append(InsumoUsadoEntrada(insumo_id=tubos.id, cantidad=len(analisis)))

        atencion, _ = atenciones_srv.registrar(AtencionEntrada(
            mascota_id=mascota.id, tipo=tipo, fecha=fecha,
            motivo=azar.choice(MOTIVOS[tipo]), diagnostico=azar.choice(DIAGNOSTICOS),
            peso_kg=mascota.peso_kg, tratamientos=tratamientos, vacunas=vacunas, insumos=insumos,
            analisis=analisis, derivacion_urgente=tipo == TipoAtencion.URGENCIA,
        ), usuario_vet)

        if atencion.ordenes:
            procesar_derivacion(sesion, atencion, usuario_vet, maestros, remitos_srv, muestras_srv)

        if fecha < AHORA - timedelta(days=3) and azar.random() < 0.9:
            facturacion_srv.emitir(atencion.id, usuario_vet, fecha + timedelta(minutes=40))


def clinica_insumos(sesion: Session, clinica_id: int) -> list[Insumo]:
    return list(sesion.query(Insumo).filter(Insumo.clinica_id == clinica_id))


def procesar_derivacion(sesion, atencion, usuario_vet, maestros, remitos_srv, muestras_srv) -> None:
    """Lleva las muestras de la atención por el circuito, según qué tan vieja es."""
    horas_desde_atencion = (AHORA - atencion.fecha).total_seconds() / 3600
    if horas_desde_atencion < 6:
        return  # muy reciente: las muestras quedan Extraídas, listas para empaquetar

    muestras = [m for orden in atencion.ordenes for m in orden.muestras]
    grupos = {
        "refrigerada": [m for m in muestras if m.tipo_analisis.temperatura_max <= 8],
        "ambiente": [m for m in muestras if m.tipo_analisis.temperatura_min >= 15],
    }
    lab_usuario = azar.choice(maestros["usuarios_lab"])
    for tipo_conservadora, grupo in grupos.items():
        if not grupo:
            continue
        prefijo = "CR-" if tipo_conservadora == "refrigerada" else "CA-"
        conservadora = next(
            (c for c in sesion.query(Conservadora).filter(Conservadora.clinica_id == atencion.clinica_id)
             if c.codigo.startswith(prefijo) and c.estado == EstadoConservadora.DISPONIBLE),
            None,
        )
        if conservadora is None:
            continue  # no hay conservadora libre: las muestras esperan en la clínica
        t = atencion.fecha + timedelta(hours=azar.uniform(0.5, 2))
        remito = remitos_srv.crear(
            RemitoEntrada(conservadora_id=conservadora.id, muestra_ids=[m.id for m in grupo]),
            usuario_vet, t,
        )
        if horas_desde_atencion < 10:
            continue  # empaquetado, pendiente de despacho

        t += timedelta(hours=azar.uniform(0.5, 2))
        rango = (conservadora.temperatura_min, conservadora.temperatura_max)
        temperatura_ok = lambda: round(azar.uniform(rango[0] + 0.5, rango[1] - 0.5), 1)  # noqa: E731
        remitos_srv.despachar(remito.id, DespachoEntrada(
            transportista=azar.choice(TRANSPORTISTAS), ubicacion=atencion.clinica.nombre,
            temperatura=temperatura_ok(),
        ), usuario_vet, t)

        # La clínica de las sierras está más lejos: tránsitos más largos
        lejos = atencion.clinica.nombre == "Clínica Sierras"
        horas_transito = azar.uniform(6, 26) if lejos else azar.uniform(2, 14)
        falla = azar.random()
        temperatura_llegada = temperatura_ok()
        if falla < 0.10:  # corte de la cadena de frío
            temperatura_llegada = round(rango[1] + azar.uniform(3, 8), 1)
        t_control = t + timedelta(hours=horas_transito / 2)
        if t_control < AHORA:
            remitos_srv.registrar_evento(remito.id, EventoEnvioEntrada(
                ubicacion=azar.choice(["Centro de distribución Ruta 20", "Base logística Ruta 9",
                                       "Depósito intermedio Barrio Jardín"]),
                responsable=remito.transportista,
                temperatura=temperatura_llegada if falla < 0.10 else temperatura_ok(),
            ), usuario_vet, t_control)
        t += timedelta(hours=horas_transito)
        if t > AHORA - timedelta(hours=2):
            continue  # todavía en tránsito

        precinto_roto = falla > 0.90
        rechazos = []
        if not precinto_roto and azar.random() < 0.04:
            rechazos = [RechazoIndividual(muestra_id=grupo[0].id, motivo=MotivoRechazo.MUESTRA_NO_APTA)]
        remitos_srv.recibir(remito.id, RecepcionEntrada(
            estado_precinto=EstadoPrecinto.ROTO if precinto_roto else EstadoPrecinto.INTACTO,
            codigo_precinto=remito.precinto.codigo,
            temperatura_llegada=temperatura_llegada,
            observaciones="Precinto violado en la recepción" if precinto_roto else None,
            rechazos=rechazos,
        ), lab_usuario, t)

        for muestra in grupo:
            if muestra.estado != "RECIBIDA":
                continue
            t_resultado = t + timedelta(hours=azar.uniform(3, 40))
            if t_resultado > AHORA:
                continue  # en proceso en el laboratorio
            muestras_srv.registrar_resultado(muestra.id, ResultadoEntrada(
                valores=resultado_de(muestra.tipo_analisis.nombre),
                conclusion=azar.choice(["Valores dentro de parámetros normales.",
                                        "Hallazgos compatibles con proceso infeccioso.",
                                        "Alteraciones leves; se sugiere control en 30 días."]),
            ), lab_usuario, t_resultado)


def resultado_de(analisis: str) -> str:
    if "Hemograma" in analisis:
        return (f"Hto: {azar.randint(35, 55)} % | Hb: {azar.uniform(12, 18):.1f} g/dl | "
                f"GB: {azar.randint(6, 17)} x10³/µl | Plaquetas: {azar.randint(200, 500)} x10³/µl")
    if "Bioquímica" in analisis:
        return (f"Urea: {azar.randint(20, 60)} mg/dl | Creatinina: {azar.uniform(0.5, 1.8):.2f} mg/dl | "
                f"ALT: {azar.randint(10, 100)} U/l | Glucemia: {azar.randint(70, 140)} mg/dl")
    if "Urianálisis" in analisis:
        return f"Densidad: 1.0{azar.randint(15, 45)} | pH: {azar.choice([6, 6.5, 7])} | Proteínas: negativo"
    if "Copro" in analisis:
        return azar.choice(["No se observan elementos parasitarios.", "Se observan huevos de Toxocara spp."])
    if "Cultivo" in analisis:
        return azar.choice(["Desarrollo de Staphylococcus pseudintermedius. Sensible a cefalexina.",
                            "Sin desarrollo bacteriano a las 48 h."])
    return "Tejido con inflamación crónica inespecífica. Márgenes libres."


def escenario_demo(sesion: Session, maestros: dict, mascotas: list) -> None:
    """Deja remitos en cada etapa del circuito para poder mostrarlos en vivo."""
    atenciones_srv, remitos_srv = ServicioAtenciones(sesion), ServicioRemitos(sesion)
    tipos = {t.nombre: t.id for t in maestros["tipos"]}

    def nueva_atencion(indice_clinica: int, horas_atras: float, analisis: list[str], urgente=False):
        clinica = maestros["clinicas"][indice_clinica]
        vet = next(v for v in maestros["veterinarios"] if v.clinica_id == clinica.id)
        usuario = maestros["usuarios_vet"][vet.id]
        atencion, _ = atenciones_srv.registrar(AtencionEntrada(
            mascota_id=azar.choice(mascotas).id,
            tipo=TipoAtencion.URGENCIA if urgente else TipoAtencion.CONSULTA,
            fecha=AHORA - timedelta(hours=horas_atras),
            motivo=azar.choice(MOTIVOS[TipoAtencion.CONSULTA]),
            diagnostico="En estudio",
            analisis=[tipos[n] for n in analisis],
            derivacion_urgente=urgente,
        ), usuario)
        return atencion, usuario

    def empaquetar(atencion, usuario):
        conservadora = next(
            c for c in sesion.query(Conservadora).filter(Conservadora.clinica_id == atencion.clinica_id)
            if c.codigo.startswith("CR-") and c.estado == EstadoConservadora.DISPONIBLE
        )
        ids = [m.id for orden in atencion.ordenes for m in orden.muestras]
        return remitos_srv.crear(
            RemitoEntrada(conservadora_id=conservadora.id, muestra_ids=ids),
            usuario, atencion.fecha + timedelta(hours=1),
        )

    def despachar(remito, usuario, fecha):
        remitos_srv.despachar(remito.id, DespachoEntrada(
            transportista=TRANSPORTISTAS[0], ubicacion=remito.clinica.nombre, temperatura=4.5,
        ), usuario, fecha)

    # Recibido hace unas horas: muestras esperando resultados en el laboratorio
    atencion, usuario = nueva_atencion(0, 20, ["Bioquímica sérica", "Cultivo y antibiograma"])
    remito = empaquetar(atencion, usuario)
    despachar(remito, usuario, atencion.fecha + timedelta(hours=1.5))
    remitos_srv.recibir(remito.id, RecepcionEntrada(
        estado_precinto=EstadoPrecinto.INTACTO, codigo_precinto=remito.precinto.codigo,
        temperatura_llegada=5.2,
    ), maestros["usuarios_lab"][0], atencion.fecha + timedelta(hours=8))

    # En tránsito con un punto de control registrado
    atencion, usuario = nueva_atencion(0, 6, ["Hemograma completo", "Coproparasitológico"])
    remito = empaquetar(atencion, usuario)
    despachar(remito, usuario, atencion.fecha + timedelta(hours=2))
    remitos_srv.registrar_evento(remito.id, EventoEnvioEntrada(
        ubicacion="Centro de distribución Ruta 20", responsable=TRANSPORTISTAS[0], temperatura=5.1,
    ), usuario, atencion.fecha + timedelta(hours=3.5))

    # En tránsito desde hace más de un día: al recibirla, la orina vence por tiempo
    atencion, usuario = nueva_atencion(2, 30, ["Urianálisis completo", "Hemograma completo"], urgente=True)
    remito = empaquetar(atencion, usuario)
    despachar(remito, usuario, atencion.fecha + timedelta(hours=1))
    remitos_srv.registrar_evento(remito.id, EventoEnvioEntrada(
        ubicacion="Base logística Ruta 38", responsable=TRANSPORTISTAS[1], temperatura=6.0,
    ), usuario, atencion.fecha + timedelta(hours=10))

    # Empaquetado y listo para despachar
    atencion, usuario = nueva_atencion(1, 3, ["Hemograma completo", "Bioquímica sérica"])
    empaquetar(atencion, usuario)


def cargar_turnos(sesion: Session, maestros: dict, mascotas: list) -> None:
    agenda = ServicioAgenda(sesion)
    admin = sesion.query(Usuario).filter(Usuario.rol == Rol.ADMIN).one()
    for dias in range(0, 8):
        dia = AHORA.date() + timedelta(days=dias)
        if dia.weekday() == 6:
            continue
        for vet in maestros["veterinarios"]:
            for hora in azar.sample([9, 10, 11, 12, 16, 17, 18], k=azar.randint(1, 3)):
                if dia.weekday() == 5 and hora >= 13:
                    continue
                inicio = datetime.combine(dia, time(hora, azar.choice([0, 30])))
                if inicio < AHORA:
                    continue
                agenda.reservar(TurnoEntrada(
                    profesional_id=vet.id, inicio=inicio, fin=inicio + timedelta(minutes=30),
                    tipo=TipoTurno.ATENCION, motivo=azar.choice(MOTIVOS[TipoAtencion.CONTROL]),
                    mascota_id=azar.choice(mascotas).id,
                ), admin)


def main() -> None:
    base = BaseDeDatos()
    base.recrear()
    with base.nueva_sesion() as sesion:
        maestros = cargar_maestros(sesion)
        mascotas = cargar_clientes_y_mascotas(sesion, maestros["especies"])
        simular_actividad(sesion, maestros, mascotas)
        escenario_demo(sesion, maestros, mascotas)
        cargar_turnos(sesion, maestros, mascotas)
    print("Base de datos cargada con datos de demostracion.")
    print("Usuarios: admin@vetred.com/admin123 - vet1@vetred.com/vet123 - lab1@vetred.com/lab123")


if __name__ == "__main__":
    main()
