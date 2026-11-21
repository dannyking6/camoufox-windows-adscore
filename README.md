# camoufox-windows-adscore

Profil Windows « gagnant » pour Camoufox, validé contre **AdScore** (adsco.re)
: verdict **proxy** au lieu de *bot* sur ~83 % des sessions (IP datacenter).

## Le verdict AdScore, en une phrase

AdScore ne regarde pas le TCP : il compare ce que le navigateur **claim**
(UA, OS, GPU) à ce qu'il **mesure** (sondes `s0`-`s37`). Incohérence ⇒ *bot*,
IP datacenter ⇒ *proxy*, tout cohérent + IP résidentielle ⇒ *human*.

## Ce qui flague (mesuré en inversant le script AdScore, 98 Ko)

| Sonde | Ce qu'elle mesure | Flag si |
|---|---|---|
| s34 | **benchmark de vitesse `getParameter(UNMASKED_RENDERER)`** | spoof JS nu = 3000+ appels/ms (réel Windows ≈ 8) ⇒ **bot** |
| s35/s36 | canvas 200×200 + rendu WebGL vs GPU déclaré | canvas bruité ≠ GPU ⇒ **bot** |
| s26/s25/s29 | intégrité des prototypes, propriétés `_`/`$cd`/28 chars, `toString` | patches stealth visibles ⇒ bot |
| s8 | webdriver / `__playwright_builtins__` / `$cdc_` / selenium | automation ⇒ bot |
| s15 | **sonde OS par polices** (`Mistral` = marqueur Windows/Office, `Noto*` = Linux, `PingFang` = macOS) | claim incohérent avec les fontes |
| s5 | benchmark CPU (boucle gcd) | `Infinity` = CPU serveur |
| s11[2] | **temps de création du contexte WebGL** | > ~120 ms = rendu logiciel ⇒ bot (42-67 ms au repos = OK) |

## La recette gagnante

```python
AsyncCamoufox(
    os="windows",
    canvas_noise=False,          # JAMAIS de noise: incohérence GPU/canvas = bot
    geoip=True,
    i_know_what_im_doing=True,
    exclude_addons=[DefaultAddons.UBO],
    firefox_user_prefs={...},    # voir win_profile.py
)
# + locale="en-US" (voix TTS US), timezone alignée sur l'IP, 1440x900
# + adscore_patch.js AVANT le tag Adscore
# + machine au repos pendant le run (contexte WebGL < 120 ms)
# + fingerprint épinglé: generate_fingerprint(window=(1280,720),
#   screen=Screen(1920,1080,1920,1040), os="windows") — sinon Camoufox
#   tire l'écran au hasard par session (innerHeight > availHeight = bot)
# + serveur à double sortie NAT uniquement: routeur local qui bloque
#   4.adsco.re (voir section dédiée)
```

## Le patch (`adscore_patch.js`)

À insérer **avant** `<script async src="//c.adsco.re">` sur une page que vous
contrôlez :

1. hook `window.Worker` → injecte le patch dans les workers blob/data d'AdScore ;
2. wrapper `getParameter` (page + workers) :
   - ralentit la lecture `UNMASKED_RENDERER/VENDOR` à ~125 µs ⇒ benchmark ≈ 8 appels/ms comme un vrai driver Windows ;
   - `MAX_ELEMENTS_INDICES/VERTICES` → 65535 (Mesa renvoie 2147483647 = signature Linux) ;
3. `toString`/`name` spoofés au format natif Firefox (les sondes s34/s29 lisent le toString).

Résultat mesuré : benchmark 3298 → 8-11 appels/ms, verdicts bot → **proxy**.

## Le piège du NAT à double sortie (serveur Milan M247 — 21 nov.)

Régression mystère : taux proxy passé de ~83 % à ~1/3, alors que patch,
fingerprint et écran étaient inchangés. Cause trouvée en capturant les
payloads via mitmproxy et en comparant champ par champ avec le payload gagnant :

- notre conteneur est derrière un **CGNAT d'hébergeur** (interface interne
  `100.126.224.17`) qui **route les destinations vers deux IP publiques
  différentes** : `api.ipify.org` sortait par `45.134.212.90`, le reste par
  `217.138.219.222` ;
- les deux sondes echo d'AdScore (`4.adsco.re` et `6.adsco.re`, ports 443 et
  2087) ont donc vu **deux IP différentes pour le même navigateur** ⇒ mismatch
  ⇒ verdict bot. Dans le payload gagnant, la sonde 4 = `-2` (échec) et seule la
  sonde 6 répondait ⇒ une seule IP ⇒ proxy.

**Fix (validé 4/4 proxy)** : bloquer `4.adsco.re` en dehors du navigateur.
Sur notre serveur, un petit routeur CONNECT local (`echo_router.py`, port
8897) tunnelise tout et renvoie 503 pour `4.adsco.re` ; le navigateur passe
par `proxy={"server": "http://127.0.0.1:8897"}`. La sonde échoue (code `-1`),
pas de fuite d'IP, verdict proxy. Un blocage dans la page serait détectable ;
au niveau réseau, non.

> ⚠️ **Ce fix est spécifique à NOTRE serveur Milan (CGNAT à double sortie).**
> Une box qui n'a qu'UNE seule IP de sortie (ex. la box coconut Prized)
> n'a pas ce problème : ne pas appliquer le blocage ni le routeur là-bas,
> et vérifier d'abord avec deux `curl https://<endpoint>.adsco.re/` différents
> (ils renvoient l'IP vue) que les réponses concordent.

Diagnostic express pour toute nouvelle machine :

```bash
curl -s https://4.adsco.re/ ; echo   # IP vue par la sonde 4
curl -s https://6.adsco.re/ ; echo   # IP vue par la sonde 6
# identiques => pas de double sortie, pas de fix nécessaire
# différentes => bloquer 4.adsco.re (routeur/pare-feu), sinon bot intermittent
```

## Limites connues (honnêtes)

- **IP datacenter = plafond « proxy »**. « human » exige une IP résidentielle.
- Création de contexte WebGL logicielle (42-187 ms) : sous charge serveur le
  temps dépasse le seuil ⇒ peut repasser bot. Lancements séquentiels, machine
  idle. (L'ancienne « 1 session sur 5 » était en réalité le NAT double sortie
  ci-dessus, pas la charge.)
- Le patch exige de contrôler la page qui sert le tag Adscore.
- Camoufox tire GPU/polices/voix au hasard par session — normal, mais chaque
  identité doit rester cohérente avec ses propres claims (c'est le cas ici).

## Usage

```bash
pip install "camoufox[geoip]" playwright==1.62.0   # pin important
python3 win_profile.py https://votre-page.tld --click
```

Voir `botresults/ADSCORE_WIN_ETAT.md` pour l'historique complet des tests.
