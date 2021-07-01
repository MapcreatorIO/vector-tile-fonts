import fontforge
import os
from shutil import copyfile

print('[+] Creating directory')
os.makedirs('ttf', exist_ok=True)

for root, dirs, files in os.walk('fonts'):
    for f in files:
        name, extension = os.path.splitext(f)

        path = os.path.join(root, f)
        if extension == '.ttf':
            print(f"[+] Copying {path!r}")
            copyfile(path, os.path.join('ttf', f))
        elif extension == '.otf':
            print(f"[+] Converting {path!r}")
            fontforge.open(path).generate(os.path.join('ttf', name + '.ttf'))
        else:
            print(f"[-] Extension not recognized {extension!r}")
