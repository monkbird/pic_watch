import argparse
import os
from typing import Optional

from services.scanner import scan_directory, export_json

def run_scan(root: str, output: Optional[str]) -> None:
    if not os.path.isdir(root):
        raise SystemExit("目录不存在")
    items = scan_directory(root)
    out = output or os.path.join(root, "metadata.json")
    export_json(items, out)
    print(f"导出: {out} 共 {len(items)} 项")

def run_gui():
    from PySide6 import QtWidgets
    from ui.main_window import MainWindow
    app = QtWidgets.QApplication([])
    w = MainWindow()
    w.show()
    app.exec()

def main() -> None:
    parser = argparse.ArgumentParser(prog="照片查看工具")
    sub = parser.add_subparsers(dest="cmd")
    p_scan = sub.add_parser("scan")
    p_scan.add_argument("root")
    p_scan.add_argument("--output")
    sub.add_parser("gui")
    args = parser.parse_args()
    if args.cmd == "scan":
        run_scan(args.root, args.output)
    elif args.cmd == "gui":
        run_gui()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
