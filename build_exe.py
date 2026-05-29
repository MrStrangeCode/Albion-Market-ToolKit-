import subprocess, sys, os

project_dir = os.path.dirname(os.path.abspath(__file__))

cmd = [
    sys.executable, '-m', 'PyInstaller',
    '--name=AlbionToolkit',
    '--onefile',
    '--windowed',
    '--icon=' + os.path.join(project_dir, 'static', 'icons', 'appicon.ico'),
    '--add-data=' + os.path.join(project_dir, 'templates') + ';templates',
    '--add-data=' + os.path.join(project_dir, 'static') + ';static',
    '--add-data=' + os.path.join(project_dir, 'data') + ';data',
    os.path.join(project_dir, 'desktop_app.py')
]

print("Building Albion Online Toolkit EXE...")
print("Command:", ' '.join(cmd))
print()

result = subprocess.run(cmd, cwd=project_dir)

if result.returncode == 0:
    exe_path = os.path.join(project_dir, 'dist', 'AlbionToolkit.exe')
    size = os.path.getsize(exe_path) / (1024 * 1024)
    print(f"\n✅ Build successful!")
    print(f"📦 EXE: {exe_path}")
    print(f"📏 Size: {size:.1f} MB")
else:
    print(f"\n❌ Build failed with code {result.returncode}")
