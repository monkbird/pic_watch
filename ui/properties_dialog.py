from typing import Dict, Any
from PySide6 import QtWidgets
from ui.metadata_panel import MetadataPanel

class PropertiesDialog(QtWidgets.QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("属性")
        self.resize(700, 600)
        self.panel = MetadataPanel()
        lay = QtWidgets.QVBoxLayout(self)
        lay.addWidget(self.panel)

    def set_item(self, item: Dict[str, Any]):
        self.panel.set_item(item)

