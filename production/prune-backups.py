"""Bound only generated, regular CMS backups; never follow symlinks."""
from pathlib import Path
import re

def prune_backups(directory, max_files=7, max_bytes=32 * 1024 ** 3):
    files = [p for p in Path(directory).iterdir() if not p.is_symlink() and p.is_file()
             and re.fullmatch(r'chapa-[0-9TZ]+\.bak\.cms', p.name)]
    files.sort(key=lambda p: (p.stat().st_mtime_ns, p.name), reverse=True)
    if files and files[0].stat().st_size > max_bytes:
        raise RuntimeError('Newest backup exceeds capacity budget; existing copies preserved')
    kept, size, removed = 0, 0, 0
    for p in files:
        length = p.stat().st_size
        if kept < max_files and size + length <= max_bytes:
            kept += 1
            size += length
        else:
            p.unlink()
            removed += 1
    return {'kept': kept, 'bytes': size, 'removed': removed}

if __name__ == '__main__':
    print(prune_backups('/opt/jetta-chapa/backups'))
