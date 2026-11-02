# Akarás Predictions – Render + Supabase

Az oldal Renderen fut. A Supabase tárolja az adatbázist és a feltöltött képeket, így egy Render-újraindítás nem törli őket. Cloudflare- és R2-fiók nem kell ehhez a változathoz.

## 1. Supabase létrehozása

Nyisd meg a https://supabase.com/dashboard oldalt. Hozz létre egy **Free** projektet, lehetőleg európai régióban. Jegyezd meg az új adatbázis-jelszót.

A projektben keresd meg ezeket:

- **Connect → Session pooler → URI:** másold ki a PostgreSQL-kapcsolati címet. A pooler gépneve `.pooler.supabase.com` végű, portja **5432**. Cseréld ki a jelszó helyét a saját adatbázis-jelszavadra. Speciális karaktereket URL-kódolva adj meg; ez a jelszó nem az adminfiók jelszava.
- **Project Settings → API / API Keys:** másold ki a **Project URL** értékét és a régi, JWT formátumú **service_role** kulcsot a Legacy API Keys részből. Az `anon` / publishable kulcs ide nem megfelelő. A service_role kulcs kizárólag a Render titkos környezeti változójába kerülhet.
- **Database Settings → SSL certificate:** ha szükséges, töltsd le a gyökértanúsítványt. A `.crt` fájl szövegét a `DATABASE_CA_CERT` változóba lehet másolni, a BEGIN és END sorokkal együtt. A szerver bekapcsolva tartja a tanúsítvány-ellenőrzést.

Az adatbázistáblákat és a privát `akaras-images` képtárolót az alkalmazás létrehozza. Nem kell SQL-t futtatnod és nem kell nyilvánossá tenned a tárolót.

## 2. Forrás feltöltése GitHubra

Csomagold ki a ZIP-et. Hozz létre egy GitHub repositoryt, majd az **Akaras-Render mappa teljes tartalmát** töltsd fel. A repository gyökerében közvetlenül a `package.json`, `package-lock.json`, `render.yaml`, `server`, `lib`, `db` és `public` legyen, ne egy újabb külső mappa.

Titkos adatot, kitöltött `.env` fájlt és `node_modules` mappát ne tölts fel. Az eredeti oldalad ettől még változatlanul működik. Ha GitHub feltöltéskor a `.gitignore` rejtett, attól a többi forrásfájl még feltölthető.

## 3. Render beállítása

A https://dashboard.render.com oldalon: **New → Web Service**, majd válaszd ki a repositoryt.

| Beállítás | Érték |
|---|---|
| Language / Runtime | Node |
| Region | Frankfurt, ha elérhető |
| Root Directory | Üres, ha a fájlok a repository gyökerében vannak |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Instance Type | **Free** |
| Health Check Path | `/healthz` |

Az **Environment** résznél add hozzá:

| Név | Érték |
|---|---|
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase **Session pooler** URI a saját adatbázis-jelszavaddal |
| `SUPABASE_URL` | Supabase Project URL, például `https://projekt.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | A Supabase **service_role** JWT kulcsa |
| `ADMIN_EMAIL` | Saját admin e-mail címed |
| `ADMIN_PASSWORD` | **Új, 12–128 karakteres jelszó** az admin belépéséhez |

Ezután **Deploy Web Service**. Alternatívaként **New → Blueprint** beolvassa a mellékelt `render.yaml` beállításait, és bekéri a titkos értékeket.

## 4. Belépés

Ha a Render állapota **Live**, nyisd meg az `onrender.com` webcímet. A **Belépés** felületen jelentkezz be az `ADMIN_EMAIL` és `ADMIN_PASSWORD` értékekkel. Az adminfiókot nem kell regisztrálni: az első indítás létrehozza.

Adminként a főoldalon kattints a **Ligák és évek létrehozása** gombra. Az Adatbázis panelen az alap régiók, role-ok és nemzetiségek is betölthetők. Ezután importálhatod a saját JSON-adataidat. A barátaid a Regisztráció felületen hozhatnak létre normál fiókot; nem kapnak adminjogot.

## Rövid tudnivalók

- **Új adatbázissal indul.** A régi oldal felhasználói, meccsei, tippjei, pontszámai és feltöltött képei külön mentéssel vihetők át. Ezt a ZIP nem végzi el. A sablonadatok bemutató adatok.
- A Render Free szerver **15 perc inaktivitás után elalszik**; az első betöltés később körülbelül egy perc is lehet. Nem kell folyamatosan nyitva tartanod az oldalt vagy a saját gépedet.
- A Supabase Free jelenleg **500 MB adatbázist és 1 GB fájltárhelyet** ad, és egy hét inaktivitás után szüneteltetheti a projektet. Ilyenkor a Supabase vezérlőpultján állíthatod vissza. A forgalmi kereteket is figyeld; 7–10 fő várhatóan belefér, de a használat számít.
- A Render helyi lemezén nem tárolunk mentendő adatot. A Supabase-fiókot és a projektet őrizd meg; a frissítések ugyanazt az adatbázist használják, és nem állítják vissza a jelszavakat. Az admin jelszavát belépés után a Profilban változtathatod meg; az Environment mező módosítása önmagában nem írja át a már létező fiók jelszavát.
- Saját domain esetén állítsd az `APP_URL` változót a teljes HTTPS-címre. Az alap Render-címet automatikusan felismeri az oldal.
- Ha `self-signed certificate` / `unable to verify` adatbázishibát látsz, add hozzá a fent említett **DATABASE_CA_CERT** változót a Supabase gyökértanúsítványának teljes szövegével, majd indíts új deployt. Ne kapcsold ki a TLS-ellenőrzést.
- Ha Storage hibával áll le, ellenőrizd a Project URL-t és a service_role kulcsot. Kézzel is létrehozhatsz egy **privát** `akaras-images` bucketet, legalább 5 MB fájlméretkorláttal, PNG/JPEG/WebP/GIF engedéllyel.
- A jelszavas fiókokat az alkalmazás kezeli. A Supabase Authentication panelen nem fognak megjelenni; az adatok a külön `akaras` adatbázissémában vannak.
- A szerver egyszer hozza létre az első sémát. Későbbi sémaváltoztatás külön migrációt igényel; a meglévő táblákat nem törli újraindításkor.

Ellenőrzés fejlesztéshez: Node.js 24+, `npm ci`, majd `npm test`. Az adatbázistesztek helyi PostgreSQL-motoron futnak, a Supabase fájlkérései szimuláltak. Valódi Render/Supabase-fiókba ebből a környezetből nem történt telepítés.

Hivatalos útmutatók és aktuális keretek:
- https://render.com/docs/free
- https://render.com/docs/web-services
- https://supabase.com/pricing
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/storage
