import logging
from PySide6 import QtCore

class QtLogHandler(logging.Handler):
    def __init__(self, writer):
        super().__init__()
        self.writer = writer

    def emit(self, record):
        msg = self.format(record)
        QtCore.QTimer.singleShot(0, lambda: self.writer.append(msg))

_logger = None

def get_logger():
    global _logger
    if _logger is None:
        _logger = logging.getLogger("photo_viewer")
        _logger.setLevel(logging.INFO)
    return _logger

