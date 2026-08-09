#!/bin/sh
#
# Erzeugt js/gallery-images.js aus dem Inhalt von img/Galerie.
# Immer dann einmal ausfuehren, wenn Bilder in img/Galerie dazukommen,
# ausgetauscht oder geloescht werden:
#
#   sh tools/update-gallery-images.sh
#
# Unterordner von img/Galerie werden bewusst ignoriert.
#
set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR="$ROOT/img/Galerie"
OUT="$ROOT/js/gallery-images.js"

if [ ! -d "$DIR" ]; then
	echo "Ordner $DIR nicht gefunden." >&2
	exit 1
fi

{
	printf '/*\n'
	printf ' * Automatisch erzeugt von tools/update-gallery-images.sh.\n'
	printf ' * Nicht von Hand bearbeiten - Skript neu laufen lassen.\n'
	printf ' */\n'
	printf 'window.GALLERY_IMAGES = [\n'

	find "$DIR" -maxdepth 1 -type f \
		\( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
		| sort \
		| while IFS= read -r file; do
			name=$(basename "$file" | sed 's/\\/\\\\/g; s/"/\\"/g')
			printf '\t"img/Galerie/%s",\n' "$name"
		done

	printf '];\n'
} > "$OUT"

echo "$(grep -c '"img/Galerie/' "$OUT") Bilder in js/gallery-images.js geschrieben."
