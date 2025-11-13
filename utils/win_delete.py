import ctypes
import ctypes.wintypes as wt

# Use SHFileOperation to move files to Recycle Bin
FO_DELETE = 3
FOF_ALLOWUNDO = 0x0040
FOF_NOCONFIRMATION = 0x0010
FOF_SILENT = 0x0004

class SHFILEOPSTRUCT(ctypes.Structure):
    _fields_ = [
        ("hwnd", wt.HWND),
        ("wFunc", wt.UINT),
        ("pFrom", wt.LPCWSTR),
        ("pTo", wt.LPCWSTR),
        ("fFlags", wt.UINT),
        ("fAnyOperationsAborted", wt.BOOL),
        ("hNameMappings", wt.LPVOID),
        ("lpszProgressTitle", wt.LPCWSTR),
    ]

def delete_to_recycle_bin(paths):
    if not isinstance(paths, (list, tuple)):
        paths = [paths]
    # Double-null-terminated string of file paths
    pFrom = "\x00".join(paths) + "\x00\x00"
    sh = SHFILEOPSTRUCT()
    sh.hwnd = wt.HWND(0)
    sh.wFunc = FO_DELETE
    sh.pFrom = pFrom
    sh.pTo = None
    sh.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT
    shell32 = ctypes.WinDLL("shell32")
    SHFileOperationW = shell32.SHFileOperationW
    SHFileOperationW.argtypes = [ctypes.POINTER(SHFILEOPSTRUCT)]
    SHFileOperationW.restype = wt.INT
    res = SHFileOperationW(ctypes.byref(sh))
    return res == 0 and not sh.fAnyOperationsAborted

