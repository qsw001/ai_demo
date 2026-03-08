cd scripts
pyinstaller --noconfirm --onefile --windowed --name "WordFloatingAgent" --icon "../assets/icon.png" --add-data "../assets;assets" --add-data "../.env;.env" --paths ".." "../app/main.py"
cd ..