# Sersimo – Simulator brad (plugin WordPress / WooCommerce)

Pluginul adaugă pe pagina de produs butonul **„🎄 Vezi bradul în camera ta”**. Butonul deschide un simulator la scară reală. Clientul poate:
- alege camera: living, cameră goală sau o poză a camerei lui;
- compara înălțimile;
- vedea silueta unui om, ca referință;
- verifica dacă bradul încape sub tavan;
- salva sau trimite o captură cu brandul Sersimo.

Pluginul măsoară și **câtă lume folosește simulatorul** și **ce comenzi vin din el**.

Cerințe: WordPress 6+, WooCommerce 7+, PHP 7.4+. Compatibil cu HPOS și cu checkout-ul pe blocuri. Nu folosește librării externe și nu se conectează la alte servere.

---

## 1. Instalare

1. *Module → Adaugă → Încarcă modul* → `sersimo-simulator-brad.zip` → Activează.
2. Recomandat: instalează întâi pe **staging**.
3. Dacă site-ul are cache (WP Rocket, LiteSpeed etc.), golește cache-ul după ce activezi simulatorul pe un produs.

## 2. Activare pe un brad (la început, pe un singur model)

Fiecare înălțime e un produs separat. Pentru **fiecare** înălțime a modelului:

*Produse → Editează → Date produs → tab-ul „Simulator brad”*

| Câmp | Ce pui |
|---|---|
| Activează simulatorul | ✔ |
| Familie (model) | **Același text exact** la toate înălțimile, ex. `Frasin de Munte 2D`. Așa se leagă între ele ca mărimi. |
| Înălțime (cm) | ex. `220`. Dacă rămâne gol, se citește din titlu („…220cm”). |
| Diametru la bază (cm) | ex. `135`. **Important pentru scară.** Dacă rămâne gol, se estimează. |
| Decupaj brad | imaginea transparentă (vezi mai jos). Ajunge pe o singură înălțime; celelalte o preiau automat. |
| Poziția trunchiului | `0.5` dacă bradul e simetric. Pentru decupajul existent: `0.545`. |

Butonul apare doar pe produsele activate, de tip **simplu** (produsele variabile nu sunt suportate în v1).

### Decupajul (imaginea bradului)
- PNG sau WebP cu **fundal transparent**, cam 500×900 px și sub 150 KB.
- Tăiat **strâns**: sus = vârful, jos = picioarele suportului, stânga/dreapta = cele mai late ramuri.
  Simulatorul întinde lățimea imaginii pe diametru și înălțimea pe înălțimea bradului.
- Poza bradului trebuie făcută din față, cu aparatul la jumătatea înălțimii bradului. Fundalul se poate scoate cu remove.bg, Photoshop sau Canva.
- Exemplu: `../prototip/assets/tree.webp` (Frasin de Munte 2D).

### Camera „Bloc / Casă” (v1.2)
A înlocuit „Cameră goală”. Clientul alege un preset; fiecare are ușă, fereastră, calorifer, canapea și măsuță:

| Preset | Dimensiuni | Tavan |
|---|---|---|
| Bloc vechi (sufragerie ~18 m²) | 3,6 × 5 m | 2,55 m |
| Bloc vechi, cameră mică (~14 m²) | 3,2 × 4,3 m | 2,55 m |
| Bloc nou (living ~24 m²) | 4,2 × 5,8 m | 2,70 m |
| Casă (living ~30 m²) | 5,2 × 6 m | 2,80 m |

Dimensiunile pentru blocurile vechi sunt valori tipice pentru sufrageriile din anii '70–'80 (confort 1 ≈ 18 m², confort 2 ≈ 14 m²); 2,55 m e înălțimea minimă din normativ.

**Custom** (pentru case) pornește de la presetul ales și deschide toate setările:
- dimensiunile camerei: lățime, adâncime, tavan;
- ușa: peretele, poziția, lățimea și înălțimea;
- fereastra: peretele, poziția, lățimea, înălțimea și înălțimea de la podea;
- culoarea pereților (5 variante) și podeaua: parchet deschis, închis sau gri, ori gresie;
- canapea: da sau nu.

Deasupra bradului apare linia tavanului; e roșie dacă nu mai rămân 10 cm pentru vârf. Livingul rămâne neschimbat.

### Modul „Camera ta (poză)” (v1.1)
Clientul face o poză direct din simulator (pe telefon se deschide camera) sau alege una din galerie. Apoi are 3 pași:
1. **Bradul**: îl trage pe podea. Dacă telefonul a fost ținut drept, nivelul telefonului e deja la mijlocul pozei și scara e corectă. Opțional: înălțimea telefonului și a tavanului (cu avertisment dacă bradul nu încape).
2. **Calibrare** (opțional, pentru precizie): potrivește o linie pe un obiect de înălțime cunoscută (ușă 205 cm, blat 90 cm, masă 75 cm sau orice altă valoare). Scara se calculează din acel obiect.
3. **În față** (opțional): pictează peste canapea, masă etc., ca bradul să apară în spatele lor. Are radieră, anulare și zoom cu 2 degete.

Poza rămâne în browserul clientului; nu se trimite nicăieri. Statisticile numără separat pozele calibrate și cele cu obiecte în față.

## 3. Dacă butonul nu apare

Unele teme sau page buildere (Elementor, Divi) nu folosesc hook-ul standard WooCommerce. În acest caz:
- *WooCommerce → Simulator brad* → debifează „Buton automat”;
- pune shortcode-ul `[sersimo_simulator_brad]` în șablonul paginii de produs, lângă „Adaugă în coș”;
- opțional, alt text pe buton: `[sersimo_simulator_brad text="Vezi-l în camera ta"]`.

## 4. Ce se măsoară

### a) Utilizare
Vezi *WooCommerce → Simulator brad*:
- afișări ale paginilor cu buton → deschideri ale simulatorului (rata de utilizare);
- schimbări de înălțime, poze încărcate, capturi;
- click-uri pe „Adaugă în coș” din simulator;
- toate cifrele și pe produs.

Nu se numără administratorii sau editorii logați, deci testele echipei nu strică cifrele, și nici boții.

### b) Comenzi venite din simulator
Coloana **„Simulator”** din lista de comenzi apare și ca notă pe fiecare comandă:
- **🎄 din simulator**: produsul a fost adăugat în coș din simulator;
- **a folosit**: clientul a deschis simulatorul în ultimele 30 de zile, dar a adăugat produsul din pagina obișnuită.

Valorile se salvează în meta comenzii `_ssb_source` (`added` / `used`). Pagina de statistici arată numărul și valoarea acestor comenzi.

### c) UTM (activat implicit, se poate dezactiva din setări)
Butonul „Adaugă în coș” din simulator pune produsul în coș și duce clientul direct în coș, cu
`utm_source=simulator-brad&utm_medium=configurator&utm_campaign=simulator-brad`.
Valorile apar în GA4 și în coloana *Origine* (Order Attribution) din WooCommerce.

⚠️ Un UTM pe un link intern **înlocuiește sursa originală** a vizitei. De exemplu, un client venit din reclama Facebook va apărea în GA4 ca „simulator-brad”. Dacă asta strică rapoartele de reclame, dezactivează UTM-ul. Coloana „Simulator” de la punctul b) funcționează și fără UTM.

### d) GA4 / Google Tag Manager
Simulatorul trimite în `dataLayer`:
- `{event:'simulator_brad', simulator_action:'open'|'size'|'room_photo'|'photo_upload'|'shot'|'cart'|…, product_id, tree_height, tree_family}`;
- la adăugarea în coș, și evenimentul standard `add_to_cart` (ecommerce).

În GTM se pot face trigger-e pe evenimentul `simulator_brad`.

## 5. Structura fișierelor

```
sersimo-simulator-brad.php          bootstrap, compatibilitate HPOS/blocks
includes/class-ssb-settings.php     setări (buton, UTM, branding)
includes/class-ssb-product.php      meta produs, grupare pe familie, JSON pentru simulator
includes/class-ssb-admin.php        tab „Simulator brad” în editare produs
includes/class-ssb-frontend.php     butonul + shortcode, încarcă assets doar unde e nevoie
includes/class-ssb-tracking.php     contoare evenimente (admin-ajax), marcare coș/comandă, coloana din comenzi
includes/class-ssb-stats.php        pagina WooCommerce → Simulator brad
assets/simulator.js | .css          simulatorul (canvas 2D, JS simplu, fără librării)
```

Meta produs: `_ssb_enabled`, `_ssb_family`, `_ssb_height`, `_ssb_diameter`, `_ssb_cutout_id`, `_ssb_base_x`.
Opțiuni: `ssb_settings`, `ssb_stats` (contoare zilnice, păstrate 400 de zile).
Cookie: `ssb_used=1` (30 de zile, doar funcțional, fără date personale).

## 6. De verificat pe staging

- [ ] Butonul apare pe produsul activat și nu apare pe celelalte.
- [ ] Toate înălțimile din familie apar, cu prețul corect (inclusiv reducerile).
- [ ] „Adaugă în coș” din simulator duce în coș, cu produsul corect.
- [ ] Comandă de test → în lista de comenzi, coloana „Simulator” arată „🎄 din simulator”.
- [ ] Comandă de test după ce ai deschis simulatorul, dar ai adăugat din pagină → „a folosit”.
- [ ] Testat logat ca client sau în fereastră privată: ca admin, evenimentele nu se numără.
- [ ] Pe iPhone și Android: deschidere, mutare cu degetul, zoom cu 2 degete, încărcare poză.
- [ ] Cookie banner: `ssb_used` e un cookie funcțional; adăugați-l în politica de cookies dacă e nevoie.

Demo fără WordPress: rulează `python -m http.server` în folderul părinte și deschide `/demo/index.html`.
