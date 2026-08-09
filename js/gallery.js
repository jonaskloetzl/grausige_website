/*
 * Bilder-Galerie
 * Zeigt eine zufaellige Auswahl aus img/Galerie in einem Mosaik-Raster.
 * Der Button "Zufaellige Bilder" wuerfelt Auswahl und Anordnung neu.
 *
 * Die Bilderliste kommt aus js/gallery-images.js und wird von
 * tools/update-gallery-images.sh aus dem Ordner img/Galerie erzeugt.
 * Nach dem Austauschen von Bildern also einmal laufen lassen:
 *   sh tools/update-gallery-images.sh
 */
(function () {
	'use strict';

	/*
	 * Wieviele Bilder gleichzeitig zu sehen sind. Erlaubt sind die Werte,
	 * fuer die es unten Vorlagen gibt: 5 oder 7. Bei einem anderen Wert
	 * faellt die Galerie auf 7 zurueck.
	 */
	var VISIBLE = 5;
	var GAP = 10;

	/*
	 * Mosaik-Vorlagen, gruppiert nach Bilderzahl und darin nach Spaltenzahl.
	 * Ein Slot ist [Spalten-Start, Spalten-Breite, Reihen-Start, Reihen-Hoehe].
	 * Eine Reihe ist eine halbe Spaltenbreite hoch, damit sich die
	 * Seitenverhaeltnisse der Kacheln fein steuern lassen. Jede Vorlage fuellt
	 * ihr Raster lueckenlos - beim Bearbeiten also nachrechnen.
	 */
	var LAYOUTS = {
		7: {
			6: [
				[[1, 3, 1, 4], [4, 3, 1, 4], [1, 2, 5, 3], [3, 2, 5, 3], [5, 2, 5, 3], [1, 4, 8, 5], [5, 2, 8, 5]],
				[[1, 2, 1, 5], [3, 4, 1, 5], [1, 3, 6, 4], [4, 3, 6, 4], [1, 2, 10, 3], [3, 2, 10, 3], [5, 2, 10, 3]],
				[[1, 2, 1, 3], [3, 2, 1, 3], [5, 2, 1, 3], [1, 4, 4, 5], [5, 2, 4, 5], [1, 3, 9, 4], [4, 3, 9, 4]]
			],
			4: [
				[[1, 4, 1, 5], [1, 2, 6, 3], [3, 2, 6, 3], [1, 2, 9, 3], [3, 2, 9, 3], [1, 2, 12, 3], [3, 2, 12, 3]],
				[[1, 2, 1, 3], [3, 2, 1, 3], [1, 4, 4, 5], [1, 2, 9, 3], [3, 2, 9, 3], [1, 2, 12, 4], [3, 2, 12, 4]]
			],
			2: [
				[[1, 2, 1, 3], [1, 1, 4, 2], [2, 1, 4, 2], [1, 2, 6, 3], [1, 1, 9, 2], [2, 1, 9, 2], [1, 2, 11, 3]],
				[[1, 1, 1, 2], [2, 1, 1, 2], [1, 2, 3, 3], [1, 1, 6, 2], [2, 1, 6, 2], [1, 2, 8, 3], [1, 2, 11, 3]]
			]
		},
		5: {
			6: [
				[[1, 3, 1, 4], [4, 3, 1, 4], [1, 2, 5, 3], [3, 2, 5, 3], [5, 2, 5, 3]],
				[[1, 2, 1, 5], [3, 4, 1, 5], [1, 2, 6, 3], [3, 2, 6, 3], [5, 2, 6, 3]],
				[[1, 2, 1, 3], [3, 2, 1, 3], [5, 2, 1, 3], [1, 4, 4, 5], [5, 2, 4, 5]]
			],
			4: [
				[[1, 4, 1, 5], [1, 2, 6, 3], [3, 2, 6, 3], [1, 2, 9, 3], [3, 2, 9, 3]],
				[[1, 2, 1, 3], [3, 2, 1, 3], [1, 4, 4, 5], [1, 2, 9, 4], [3, 2, 9, 4]]
			],
			2: [
				[[1, 2, 1, 3], [1, 1, 4, 2], [2, 1, 4, 2], [1, 2, 6, 3], [1, 2, 9, 3]],
				[[1, 1, 1, 2], [2, 1, 1, 2], [1, 2, 3, 3], [1, 1, 6, 2], [2, 1, 6, 2]]
			]
		}
	};

	var grid = document.getElementById('gallery-grid');
	var btn = document.getElementById('gallery-shuffle');
	var sources = (window.GALLERY_IMAGES || []).slice();
	var templates = LAYOUTS[VISIBLE] || LAYOUTS[7];
	if (!grid || !btn || !sources.length) return;

	var current = [];
	var lastLayout = {};
	var cols = 0;
	var ratios = {};
	var token = 0;
	var lightbox = null;

	// Dateinamen koennen Leerzeichen enthalten.
	function url(src) {
		return encodeURI(src);
	}

	function columnCount() {
		var w = window.innerWidth;
		if (w >= 992) return 6;
		if (w >= 576) return 4;
		return 2;
	}

	function pickImages(n) {
		var pool = sources.slice();
		var out = [];
		while (out.length < n && pool.length) {
			out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
		}
		return out;
	}

	// Zufaellige Vorlage, aber nie zweimal hintereinander dieselbe.
	function pickLayout(c) {
		var variants = templates[c];
		var i = Math.floor(Math.random() * variants.length);
		if (variants.length > 1 && i === lastLayout[c]) {
			i = (i + 1) % variants.length;
		}
		lastLayout[c] = i;
		return variants[i];
	}

	/*
	 * Seitenverhaeltnisse werden aus den Bildern selbst gelesen, damit die
	 * Galerie mit beliebigen Dateien im Ordner funktioniert. Einmal gemessene
	 * Werte bleiben gemerkt.
	 */
	function withRatios(picked, done) {
		var pending = picked.length;
		var finished = false;

		function finish() {
			if (finished) return;
			finished = true;
			done(picked.map(function (src) {
				return { src: src, ratio: ratios[src] || 1.5 };
			}));
		}

		function step() {
			pending -= 1;
			if (pending <= 0) finish();
		}

		picked.forEach(function (src) {
			if (ratios[src]) {
				step();
				return;
			}
			var probe = new Image();
			probe.onload = probe.onerror = function () {
				if (probe.naturalWidth && probe.naturalHeight) {
					ratios[src] = probe.naturalWidth / probe.naturalHeight;
				}
				step();
			};
			probe.src = url(src);
		});

		// Sicherheitsnetz, falls ein Bild weder load noch error meldet.
		setTimeout(finish, 4000);
	}

	function slotRatio(slot) {
		return slot[1] / (slot[3] / 2);
	}

	// Breite Bilder in breite Kacheln, hochkant in hohe.
	function assign(images, layout) {
		var byRatio = images.slice().sort(function (a, b) { return a.ratio - b.ratio; });
		var slots = layout.map(function (slot, i) { return { i: i, ratio: slotRatio(slot) }; });
		slots.sort(function (a, b) { return a.ratio - b.ratio; });

		var out = [];
		slots.forEach(function (slot, k) { out[slot.i] = byRatio[k]; });
		return out;
	}

	function sizeRows() {
		var colWidth = (grid.clientWidth - (cols - 1) * GAP) / cols;
		grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
		grid.style.gridAutoRows = (colWidth / 2) + 'px';
	}

	function initLightbox() {
		if (!window.jQuery || !window.jQuery.fn.simpleLightbox) return;
		if (lightbox) {
			try { lightbox.destroy(); } catch (e) { /* egal */ }
		}
		lightbox = window.jQuery('#gallery-grid a').simpleLightbox({
			captions: false,
			showCounter: false,
			fileExt: false
		});
	}

	function render(images, layout) {
		var ordered = assign(images, layout);
		var frag = document.createDocumentFragment();

		grid.classList.remove('is-visible');
		grid.innerHTML = '';

		ordered.forEach(function (image, i) {
			var slot = layout[i];
			var link = document.createElement('a');
			link.href = url(image.src);
			link.className = 'mosaic-item';
			link.style.gridArea = slot[2] + ' / ' + slot[0] + ' / span ' + slot[3] + ' / span ' + slot[1];
			link.style.transitionDelay = (i * 70) + 'ms';

			var img = document.createElement('img');
			img.src = url(image.src);
			img.alt = '';
			img.loading = 'lazy';

			link.appendChild(img);
			frag.appendChild(link);
		});

		grid.appendChild(frag);
		sizeRows();
		initLightbox();

		// Reflow erzwingen, damit der Einblend-Uebergang zuverlaessig startet.
		void grid.offsetHeight;
		grid.classList.add('is-visible');
	}

	function shuffle() {
		var mine = ++token;
		cols = columnCount();
		var layout = pickLayout(cols);

		// Die Vorlage gibt die Zahl der Kacheln vor, danach richtet sich die Auswahl.
		withRatios(pickImages(layout.length), function (images) {
			// Bei schnellem Klicken zaehlt nur der letzte Durchgang.
			if (mine !== token) return;
			current = images;
			render(images, layout);
		});
	}

	btn.addEventListener('click', function () {
		btn.classList.remove('is-spinning');
		// Reflow erzwingen, damit die Animation auch beim schnellen Klicken neu startet.
		void btn.offsetWidth;
		btn.classList.add('is-spinning');
		shuffle();
	});

	var resizeTimer;
	window.addEventListener('resize', function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function () {
			if (!current.length) return;
			var next = columnCount();
			if (next !== cols) {
				cols = next;
				render(current, pickLayout(cols));
			} else {
				sizeRows();
			}
		}, 150);
	});

	// Erst laden, wenn die Galerie in die Naehe des Sichtfensters kommt.
	if (window.IntersectionObserver) {
		var observer = new IntersectionObserver(function (entries) {
			for (var i = 0; i < entries.length; i++) {
				if (entries[i].isIntersecting) {
					observer.disconnect();
					shuffle();
					return;
				}
			}
		}, { rootMargin: '400px 0px' });
		observer.observe(grid);
	} else {
		shuffle();
	}
})();
