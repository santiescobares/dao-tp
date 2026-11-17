"""Patrón Singleton implementado con una metaclase.

Toda clase que use `metaclass=SingletonMeta` tendrá una única instancia
en toda la aplicación: la primera llamada al constructor la crea y las
siguientes devuelven siempre el mismo objeto.
"""
from threading import RLock


class SingletonMeta(type):
    _instancias: dict[type, object] = {}
    _lock = RLock()  # reentrante: un Singleton puede crear otro en su __init__

    def __call__(cls, *args, **kwargs):
        # El lock evita que dos hilos creen dos instancias a la vez
        with cls._lock:
            if cls not in cls._instancias:
                cls._instancias[cls] = super().__call__(*args, **kwargs)
        return cls._instancias[cls]

    @classmethod
    def reiniciar(mcs, clase: type) -> None:
        """Descarta la instancia de una clase (solo se usa en los tests)."""
        mcs._instancias.pop(clase, None)
