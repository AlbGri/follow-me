# Follow me

Web app per disegnare su mappa i giri di un viaggio: tappe divise per giorno, in ordine,
da condividere come testo, link o immagine.

Stato: in sviluppo (MVP).

## Funzioni
- Più viaggi salvati nel browser
- Tappe aggiunte cliccando sulla mappa o cercando un luogo per nome
- Tappe divise per giorno, riordinabili, con orario opzionale
- Interfaccia in italiano e inglese

## Avvio locale
Serve un server statico qualsiasi (i moduli ES non funzionano da `file://`), ad esempio:

```
python -m http.server 8000
```

poi aprire http://localhost:8000

## Crediti
- Mappa: [MapLibre GL JS](https://maplibre.org/), tile [OpenFreeMap](https://openfreemap.org/)
- Dati: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Ricerca luoghi: [Nominatim](https://nominatim.org/)

## Licenza
[AGPL-3.0](LICENSE)
