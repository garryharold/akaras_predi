# Akarás Predictions – JSON-adatok

Küldd vissza az `akaras-adatok-ures.json` kitöltött változatát. A `pelda` fájl kizárólag kitalált MINTA csapatokat és játékosokat tartalmaz: a formátumot mutatja, nem aktuális esportadat.

## A legfontosabb tudnivalók

- UTF-8 JSON, `schema_version: 1`. A mezőnevek angolok, a megjelenő nevek lehetnek magyarok.
- Az `id` stabil, egyedi azonosító: pl. `t1`, `faker`, `lck-2026-spring`. Engedélyezett: betű, szám, kötőjel, aláhúzás, pont. Ne változtasd meg később ugyanannak a rekordnak az ID-ját.
- A `*_id` mező mindig egy másik rekord ID-jára hivatkozik, nem annak nevére.
- Hiányzó kép/logó: `null`. A kép/logó lehet HTTPS-képlink, vagy később feltölthető az oldalon.
- A meglévő országok ISO-kódja egyben az ID: `HU`, `KR`, `CN`, `US`, `BR` stb.
- Alap role-ID-k: `TOP`, `JUNGLE`, `MID`, `ADC`, `SUPPORT`.
- Alap régió-ID-k: `NA`, `BR`, `LATAM`, `EMEA`, `KR`, `CN`, `APAC`, `OCE`, `JP`, `VN`, `TW`. Új régió a `regions` tömbben adható hozzá.
- A ligák ID-ja: `lck`, `lec`, `lpl`, `msi`, `ewc`, `worlds`, `demacia-cup`. A 2026-os alapévek ID-ja például `lck-2026`.

## Mit kérek tőled?

### 1. Csapatok – `teams`

Minden csapathoz: `id`, `name` (teljes név), `short_name` (egyedi rövidítés), `region_id`, `league_id`, `logo_url`, `aliases` (egyéb rövidítések listája).

Példa:
```json
{"id":"example-a","name":"Example Team A","short_name":"EXA","region_id":"KR","league_id":"lck","logo_url":null,"aliases":["EXAMPLEA"]}
```

A fő rövidítést ne ismételd meg az `aliases` listában. Egy rövidítést/aliast csak egy csapat használhat.

### 2. Játékosok – `players`

`id`, `ign` (In Game Name), `role_id`, `country_ids` (egy vagy több országkód), `photo_url`.

```json
{"id":"example-mid","ign":"ExampleMid","role_id":"MID","country_ids":["KR"],"photo_url":null}
```

### 3. Keretek – `rosters`

`id`, `team_id`, `player_id`, `role_id`, `is_starter` (true/false), `started_at` (YYYY-MM-DD), `ended_at` (null, ha jelenleg is tag).

Egy játékosnak egy aktív csapata, egy csapatban role-onként egy aktív kezdője lehet. Cseréből több is lehet. Korábbi csapattagság lezárt dátummal is küldhető. A match MVP-listájához a meccs napján érvényes keretet használjuk.

### 4. Évek – `seasons`

`id`, `league_id`, `year` (szám), `name` (megjelenő név). Egy ligának egy rekordja van ugyanarra az évre. Az éven belüli szakaszok a fázisok.

### 5. Fázisok – `phases`

`id`, `season_id`, `name`, `type`, `sort_order`, `win_points`, `loss_points`, `groups`, `participants`.

| `type` érték | Jelentés |
| --- | --- |
| `standings` | Egyetlen tabella |
| `groups` | Csoportkör, csoportonként külön tabella |
| `single_elimination` | Egyenes kiesés |
| `double_elimination` | Felső/alsó ágas kiesés |
| `playoffs` | Rájátszás |

`sort_order`: a fázisok sorrendje (1, 2, 3…).
`win_points`, `loss_points`: a tabella pontozása, nem a prediction pontozása. Alapérték: 1 / 0. Rendezés: tabellapont, sorozatkülönbség, mapkülönbség, nyert map. Teljes egyezésnél megosztott helyezés; külön liga-specifikus H2H szabály egyelőre nincs.

`groups`: csoportkörnél pl. `[{"id":"lck-2026-group-a","name":"A csoport"}]`. Más típusnál `[]`.
`participants`: pl. `[{"team_id":"example-a","group_id":null}]`. Csoportkörben a `group_id` kötelező; minden csapat egy csoportban szerepeljen.

### 6. Meccsek – `matches`

`id`, `phase_id`, `group_id`, `team_a_id`, `team_b_id`, `best_of`, `start_at`, `round_name`, `round_order`, `bracket_side`, `status`, `result`.

- `best_of`: 1, 3, 5, 7 vagy 9.
- `start_at`: ISO 8601 dátum időzónával. Például `2026-11-10T18:00:00+01:00`, vagy ennek megfelelő `2026-11-10T17:00:00Z`. Ne küldj időzóna nélküli időpontot.
- `round_name`: szabad szöveg, pl. `Semifinal`, `Grand Final`, `1-0`, `2. forduló`.
- `round_order`: sorrend a versenyágban (1, 2, 3…).
- `bracket_side`: `main`, `upper`, `lower`, `final`.
- `status`: `scheduled`, `live`, `completed`, `cancelled`.
- `result`: nem befejezett meccsnél `null`.
- Befejezett meccsnél pl. `{"score_a":2,"score_b":1,"mvp_player_id":"example-mid"}`. Az MVP lehet `null`, és később hozzáadható.
- Bo3-ban csak 2–0, 2–1, 0–2, 1–2 érvényes. Bo5-ben három nyert map kell stb.
- Mindkét csapat legyen a fázis résztvevője. Csoportkörben ugyanabban a csoportban kell lenniük.
- Kiesésnél a megadott meccsek forduló és ág szerint jelennek meg. A következő forduló párosítását az admin rögzíti; automatikus továbbjutási összekötés még nincs.

## Pontozás

Jó győztes: **30 pont**. Pontos sorozateredmény: **összesen 50 pont**, tehát nem 30+50. Jó match MVP: **további 30 pont**, a sorozattipp helyességétől függetlenül. Maximum **80 pont / meccs**.

A tippelés szerveridő szerint lezár a kezdéskor vagy amikor az admin élőnek/befejezettnek jelöli a meccset. Eredményjavításnál a tabella és minden tipp pontja újraszámolódik. Törölt meccs nem ad pontot.

## Importálás

Az Admin → JSON-import oldalon előbb ellenőrzés, utána importálás történik. Az ellenőrzés nem ment. A mentés egyetlen tranzakció: hibánál az új rekordok nem kerülnek be részlegesen.

Az import hozzáadó jellegű: a már létező ID-kat kihagyja, nem ír felül és nem töröl adatot. Meglévő meccs eredményét az admin Eredmény gombjával javítsd. Meglévő évhez ugyanazt az ID-t használd. Legfeljebb 2 MB, 2000 alaprekord / fájl. Ha még nincs meg minden adat, a megfelelő tömbök maradhatnak üresek.

A rendszer jelenleg a privát ChatGPT-s oldalon fut. A Renderre költöztetés külön lépés; az adatformátum és a logikai kapcsolatok ahhoz is használhatók.
