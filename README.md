# Glücksrad des Wissens – Klasse 2

Ein gemeinsames Klassenquiz für die ersten Schultage nach den Sommerferien.
Die Lehrkraft dreht ein Glücksrad, alle Kinder sehen dieselbe Frage und
antworten gleichzeitig – auf Papier oder handschriftlich auf dem Tablet.

Die App läuft im Browser, braucht keine Anmeldung, keine Schülergeräte und
kein Backend. Sie speichert ausschließlich lokal im Browser der Lehrkraft.

---

## Starten

**Variante 1 – einfach öffnen**
`index.html` doppelklicken. Das genügt für den Unterricht.

**Variante 2 – lokaler Webserver** (empfohlen zum Entwickeln)

```bash
python3 -m http.server 8000
# danach im Browser: http://localhost:8000
```

**Variante 3 – GitHub Pages**
Repository anlegen, alle Dateien in den Hauptordner (Branch `main`) legen,
unter *Settings → Pages* als Quelle `main / (root)` wählen. Die App ist dann
über die GitHub-Pages-Adresse erreichbar und funktioniert nach dem ersten
Laden auch ohne weitere externe Dienste.

Getestet mit aktuellen Versionen von Chrome, Edge, Firefox und Safari, auf
Desktop, Tablet und Whiteboard.

---

## Dateistruktur

```
/
├── index.html      alle Bildschirme (Start, Rad, Frage, Lösung, Lehrkraft-Menü)
├── style.css       Gestaltung, Farben, Schriftgrößen, Responsivität
├── app.js          gesamte Programmlogik
├── questions.js    Fragenpool (180 Fragen)
└── README.md
```

Die Radbeschriftung liegt außerhalb der rotierenden SVG-Gruppe: Beim Drehen
wird nur die Position der Wörter mitgeführt, gedreht wird die Schrift nie. So
bleiben MATHE, DEUTSCH und SACHKUNDE in jeder Radstellung waagerecht und
aufrecht. Deshalb läuft die Raddrehung in `app.js` als Animation Bild für Bild
statt über einen CSS-Übergang.

Das Rad rechnet in einer viewBox von 800 x 800 (Mittelpunkt 400/400,
Segmentradius 340, Nabe 42). Die Schriftgröße wird beim ersten Anzeigen des
Rades gemessen und so gewählt, dass das längste Wort auch in der engsten
Radstellung zwischen Nabe und Rand passt – also dann, wenn es längs auf der
Mittellinie liegt. Wörter und Position stehen als Konstanten am Anfang von
Abschnitt 5 in `app.js`; ein längeres Wort verkleinert automatisch alle drei.

Kein `assets`-Ordner: Das Rad ist ein Inline-SVG, die Töne werden im Browser
erzeugt. Es gibt keine Bild- oder Audiodateien und keine externen Bibliotheken.

`app.js` ist in nummerierte Abschnitte gegliedert (Speicherung, Fragenauswahl,
Rad, Frage/Lösung, Lehrkraft-Menü, Ton).

---

## Bedienung

| Bildschirm | Möglichkeiten |
|---|---|
| Start | Spiel starten, Lehrkraft-Einstellungen |
| Rad | Drehen (Button oder Klick/Tipp auf das Rad), Lehrkraft-Einstellungen |
| Frage | Antwort anzeigen, Frage überspringen, zurück zum Rad |
| Lösung | Nächste Runde, zurück zur Frage, zurück zum Rad |

Die Lehrkraft bestimmt das Tempo: Es gibt keinen Timer und keinen erzwungenen
Ablauf. Alle Bedienelemente sind auch per Tastatur erreichbar (Tab, Enter,
Leertaste; `Esc` schließt Sicherheitsabfragen).

---

## Fragetypen

| Typ | Bedeutung | Verhalten in der App |
|---|---|---|
| `closed` | eine eindeutig bestimmbare Lösung | Lösung wird auf Klick angezeigt |
| `open` | mehrere Antworten möglich | Hinweis „Mehrere Antworten können richtig sein.“; als Lösung erscheinen Beispielantworten |
| `fun` | Scherzfrage | wird wie jede andere Frage gestellt; bei der Auflösung erscheint „Scherzfrage 😁“ |

---

## Fragenpool

`questions.js` enthält die 180 Fragen aus dem Fragenpool-Dokument für Klasse 2:
60 Mathematik, 60 Deutsch, 60 Allgemeinwissen. Fragen, Lösungen, IDs und
Bereiche wurden unverändert übernommen. Ergänzt wurde je Frage nur das
technisch benötigte Feld `type`.

```js
{
  id: "M2-001",
  category: "Mathematik",
  subcategory: "Zahlen & Operationen",
  type: "closed",
  question: "Wie viel ist 5 + 3?",
  answer: "8"
}
```

Erlaubte Kategorien: `Mathematik`, `Deutsch`, `Allgemeinwissen`.
Auf dem Bildschirm heißen sie **Mathe**, **Deutsch** und **Sachkunde** – die
Zuordnung steht in `app.js` als `CATEGORY_LABEL` und lässt sich dort in einer
Zeile ändern. Im Fragenpool und im `localStorage` bleiben die langen Namen
stehen, damit vorhandene Daten weiter passen.
Erlaubte Typen: `closed`, `open`, `fun`.

Als `open` eingestuft sind die Fragen, deren Lösung im Dokument ausdrücklich
mehrere Antworten zulässt: D2-031, D2-032, D2-058 und AW2-040.
Als `fun` eingestuft sind M2-040 und AW2-045, deren Lösung im Dokument mit
„Scherzfrage:“ beginnt. Da die App den Hinweis „Scherzfrage 😁“ selbst
anzeigt, steht dieses Wort im Lösungstext nicht noch einmal.

**Sachkunde** (intern `Allgemeinwissen`) ist in fünf Unterkategorien mit je 12 Fragen
aufgeteilt, die auf dem Rad nicht sichtbar sind: Welt & Länder, Natur & Tiere,
Alltag & Gesellschaft, Technik & Medien, Kultur. Diese werden nicht zufällig,
sondern reihum gezogen: Jede Unterkategorie kommt einmal an die Reihe, danach
beginnt eine neue, neu gemischte Fünferrunde. So folgen nicht fünf
Länderfragen aufeinander. Unterkategorien ohne offene Fragen werden
übersprungen. Bei 60 Allgemeinwissensfragen ergibt das 12 vollständige Runden.

Fragen ändern oder ergänzen: Einträge in `questions.js` bearbeiten und auf
eindeutige IDs achten. Bereits vergebene IDs, die in `localStorage` als
verwendet gespeichert sind, bleiben gesperrt – nach größeren Änderungen am
Pool empfiehlt sich ein Reset im Lehrkraft-Menü.

---

## Lokale Speicherung

Gespeichert wird ausschließlich im `localStorage` des verwendeten Browsers.
Es werden keine Namen, keine Schülerdaten und keine personenbezogenen Daten
erfasst und nichts an einen Server gesendet.

| Schlüssel | Inhalt |
|---|---|
| `usedQuestionIds` | Liste der IDs bereits gezeigter Fragen |
| `currentGeneralKnowledgeRotation` | offene Unterkategorien der laufenden Allgemeinwissen-Runde |
| `sessionStatistics` | Zählung der heutigen Sitzung (gespielte Fragen gesamt und je Kategorie) |
| `settings` | Ton an/aus |

Eine Frage gilt als verwendet, sobald sie angezeigt wurde – auch wenn sie
übersprungen wird. Nach Schließen und erneutem Öffnen des Browsers bleiben
alle bisher verwendeten Fragen gesperrt, bis die Lehrkraft bewusst
zurücksetzt. Am Montag 15 Fragen gespielt, am Dienstag weiter: Die 15 Fragen
kommen nicht noch einmal.

**Zurücksetzen im Lehrkraft-Menü**

- *Fragenpool zurücksetzen* – gibt alle 180 Fragen wieder frei (mit Sicherheitsabfrage).
- *Nur Mathematik / Nur Deutsch / Nur Allgemeinwissen* – gibt genau eine Kategorie wieder frei.
- *Neue Sitzung* – setzt nur die Zählung von heute zurück. Bereits verwendete Fragen bleiben gesperrt.

Ist eine Kategorie aufgebraucht, wiederholt die App keine Fragen, sondern
bietet an, eine andere Kategorie zu wählen oder genau diese Kategorie
zurückzusetzen.

Falls ein Browser `localStorage` blockiert, läuft die App weiter – dann
allerdings ohne Gedächtnis über das Schließen des Tabs hinaus.

---

## Barrierearme Gestaltung

- große Schriften und hoher Kontrast, auf Projektion ausgelegt
- Kategorien sind zusätzlich zur Farbe beschriftet
- die Radbeschriftung bleibt in jeder Radstellung waagerecht und aufrecht
- vollständige Tastaturbedienung mit sichtbaren Fokusrahmen
- `aria-live` für neu erscheinende Fragen, Lösungen und das Raddergebnis
- `prefers-reduced-motion` wird berücksichtigt: Das Rad springt dann ohne
  Animation auf die Kategorie

---

## Nicht enthalten (bewusst)

Keine Benutzerkonten, keine Schülerprofile, kein Login, kein Backend, keine
Datenbank, kein Multiplayer, kein Tracking, keine individuellen
Leistungsstatistiken.
