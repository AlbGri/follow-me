# Follow Me

Web app per disegnare su mappa i giri di un viaggio: tappe divise per giorno, in ordine,
da condividere come testo, link o immagine.

**Prova l'app: https://albgri.github.io/follow-me/**

## Funzioni
- Più viaggi salvati nel browser, nessun account
- Tappe aggiunte cliccando sulla mappa o cercando un luogo per nome
- Tappe divise per giorno con orario opzionale, riordinabili trascinandole anche tra giorni
- Giorni comprimibili e modificabili come testo
- Copia, duplicazione e spostamento di tappe, con "Annulla" per le eliminazioni
- Percorso disegnato con linee colorate per giorno, filtro per giorno, giorni riordinabili
- Link a Google Maps per ogni tappa e per il percorso di ogni giorno
- Posizione attuale sulla mappa
- Export e import in formato testo, leggibile e incollabile in un commento
- Link di condivisione che contiene l'intero viaggio
- Immagine quadrata o verticale con mappa ed elenco delle tappe
- Installabile come app (PWA) con il pulsante "Salva app", utilizzabile offline (mappa esclusa)
- Interfaccia in italiano e inglese

## Formato testo
```
# Malta 2026

## Giorno 1 - La Valletta
1. 09:00 Upper Barrakka Gardens (35.8946, 14.5124)
2. Fort St Elmo (35.902, 14.519)

## Giorno 2 - Gozo
1. Cittadella, Victoria, Gozo
```
Orario e coordinate sono opzionali: le tappe senza coordinate vengono cercate per nome
durante l'import. Le parole ("Giorno", "Day") non contano, solo i simboli `#`, `##` e i numeri.

Se il viaggio ha una data di inizio, i giorni si scrivono con la loro data: `## 2026-10-31 - La Valletta`.

Per post e messaggi c'è anche il formato "da condividere", senza simboli né coordinate
(`Sab 31 ottobre 2026 · La Valletta` seguito dalle tappe numerate). Si reimporta anche questo:
le tappe vengono cercate per nome.

## Avvio locale
Serve un server statico qualsiasi (i moduli ES non funzionano da `file://`), ad esempio:

```
python -m http.server 8000
```

poi aprire http://localhost:8000

## Crediti
- Mappa: [MapLibre GL JS](https://maplibre.org/), tile [OpenFreeMap](https://openfreemap.org/)
- Riordino: [SortableJS](https://sortablejs.github.io/Sortable/)
- Dati: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Ricerca luoghi: [Nominatim](https://nominatim.org/)

## Licenza
[AGPL-3.0](LICENSE)
