/* =====================================================================
   Glücksrad des Wissens – Klasse 2
   Zentrale Programmlogik.

   Aufbau dieser Datei:
     1. Konstanten und Hilfsfunktionen
     2. Speicherung (localStorage)
     3. Fragenauswahl und Allgemeinwissen-Rotation
     4. Bildschirmwechsel
     5. Glücksrad
     6. Frage und Lösung
     7. Lehrkraft-Menü und Zurücksetzen
     8. Ton
     9. Start
   ===================================================================== */

(function () {
  "use strict";

  /* ================================================================== */
  /* 1. Konstanten und Hilfsfunktionen                                  */
  /* ================================================================== */

  var QUESTIONS = window.QUESTIONS || [];

  var CATEGORIES = ["Mathematik", "Deutsch", "Allgemeinwissen"];

  /* Reihenfolge der Segmente auf dem Rad – im Uhrzeigersinn ab 12 Uhr */
  var WHEEL_SEGMENTS = ["Mathematik", "Deutsch", "Allgemeinwissen"];

  var GK_SUBCATEGORIES = [
    "Welt & Länder",
    "Natur & Tiere",
    "Alltag & Gesellschaft",
    "Technik & Medien",
    "Kultur"
  ];

  var CATEGORY_KEY = {
    "Mathematik": "math",
    "Deutsch": "german",
    "Allgemeinwissen": "general"
  };

  /* Anzeigenamen für die Oberfläche. Intern (Fragenpool, localStorage)
     bleiben die Kategorien "Mathematik", "Deutsch" und "Allgemeinwissen"
     unverändert – geändert wird nur, was auf dem Bildschirm steht. */
  var CATEGORY_LABEL = {
    "Mathematik": "Mathe",
    "Deutsch": "Deutsch",
    "Allgemeinwissen": "Sachkunde"
  };

  function labelOf(category) {
    return CATEGORY_LABEL[category] || category;
  }

  var STORAGE = {
    used: "usedQuestionIds",
    rotation: "currentGeneralKnowledgeRotation",
    session: "sessionStatistics",
    settings: "settings"
  };

  function $(id) { return document.getElementById(id); }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function prefersReducedMotion() {
    return window.matchMedia &&
           window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ================================================================== */
  /* 2. Speicherung                                                     */
  /* ================================================================== */

  /* localStorage kann blockiert sein (z. B. strenge Browsereinstellungen).
     Die App muss auch dann laufen – dann eben ohne Gedächtnis. */
  var storageWorks = (function () {
    try {
      window.localStorage.setItem("__test__", "1");
      window.localStorage.removeItem("__test__");
      return true;
    } catch (e) {
      return false;
    }
  })();

  function load(key, fallback) {
    if (!storageWorks) return fallback;
    try {
      var raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      var value = JSON.parse(raw);
      return (value === null || value === undefined) ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    if (!storageWorks) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* Speichern fehlgeschlagen – das Spiel läuft trotzdem weiter. */
    }
  }

  var state = {
    used: [],        /* IDs bereits gezeigter Fragen                     */
    rotation: [],    /* offene Unterkategorien der laufenden AW-Runde    */
    session: null,   /* Zählung der heutigen Sitzung                     */
    settings: null
  };

  function defaultSession() {
    return {
      played: 0,
      byCategory: { "Mathematik": 0, "Deutsch": 0, "Allgemeinwissen": 0 }
    };
  }

  function defaultSettings() {
    return { sound: true };
  }

  function loadState() {
    var used = load(STORAGE.used, []);
    state.used = Array.isArray(used) ? used.filter(function (id) {
      return typeof id === "string";
    }) : [];

    var rot = load(STORAGE.rotation, []);
    state.rotation = Array.isArray(rot) ? rot.filter(function (sub) {
      return GK_SUBCATEGORIES.indexOf(sub) !== -1;
    }) : [];

    var session = load(STORAGE.session, null);
    state.session = defaultSession();
    if (session && typeof session === "object") {
      if (typeof session.played === "number") state.session.played = session.played;
      if (session.byCategory) {
        CATEGORIES.forEach(function (cat) {
          if (typeof session.byCategory[cat] === "number") {
            state.session.byCategory[cat] = session.byCategory[cat];
          }
        });
      }
    }

    var settings = load(STORAGE.settings, null);
    state.settings = defaultSettings();
    if (settings && typeof settings === "object") {
      if (typeof settings.sound === "boolean") state.settings.sound = settings.sound;
    }
  }

  function saveUsed()     { save(STORAGE.used, state.used); }
  function saveRotation() { save(STORAGE.rotation, state.rotation); }
  function saveSession()  { save(STORAGE.session, state.session); }
  function saveSettings() { save(STORAGE.settings, state.settings); }

  /* ================================================================== */
  /* 3. Fragenauswahl und Allgemeinwissen-Rotation                      */
  /* ================================================================== */

  function isUsed(question) {
    return state.used.indexOf(question.id) !== -1;
  }

  function openQuestions(category, subcategory) {
    return QUESTIONS.filter(function (q) {
      if (q.category !== category) return false;
      if (subcategory && q.subcategory !== subcategory) return false;
      return !isUsed(q);
    });
  }

  function countOpen(category, subcategory) {
    return openQuestions(category, subcategory).length;
  }

  function countTotal(category, subcategory) {
    return QUESTIONS.filter(function (q) {
      if (q.category !== category) return false;
      if (subcategory && q.subcategory !== subcategory) return false;
      return true;
    }).length;
  }

  /* Nächste Unterkategorie aus der laufenden Rotation holen.
     Unterkategorien ohne offene Fragen werden übersprungen. */
  function nextGeneralSubcategory() {
    for (var guard = 0; guard < 2; guard++) {
      while (state.rotation.length > 0) {
        var sub = state.rotation.shift();
        saveRotation();
        if (countOpen("Allgemeinwissen", sub) > 0) return sub;
      }
      /* Runde aufgebraucht – neue Runde in gemischter Reihenfolge */
      state.rotation = shuffle(GK_SUBCATEGORIES);
      saveRotation();
    }
    return null;
  }

  /* Wählt eine noch nicht verwendete Frage der Kategorie aus.
     Gibt null zurück, wenn die Kategorie leer ist. */
  function drawQuestion(category) {
    if (category === "Allgemeinwissen") {
      if (countOpen("Allgemeinwissen") === 0) return null;
      var sub = nextGeneralSubcategory();
      if (!sub) return null;
      var pool = openQuestions("Allgemeinwissen", sub);
      if (pool.length === 0) return null;
      return pickRandom(pool);
    }

    var open = openQuestions(category);
    if (open.length === 0) return null;
    return pickRandom(open);
  }

  function markUsed(question) {
    if (!isUsed(question)) {
      state.used.push(question.id);
      saveUsed();
    }
  }

  /* ================================================================== */
  /* 4. Bildschirmwechsel                                               */
  /* ================================================================== */

  var screens = {
    start:    $("screen-start"),
    wheel:    $("screen-wheel"),
    question: $("screen-question"),
    answer:   $("screen-answer"),
    empty:    $("screen-empty"),
    teacher:  $("screen-teacher")
  };

  var currentScreen = "start";
  var teacherReturnScreen = "start";

  function showScreen(name, focusEl) {
    Object.keys(screens).forEach(function (key) {
      screens[key].hidden = (key !== name);
    });
    currentScreen = name;
    if (focusEl) {
      window.setTimeout(function () { focusEl.focus(); }, 30);
    }
    window.scrollTo(0, 0);
  }

  /* ================================================================== */
  /* 5. Glücksrad                                                       */
  /* ================================================================== */

  var SVG_NS = "http://www.w3.org/2000/svg";

  var rotor = $("wheel-rotor");
  var labelGroup = $("wheel-labels");
  var bulbGroup = $("bulbs");
  var resultText = $("wheel-result");
  var btnSpin = $("btn-spin");

  /* Beschriftung der drei Segmente.
     mid   Winkel der Segmentmitte (Grad, im Uhrzeigersinn ab 12 Uhr)
     word  kurzer Name in Großbuchstaben, waagerecht in der Fläche */
  var WHEEL_LABELS = [
    { mid: 60,  word: "MATHE" },
    { mid: 180, word: "DEUTSCH" },
    { mid: 300, word: "SACHKUNDE" }
  ];

  /* Alle Angaben im Koordinatensystem des Rades: viewBox 800 x 800,
     Mittelpunkt 400/400, Segmentradius 340, Nabe 42.

     Die Wörter bleiben beim Drehen waagerecht. Sie müssen deshalb auch in
     der engsten Radstellung passen, nämlich dann, wenn ein Wort längs auf
     der Mittellinie zwischen Nabe und Rand liegt. Bei einem Abstand von 190
     ist der Platz nach innen und nach außen gleich groß – das ergibt die
     größtmögliche Schrift. */
  var LABEL_RADIUS = 190;   /* Abstand der Wortmitte von der Radmitte      */
  var LABEL_INNER = 50;     /* Sicherheitsabstand zur Nabe                 */
  var LABEL_OUTER = 330;    /* Sicherheitsabstand zum Rand                 */

  var rotation = 0;
  var spinning = false;
  var bulbTimer = null;
  var spinFrame = null;
  var labelsFitted = false;

  /* Die Wörter hängen in einer Gruppe, die nur verschoben und nie gedreht
     wird – so bleiben sie in jeder Radstellung waagerecht und aufrecht. */
  function buildLabels() {
    WHEEL_LABELS.forEach(function (label) {
      var group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("class", "wheel-label");

      var text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", "0");
      text.textContent = label.word;
      group.appendChild(text);

      label.element = group;
      label.text = text;
      labelGroup.appendChild(group);
    });
  }

  /* Größtmögliche Schriftgröße bestimmen, bei der das längste Wort noch
     zwischen Nabe und Rand passt. Gemessen wird im Browser, damit das auch
     bei einer anderen Schriftart oder anderen Wörtern stimmt.
     Messen funktioniert erst, wenn das Rad sichtbar ist. */
  function fitLabels() {
    if (labelsFitted) return;

    var available = 2 * Math.min(LABEL_OUTER - LABEL_RADIUS,
                                 LABEL_RADIUS - LABEL_INNER);
    var probe = 100;
    var widest = 0;

    WHEEL_LABELS.forEach(function (label) {
      label.text.setAttribute("font-size", probe);
    });
    WHEEL_LABELS.forEach(function (label) {
      try {
        widest = Math.max(widest, label.element.getBBox().width);
      } catch (e) {
        widest = 0;
      }
    });

    if (!widest) return;   /* noch nicht sichtbar – beim nächsten Mal erneut */

    var size = Math.floor(probe * available / widest);
    WHEEL_LABELS.forEach(function (label) {
      label.text.setAttribute("font-size", size);
    });
    labelsFitted = true;
  }

  /* Radstellung anwenden: Segmente drehen, Beschriftung mitführen. */
  function applyRotation() {
    rotor.setAttribute("transform", "rotate(" + rotation.toFixed(2) + " 400 400)");
    WHEEL_LABELS.forEach(function (label) {
      var angle = (label.mid + rotation) * Math.PI / 180;
      var x = 400 + LABEL_RADIUS * Math.sin(angle);
      var y = 400 - LABEL_RADIUS * Math.cos(angle);
      label.element.setAttribute("transform",
        "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")");
    });
  }

  function buildBulbs() {
    var count = 24;
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2;
      var c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", (400 + 376 * Math.sin(angle)).toFixed(1));
      c.setAttribute("cy", (400 - 376 * Math.cos(angle)).toFixed(1));
      c.setAttribute("r", "12");
      c.setAttribute("class", i % 2 === 0 ? "bulb bulb--on" : "bulb");
      bulbGroup.appendChild(c);
    }
  }

  function chaseBulbs(on) {
    var bulbs = bulbGroup.childNodes;
    if (bulbTimer) { window.clearInterval(bulbTimer); bulbTimer = null; }
    if (!on || prefersReducedMotion()) {
      for (var i = 0; i < bulbs.length; i++) {
        bulbs[i].setAttribute("class", i % 2 === 0 ? "bulb bulb--on" : "bulb");
      }
      return;
    }
    var step = 0;
    bulbTimer = window.setInterval(function () {
      step++;
      for (var i = 0; i < bulbs.length; i++) {
        bulbs[i].setAttribute("class", (i + step) % 3 === 0 ? "bulb bulb--on" : "bulb");
      }
    }, 110);
  }

  function setResult(text, category) {
    resultText.textContent = text;
    resultText.className = "wheel-result" +
      (category ? " wheel-result--" + CATEGORY_KEY[category] : "");
  }

  function now() {
    return (window.performance && window.performance.now)
      ? window.performance.now() : Date.now();
  }

  /* Drehung Bild für Bild: schnell anlaufen, langsam auslaufen. */
  function animateRotation(target, duration, onDone) {
    var from = rotation;
    var distance = target - from;
    var startTime = now();

    if (spinFrame) window.cancelAnimationFrame(spinFrame);

    function frame() {
      var progress = Math.min(1, (now() - startTime) / (duration * 1000));
      var eased = 1 - Math.pow(1 - progress, 3.2);
      rotation = from + distance * eased;
      applyRotation();
      if (progress < 1) {
        spinFrame = window.requestAnimationFrame(frame);
      } else {
        spinFrame = null;
        rotation = target;
        applyRotation();
        onDone();
      }
    }

    spinFrame = window.requestAnimationFrame(frame);
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    btnSpin.disabled = true;
    setResult("Das Rad dreht sich …", null);

    var reduce = prefersReducedMotion();
    var duration = reduce ? 0.01 : 2.4 + Math.random() * 1.4;   /* 2,4–3,8 s */
    var turns = reduce ? 0 : 3 + Math.floor(Math.random() * 2);

    /* Zufälliger Landepunkt, mit Abstand zu den Segmenträndern */
    var segIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    var angleInWheel = segIndex * 120 + 12 + Math.random() * 96;

    var targetMod = (360 - angleInWheel) % 360;
    var currentMod = ((rotation % 360) + 360) % 360;
    var delta = (targetMod - currentMod + 360) % 360;
    var target = rotation + turns * 360 + delta;

    chaseBulbs(true);
    sound.spin(duration);

    animateRotation(target, duration, function () {
      spinning = false;
      btnSpin.disabled = false;
      chaseBulbs(false);
      sound.stopSpin();
      var category = WHEEL_SEGMENTS[segIndex];
      setResult(labelOf(category), category);
      window.setTimeout(function () {
        if (currentScreen === "wheel") openCategory(category);
      }, reduce ? 100 : 900);
    });
  }

  function goToWheel() {
    setResult("Drehe das Rad.", null);
    updateSessionInfo();
    showScreen("wheel", btnSpin);
    fitLabels();   /* erst messen, wenn das Rad sichtbar ist */
  }

  /* ================================================================== */
  /* 6. Frage und Lösung                                                */
  /* ================================================================== */

  var currentQuestion = null;

  function openCategory(category) {
    var question = drawQuestion(category);
    if (!question) {
      showEmpty(category);
      return;
    }
    showQuestion(question);
  }

  function showQuestion(question) {
    currentQuestion = question;
    markUsed(question);

    state.session.played++;
    state.session.byCategory[question.category]++;
    saveSession();

    var key = CATEGORY_KEY[question.category];
    var chip = $("q-category");
    chip.textContent = labelOf(question.category);
    chip.className = "chip chip--" + key;

    $("q-counter").textContent = "Frage " + state.session.played;
    $("q-text").textContent = question.question;
    $("q-open-hint").hidden = (question.type !== "open");

    showScreen("question", $("btn-answer"));
  }

  function showAnswer() {
    if (!currentQuestion) { goToWheel(); return; }
    var q = currentQuestion;
    var key = CATEGORY_KEY[q.category];

    var chip = $("a-category");
    chip.textContent = labelOf(q.category);
    chip.className = "chip chip--" + key;

    $("a-counter").textContent = "Frage " + state.session.played;
    $("a-question").textContent = q.question;
    $("a-text").textContent = q.answer;
    $("a-fun").hidden = (q.type !== "fun");
    $("a-open-hint").hidden = (q.type !== "open");

    sound.reveal();
    showScreen("answer", $("btn-next-round"));
  }

  function skipQuestion() {
    if (!currentQuestion) { goToWheel(); return; }
    var category = currentQuestion.category;
    var next = drawQuestion(category);
    if (!next) {
      showEmpty(category);
      return;
    }
    showQuestion(next);
  }

  function showEmpty(category) {
    var open = countOpen(category);
    if (open > 0) {
      /* Sicherheitsnetz: doch noch Fragen vorhanden */
      openCategory(category);
      return;
    }
    $("empty-text").textContent =
      "Alle " + countTotal(category) + " Fragen aus " + labelOf(category) +
      " wurden bereits gespielt.";
    $("btn-reset-category").textContent = labelOf(category) + " zurücksetzen";
    $("btn-reset-category").dataset.category = category;
    showScreen("empty", $("btn-other-category"));
  }

  /* ================================================================== */
  /* 7. Lehrkraft-Menü und Zurücksetzen                                 */
  /* ================================================================== */

  function updateSessionInfo() {
    var info = "Heute gespielt: " + state.session.played +
               (state.session.played === 1 ? " Frage" : " Fragen");
    $("session-info-wheel").textContent = info;
  }

  function renderTeacher() {
    var list = $("stand-list");
    list.innerHTML = "";

    CATEGORIES.forEach(function (cat) {
      list.appendChild(standRow(labelOf(cat), countOpen(cat) + " von " + countTotal(cat) + " noch offen", false));
      if (cat === "Allgemeinwissen") {
        GK_SUBCATEGORIES.forEach(function (sub) {
          list.appendChild(standRow(sub, countOpen("Allgemeinwissen", sub) + " offen", true));
        });
      }
    });

    var s = state.session;
    $("session-detail").innerHTML =
      "Heute gespielt: <strong>" + s.played + "</strong><br>" +
      "Mathe: " + s.byCategory["Mathematik"] + "<br>" +
      "Deutsch: " + s.byCategory["Deutsch"] + "<br>" +
      "Sachkunde: " + s.byCategory["Allgemeinwissen"];

    $("opt-sound").checked = state.settings.sound;
  }

  function standRow(name, value, isSub) {
    var row = document.createElement("div");
    row.className = "stand__row" + (isSub ? " stand__row--sub" : "");
    var left = document.createElement("span");
    left.className = "stand__name";
    left.textContent = name;
    var right = document.createElement("span");
    right.textContent = value;
    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  function openTeacher(from) {
    teacherReturnScreen = from;
    renderTeacher();
    showScreen("teacher", $("btn-close-teacher"));
  }

  function closeTeacher() {
    if (teacherReturnScreen === "start") {
      showScreen("start", $("btn-start"));
    } else {
      goToWheel();
    }
  }

  /* Sicherheitsabfrage */
  var confirmAction = null;

  function askConfirm(text, action) {
    $("confirm-text").textContent = text;
    confirmAction = action;
    $("confirm").hidden = false;
    window.setTimeout(function () { $("btn-confirm-cancel").focus(); }, 30);
  }

  function closeConfirm() {
    $("confirm").hidden = true;
    confirmAction = null;
  }

  function resetCategory(category) {
    state.used = state.used.filter(function (id) {
      var q = QUESTIONS.filter(function (item) { return item.id === id; })[0];
      return q ? q.category !== category : false;
    });
    saveUsed();
    if (category === "Allgemeinwissen") {
      state.rotation = [];
      saveRotation();
    }
  }

  function resetAll() {
    state.used = [];
    state.rotation = [];
    saveUsed();
    saveRotation();
  }

  function newSession() {
    state.session = defaultSession();
    saveSession();
  }

  /* ================================================================== */
  /* 8. Ton                                                             */
  /* ================================================================== */

  /* Alle Geräusche werden im Browser erzeugt. Es sind keine Audiodateien
     nötig, damit die Dateistruktur klein bleibt und die App offline läuft. */
  var sound = (function () {
    var ctx = null;
    var tickTimer = null;

    function context() {
      if (!state.settings.sound) return null;
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
      }
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      return ctx;
    }

    function tone(freq, duration, type, volume) {
      var c = context();
      if (!c) return;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume || 0.05, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duration);
    }

    return {
      spin: function (duration) {
        if (!state.settings.sound) return;
        var elapsed = 0;
        var interval = 90;
        if (tickTimer) window.clearInterval(tickTimer);
        tickTimer = window.setInterval(function () {
          elapsed += interval;
          if (elapsed > duration * 1000) {
            window.clearInterval(tickTimer);
            tickTimer = null;
            return;
          }
          tone(760, 0.04, "square", 0.02);
        }, interval);
      },
      stopSpin: function () {
        if (tickTimer) { window.clearInterval(tickTimer); tickTimer = null; }
        tone(520, 0.18, "triangle", 0.05);
      },
      reveal: function () {
        tone(660, 0.14, "sine", 0.05);
        window.setTimeout(function () { tone(880, 0.22, "sine", 0.05); }, 130);
      }
    };
  })();

  /* ================================================================== */
  /* 9. Start                                                           */
  /* ================================================================== */

  function bindEvents() {
    /* Start */
    $("btn-start").addEventListener("click", goToWheel);
    $("btn-open-teacher-start").addEventListener("click", function () { openTeacher("start"); });

    /* Rad */
    btnSpin.addEventListener("click", spin);
    $("wheel").addEventListener("click", function () { if (!spinning) spin(); });
    $("btn-open-teacher-wheel").addEventListener("click", function () { openTeacher("wheel"); });

    /* Frage */
    $("btn-answer").addEventListener("click", showAnswer);
    $("btn-skip").addEventListener("click", skipQuestion);
    $("btn-back-to-wheel-q").addEventListener("click", goToWheel);

    /* Lösung */
    $("btn-next-round").addEventListener("click", goToWheel);
    $("btn-back-to-wheel-a").addEventListener("click", goToWheel);
    $("btn-back-to-question").addEventListener("click", function () {
      if (currentQuestion) showScreen("question", $("btn-answer"));
      else goToWheel();
    });

    /* Leerer Fragenpool */
    $("btn-other-category").addEventListener("click", goToWheel);
    $("btn-reset-category").addEventListener("click", function () {
      var category = $("btn-reset-category").dataset.category;
      askConfirm("Wirklich alle Fragen aus " + labelOf(category) + " wieder freigeben?", function () {
        resetCategory(category);
        goToWheel();
      });
    });

    /* Lehrkraft-Menü */
    $("btn-close-teacher").addEventListener("click", closeTeacher);
    $("btn-new-session").addEventListener("click", function () {
      newSession();
      renderTeacher();
    });
    $("opt-sound").addEventListener("change", function () {
      state.settings.sound = $("opt-sound").checked;
      saveSettings();
    });

    var resetButtons = document.querySelectorAll("[data-reset]");
    Array.prototype.forEach.call(resetButtons, function (button) {
      button.addEventListener("click", function () {
        var category = button.dataset.reset;
        askConfirm("Wirklich alle Fragen aus " + labelOf(category) + " wieder freigeben?", function () {
          resetCategory(category);
          renderTeacher();
        });
      });
    });

    $("btn-reset-all").addEventListener("click", function () {
      askConfirm("Wirklich alle bisher verwendeten Fragen wieder freigeben?", function () {
        resetAll();
        renderTeacher();
      });
    });

    /* Sicherheitsabfrage */
    $("btn-confirm-cancel").addEventListener("click", closeConfirm);
    $("btn-confirm-ok").addEventListener("click", function () {
      var action = confirmAction;
      closeConfirm();
      if (action) action();
    });

    /* Tastatur: Escape schließt die Sicherheitsabfrage */
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !$("confirm").hidden) closeConfirm();
    });
  }

  function init() {
    loadState();
    buildBulbs();
    buildLabels();
    applyRotation();
    chaseBulbs(false);
    bindEvents();
    updateSessionInfo();
    showScreen("start");
  }

  init();
})();
