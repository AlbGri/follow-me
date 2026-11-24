# Changelog

## 0.5.2 - 2026-11-21
- Librerie e caratteri ora arrivano dal sito: per avviare l'app non si contattano più unpkg, jsDelivr o altri servizi; restano esterne solo le mappe e la ricerca dei luoghi

## 0.5.1 - 2026-11-17
- Giorno compresso: l'etichetta si legge intera, su più righe se serve; matita e X compaiono aprendo il giorno
- Reimport del testo da condividere senza data di inizio: i giorni vuoti tornano al loro posto invece di far scalare i successivi
- "1 tappa" invece di "1 tappe"

## 0.5.0 - 2026-11-17
- Nuovo aspetto, lo stesso degli altri progetti di albgri.com: caratteri Alegreya e Atkinson Hyperlegible Next, pulsanti e finestre rinnovati, icone disegnate al posto dei simboli
- Tema scuro, con la mappa scura: segue quello del sistema finché non lo scegli con il pulsante, poi la scelta resta
- Errori in un riquadro evidenziato che dice cosa è successo e cosa fare
- Immagine esportata su fondo chiaro, con il titolo nel nuovo carattere e l'indirizzo dell'app in basso

## 0.4.1 - 2026-11-14
- Nuovo indirizzo: follow-me.albgri.com, al posto di fm.albgri.com. I link corti gia' condivisi si aprono sostituendo fm con follow-me; i viaggi salvati nel browser sul vecchio indirizzo non passano al nuovo

## 0.4.0 - 2026-11-04
- Nuovo indirizzo: fm.albgri.com. Chi apre il vecchio albgri.github.io/follow-me viene portato li'
- Link di condivisione corti (fm.albgri.com/ seguito da 8 caratteri); se il servizio non risponde, l'app usa il link lungo
- Anteprima del link nelle chat (WhatsApp, Telegram e simili) con nome, descrizione e icona

## 0.3.0 - 2026-11-04
- Export testo in due formati: "per reimportare" (con coordinate) e "da condividere" (senza simboli né coordinate, per post e messaggi); anche il secondo si reimporta, con le tappe cercate per nome
- Data di inizio del viaggio: i giorni mostrano la propria data (es. "sab 31 ott"), anche nell'immagine e nel testo
- Giorni riordinabili trascinando il pallino colorato
- Link a Google Maps: luogo e indicazioni per ogni tappa, percorso del giorno (diviso in parti oltre 11 tappe)
- Nome della tappa sulla mappa toccando il marker; la tappa viene evidenziata nella lista senza aprire la tastiera
- Pulsante "Dove sono" sulla mappa
- Pulsante "Salva app" per installare l'app, con istruzioni per iPhone, Android e computer
- Italiano come lingua predefinita, pulsante lingua con bandiera

## 0.2.0 - 2026-11-04
- Lista tappe compatta: riordino trascinando il numero, anche tra giorni diversi
- Menu per tappa: copia come testo, duplica o sposta in un altro giorno, elimina
- Giorni comprimibili, singolarmente o tutti insieme; dopo un import partono compressi
- Modifica di un giorno come testo: numerazione rifatta, tappe nuove cercate per nome
- "Annulla" dopo eliminazioni e modifiche come testo
- Ricerca dei luoghi orientata alla zona della mappa o del viaggio
- Immagine in formato fisso (quadrata 1:1 o verticale 4:5) con elenco delle tappe
- Avviso sul rischio di perdita dei dati nel browser (es. Safari su iPhone)

## 0.1.0 - 2026-11-03
Prima versione.
- Viaggi multipli salvati nel browser, tappe divise per giorno con orario opzionale
- Aggiunta tappe con click sulla mappa o ricerca per nome
- Percorso con linee colorate per giorno e filtro per giorno
- Import/export in formato testo leggibile
- Link di condivisione con il viaggio incluso
- Export PNG con titolo, legenda e attribuzione
- PWA installabile, utilizzabile offline (mappa esclusa)
- Interfaccia in italiano e inglese
