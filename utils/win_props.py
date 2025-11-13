import ctypes
import ctypes.wintypes as wt

SHOP_FILEPATH = 0x00000002

def open_properties(path: str, hwnd: int | None = None) -> bool:
    shell32 = ctypes.WinDLL("shell32")
    SHObjectProperties = shell32.SHObjectProperties
    SHObjectProperties.argtypes = [wt.HWND, wt.DWORD, wt.LPCWSTR, wt.LPCWSTR]
    SHObjectProperties.restype = wt.BOOL
    h = wt.HWND(hwnd or 0)
    return bool(SHObjectProperties(h, SHOP_FILEPATH, path, None))

