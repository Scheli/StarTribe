# StarTribe

Questo repository contiene il progetto StarTribe (backend Node.js + frontend statico). Di seguito trovi una panoramica delle funzionalità e una documentazione sintetica delle funzioni principali presenti nel codice (raggruppate per file). Lo scopo è aiutare a capire velocemente cosa fa ogni funzione e quali sono i suoi input/risultati principali.

## Come usare questo README
- Se cerchi una funzione specifica, cerca il file nella sezione Backend o Frontend e poi la funzione.
- Le spiegazioni sono in italiano e descrivono: cosa fa la funzione, i parametri principali, il valore restituito e note sul comportamento o casi d'uso.


## Caratteristiche
-  Registrazione/Login sicuri (bcrypt + JWT **oppure** cookie httpOnly lato backend)
-  Profilo utente: username, email (non editabile), data di nascita, punti, **immagine/video** profilo e **banner**
-  Campi **follower** / **seguiti** nello schema utente (logica follow/unfollow in roadmap)
-  Integrazione **NASA APIs** (APOD, Mars Rover, …)
-  Rotte protette e **area riservata** (`/frontend/html/protected/sicuro.html`)
-  Pagina **Tenta la Fortuna / Dragon Wish** (lettura `tickets` da `/api/profilo` con fallback `/api/trophy`)

## Configurazione (.env)
Copia `.env.example` in `.env` e imposta i valori:
```env
PORT=8080
MONGODB_URI="mongodb+srv://databaseprogetto:StarTribe@startribedb.dwlllm5.mongodb.net/"
NASA_API_KEY="4cJbALDipgC5CRY24HMWaBi43dIUSwchTNm9Pgga"   
CLOUDINARY_CLOUD_NAME=dprigpdai
CLOUDINARY_API_KEY=652246393145783
CLOUDINARY_API_SECRET=0rlOVrq6hE-i8xZjbYC1-KPk8-I      
NODE_ENV=development
```

## Installazione
```bash
git clone https://github.com/Scheli/StarTribe
cd StarTribe
npm install
```

## Avvio
Sviluppo:
```bash
npm run dev
```
Produzione:
```bash
npm start
```

## Indice delle sezioni
- Backend
- Frontend (JS)

---

## Backend

Cartella: `backend/`

NOTE: il server Express espone le API usate dal frontend. Qui elenco le funzioni / endpoint più rilevanti.

- `backend/app.js`
  - pickRandomCard()
    - Cosa: seleziona casualmente una carta (immagine) dalla cartella delle card.
    - Input: nessuno (usa il file system per leggere `img/card` o simile).
    - Output: nome/percorso dell'immagine selezionata.
    - Note: usata dall'endpoint `/api/cards/draw` per il meccanismo di pesca.

  - Endpoints Express (async handlers):
    - `POST /api/register` — registra un nuovo utente. Riceve dati utente in `req.body`, valida e inserisce nel DB.
    - `POST /api/login` — effettua l'autenticazione, restituisce token/sessione.
    - `GET /api/sicuro` — esempio di endpoint protetto o di test.
    - `GET /api/trophy` — calcola e ritorna informazioni sui trofei/milestones disponibili per l'utente.
    - `PUT /api/trophy/select` — seleziona un bordo/trophy per il profilo utente.
    - `POST /api/trophy/claim` — reclamare un milestone/trophy.
    - `POST /api/segui` — segui un altro utente.
    - `POST /api/unfollow` — smetti di seguire un utente.
    - `GET /api/profilo` — ritorna informazioni del profilo utente con relativi post.
    - `PUT /api/profilo/update` — aggiorna i dati del profilo (bio, immagini, ecc.).
    - `POST /api/upload` e `POST /api/upload/banner` — upload di file (immagini) utilizzando `multer` e/o Cloudinary.
    - News/NASA endpoints: `/news`, `/news/apod`, `/news/getInSightWeather`, `/news/getMarsRoverPhoto`, `/news/searchImageLibrary`, `/news/all` — chiamano funzioni helper in `apirequest.js` per interrogare API esterne (NASA ecc.).
    - `POST /api/pubblicapost` — pubblica un nuovo post (può contenere file) e aggiorna DB.
    - `GET /api/post`, `GET /api/postutente` — recuperano post (feed o utente specifico).
    - `POST /api/cards/draw` — endpoint che utilizza `pickRandomCard()` per restituire una carta pescata.

- `backend/apirequest.js`
  - `getAPOD()`
    - Cosa: interroga la API APOD (Astronomy Picture of the Day) di NASA e ritorna l'oggetto.
    - Input: nessuno (usa la chiave API da config/variabili d'ambiente).
    - Output: JSON con i metadati / URL dell'immagine.

  - `getInSightWeather()`
    - Cosa: prende i dati meteo del lander InSight (o endpoint simile) e li ritorna.

- `backend/db.js`
  - `connectToDB()`
    - Cosa: inizializza la connessione al DB (MongoDB o altro, come appare dal codice) e ritorna l'istanza.

  - `aggiungiUtente(utente)`
    - Cosa: inserisce un nuovo documento utente.
    - Input: oggetto `utente` con campi come `email`, `password`, `username`.

  - `GetUtentiConsigliati(dbInstance)`
    - Cosa: query per ottenere utenti consigliati (logica interna definita in base a follow/follower/random).

- `backend/trophy.js`
  - `unlockedBorders(points)`
    - Cosa: data la quantità di punti, ritorna le chiavi dei tier (bordi) sbloccati.
    - Input: `points` (numero)
    - Output: array di chiavi/stringhe identificative dei bordi.

  - `computeProgress(points)`
    - Cosa: calcola lo stato di avanzamento verso il prossimo milestone basandosi su `MILESTONES`.
    - Output: un oggetto con `last`, `next` e percentuale/valori utili alla UI per mostrare progress bar.

---

## Frontend (JS)

Cartella: `frontend/js/`

Nota: molte funzioni sono legate alla UI (vanilla JS) e al motore grafico 3D (Three.js o wrapper custom). Di seguito le principali.

- `frontend/js/app.js` (frontend)
  - `importBackground(name)`
    - Cosa: importa dinamicamente uno sfondo/asset di background (modulo JS dal folder `core/backgrounds`).

  - `setBackground(name, engine)`
    - Cosa: istanzia e applica lo sfondo scelto all'engine grafico.

  - `boot()`
    - Cosa: routine di avvio che inizializza gli engine canvas, il focus UI e le interazioni di pagina.

- `frontend/js/album.js`
  - `setStatus(t)` — aggiorna lo stato di caricamento/visualizzazione dell'album.
  - `niceNameFromUrl(url)` — estrae un nome leggibile dall'URL dell'immagine.
  - `openLightbox(src, altText)` / `closeLightbox()` — apre/chiude la lightbox per ingrandire immagini.
  - `bindLightboxHandlers()` — collega eventi click/keydown per la lightbox.
  - `renderCards(cards)` — disegna la griglia di card in pagina.
  - `loadCards()` — recupera le card dal backend (`/api/cards`) e chiama `renderCards`.

- `frontend/js/chat.js`
  - `formatTimestamp(iso)`
    - Cosa: formatta un timestamp ISO in una stringa leggibile per la chat.
  - Event listeners Socket.IO: `socket.on('connect')`, `socket.on('chat')`, `socket.on('update')` — gestione realtime dei messaggi e aggiornamenti.

- `frontend/js/creapost.js`
  - `eVideo(url)` — verifica/estrae dati relativi a video embed (es. YouTube).
  - `isHttpUrl(v)` — controlla se una stringa è un URL HTTP valido.
  - `Creapost()` — funzione async che gestisce la UI di creazione del post (validazione, anteprima, invio al backend).

- `frontend/js/audiotheme.js`
  - `fadeTo(audio, target, duration)` — sfuma il volume dell'elemento audio verso `target` in `duration` ms.
  - `createCTA()` — crea un elemento CTA (play/pause) per l'audio.
  - `start()` — avvia la riproduzione dell'audio tema (gestisce autoplay policy del browser).

- `frontend/js/login.js`
  - `showPopup({title, text, duration})` — mostra un overlay di feedback all'utente (es. login fallito / successo).
  - `form` submit handler — invia credenziali a `POST /api/login` e gestisce la risposta.

- `frontend/js/areaprotetta.js`
  - `init()` — inizializza la pagina protetta, controlla sessione/token e reindirizza se necessario.

- `frontend/js/trophy.js`, `frontend/js/profilo.js`, `frontend/js/news.js`, `frontend/js/shop.js`, `frontend/js/registrazione.js` e altri
  - Contengono logiche specifiche di interazione con API relative ai trofei, profilo, notizie, shop, registrazione. Tipicamente: chiamate fetch a endpoint backend, manipolazione DOM, validazioni form.

- `frontend/js/auth/sky_bg.js`
  - `mountAuthSky(container, options)` — monta un background animato (canvas) per le pagine di autenticazione; ritorna una funzione di teardown.

---

## Librerie / Motore grafico
- Nel codice frontend si usa un motore personalizzato (`frontend/js/core/engine.js`) che incapsula Three.js:
  - `createEngine({canvas, ...})` — istanzia renderer, scene, camera.
  - `onTick(cb)` — registra callback di frame update.
  - `start()` / `stop()` — avvia/ferma il loop di rendering.
  - `dispose()` / `deepDispose(root)` — pulisce risorse WebGL / Three.js.

- `frontend/js/core/utils.js` contiene utility per materiali, texture e trasformazioni (es. `wrap01`, `unitRadius`, `worldPosOf`, `loadBitmap`, `tuneTex`, `prepPlanetMaterials`, `createOrbitRig`).

- `frontend/js/core/common/sky.js` e `sun.js` contengono generatori per cielo, stelle e sole con funzioni `createSky(...)` e `createSun(...)` e relativi `update()` / `dispose()`.

- `frontend/js/core/backgrounds/*` contengono `initBackground(engine)` per ogni pianeta/sfondo (es. `earth_Moon.js`, `Jupiter.js`): caricano modelli GLTF, shader custom e impostano animazioni/orbite.

---

## Note generali e casi d'uso
- Input/output: gli endpoint backend usano JSON in request/response; gli upload passano file multipart.
- Error handling: molte route sono `async` e dovrebbero gestire gli errori con try/catch — controlla i log in `backend/app.js` per esempi di gestione.
- Sicurezza: autenticazione/sessione è gestita lato server (cookies o token). Verificare middleware di protezione per endpoint sensibili.

---

## Deployment
- Imposta variabili `.env` in produzione
- `npm start` per avvio produzione (o PM2)

## Sicurezza
- Hashing password (**bcrypt**)
- Validazione/sanitizzazione input

## Roadmap
- ✅ Campi `follower` / `seguiti` nello schema
- ⏭️ Logica **follow/unfollow** con bottone Segui/Seguito in `ProEsterno.html`
- ⏭️ Upload media profilo (immagine/video) con storage dedicato
- ⏭️ Test end-to-end e integrazione
- ⏭️ Pagine docs API dettagliate (OpenAPI/Swagger)

## Contribuire
Le PR sono benvenute. Apri un’issue, descrivi bug/feature, segui convenzioni di commit e apri PR con test.
## Ringraziamenti
- **NASA APIs** (APOD, Mars Rover)
- Comunità Open Source

## FAQ / Troubleshooting
- **401 su rotte protette** → verifica token/cookie e CORS
- **Mongo non si connette** → controlla `MONGODB_URI` e che Mongo sia avviato
- **CORS in locale** → imposta `CORS_ORIGIN=http://localhost:8080`

## startribe