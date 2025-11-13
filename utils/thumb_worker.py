from typing import Tuple, Callable, Set
from PySide6 import QtCore
from utils.thumb_cache import build_thumb, thumb_path

_active: Set[str] = set()
_failed: Set[str] = set()

# 限制全局线程池并发，避免高并发导致IO/CPU拥堵
_pool = QtCore.QThreadPool.globalInstance()
try:
    _pool.setMaxThreadCount(3)
except Exception:
    pass

class _BuildTask(QtCore.QRunnable):
    def __init__(self, path: str, size: Tuple[int, int], on_done: Callable[[], None]):
        super().__init__()
        self.path = path
        self.size = size
        self.on_done = on_done

    def run(self):
        key = f"{self.path}|{self.size[0]}x{self.size[1]}"
        try:
            build_thumb(self.path, self.size)
        finally:
            _active.discard(key)
            QtCore.QTimer.singleShot(0, self.on_done)

def enqueue_build(path: str, size: Tuple[int, int], on_done: Callable[[], None]) -> None:
    key = f"{path}|{size[0]}x{size[1]}"
    if key in _active or key in _failed:
        return
    _active.add(key)
    task = _BuildTask(path, size, on_done)
    QtCore.QThreadPool.globalInstance().start(task)
