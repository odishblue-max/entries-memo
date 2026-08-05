(function () {
  "use strict";

  var STORAGE_KEY = "pokerEntryMemo.state.v1";

  var state = loadState();

  function defaultStatus() {
    return { seatOpen: "white", waiting: "white", waitingSince: null };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { participants: [] };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.participants)) {
        return { participants: [] };
      }
      parsed.participants.forEach(function (p) {
        if (!p.status) p.status = defaultStatus();
      });
      return parsed;
    } catch (e) {
      return { participants: [] };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function findParticipant(id) {
    for (var i = 0; i < state.participants.length; i++) {
      if (state.participants[i].id === id) return state.participants[i];
    }
    return null;
  }

  function nameExists(name) {
    return state.participants.some(function (p) {
      return p.name === name;
    });
  }

  function addParticipant(name) {
    var trimmed = (name || "").trim();
    if (!trimmed || nameExists(trimmed)) return false;
    state.participants.push({
      id: uid(),
      name: trimmed,
      chip: [],
      kaikei: [],
      status: defaultStatus()
    });
    saveState();
    return true;
  }

  function importParticipants(text) {
    var lines = (text || "").split(/\r?\n/);
    var added = 0;
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      if (addParticipant(trimmed)) added++;
    });
    return added;
  }

  function removeParticipant(id) {
    state.participants = state.participants.filter(function (p) {
      return p.id !== id;
    });
    saveState();
  }

  function addEntry(id, category) {
    var p = findParticipant(id);
    if (!p) return;
    p[category].push({ reflected: false });
    if (p.status.seatOpen === "blue") {
      p.status.seatOpen = "white";
    }
    if (p.status.waiting === "green") {
      p.status.waiting = "white";
      p.status.waitingSince = null;
    }
    saveState();
  }

  function cycleSeatOpen(id) {
    var p = findParticipant(id);
    if (!p) return;
    var order = ["white", "red", "blue"];
    var next = order[(order.indexOf(p.status.seatOpen) + 1) % order.length];
    p.status.seatOpen = next;
    saveState();
  }

  function toggleWaiting(id) {
    var p = findParticipant(id);
    if (!p) return;
    if (p.status.waiting === "green") {
      p.status.waiting = "white";
      p.status.waitingSince = null;
    } else {
      p.status.waiting = "green";
      p.status.waitingSince = Date.now();
    }
    saveState();
  }

  function playingColor(p) {
    var hasEntries = p.chip.length + p.kaikei.length > 0;
    if (!hasEntries) return "white";
    if (p.status.seatOpen !== "white") return "white";
    return "green";
  }

  function undoEntry(id, category) {
    var p = findParticipant(id);
    if (!p || p[category].length === 0) return;
    p[category].pop();
    saveState();
  }

  function toggleChip(id, category, index) {
    var p = findParticipant(id);
    if (!p) return;
    var stroke = p[category][index];
    if (!stroke) return;
    stroke.reflected = !stroke.reflected;
    saveState();
  }

  function resetAll() {
    state.participants = [];
    saveState();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c];
    });
  }

  function chipsHtml(p, category, strokes) {
    if (strokes.length === 0) return "";
    return strokes.map(function (s, i) {
      var cls = s.reflected ? "tally-chip blue" : "tally-chip red";
      return '<span class="' + cls + '" data-action="toggle-chip" data-id="' +
        p.id + '" data-category="' + category + '" data-index="' + i +
        '">✓' + (i + 1) + "</span>";
    }).join("");
  }

  function counterRowHtml(p, category, label) {
    var strokes = p[category];
    var undoDisabled = strokes.length === 0 ? "disabled" : "";
    return (
      '<div class="counter-row">' +
        '<div class="counter-label">' + label + "</div>" +
        '<div class="tally-display">' +
          chipsHtml(p, category, strokes) +
        "</div>" +
        '<div class="counter-count">' + strokes.length + "</div>" +
        '<div class="counter-buttons">' +
          '<button type="button" class="btn-add" data-action="add-entry" data-id="' +
            p.id + '" data-category="' + category + '">＋</button>' +
          '<button type="button" class="btn-undo" ' + undoDisabled +
            ' data-action="undo-entry" data-id="' + p.id +
            '" data-category="' + category + '">戻</button>' +
        "</div>" +
      "</div>"
    );
  }

  function statusButtonsHtml(p) {
    return (
      '<div class="status-buttons">' +
        '<button type="button" class="status-btn seatopen-' + p.status.seatOpen +
          '" data-action="cycle-seatopen" data-id="' + p.id + '" title="シートオープン">開</button>' +
        '<span class="status-btn playing-' + playingColor(p) + '" title="プレイ中（自動表示）">中</span>' +
        '<button type="button" class="status-btn waiting-' + p.status.waiting +
          '" data-action="toggle-waiting" data-id="' + p.id + '" title="ウェイティング">待</button>' +
      "</div>"
    );
  }

  function participantCardHtml(p) {
    return (
      '<div class="participant-card" data-participant-id="' + p.id + '">' +
        '<div class="participant-header">' +
          '<span class="participant-name">' + escapeHtml(p.name) + "</span>" +
          statusButtonsHtml(p) +
          '<button type="button" class="remove-btn" data-action="remove-participant" data-id="' +
            p.id + '" aria-label="削除">×</button>' +
        "</div>" +
        counterRowHtml(p, "chip", "チップ精算") +
        counterRowHtml(p, "kaikei", "会計精算") +
      "</div>"
    );
  }

  function waitingListHtml() {
    var waitingParticipants = state.participants
      .filter(function (p) { return p.status.waiting === "green"; })
      .sort(function (a, b) {
        return (a.status.waitingSince || 0) - (b.status.waitingSince || 0);
      });
    if (waitingParticipants.length === 0) {
      return '<li class="waiting-empty">なし</li>';
    }
    return waitingParticipants.map(function (p) {
      return "<li>" + escapeHtml(p.name) + "</li>";
    }).join("");
  }

  function render() {
    var listEl = document.getElementById("participant-list");
    var emptyEl = document.getElementById("empty-message");
    document.getElementById("waiting-list").innerHTML = waitingListHtml();
    if (state.participants.length === 0) {
      listEl.innerHTML = "";
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;
    listEl.innerHTML = state.participants.map(participantCardHtml).join("");
  }

  function init() {
    render();

    document.getElementById("add-name-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("new-name-input");
      if (addParticipant(input.value)) {
        input.value = "";
        render();
      }
      input.focus();
    });

    document.getElementById("import-btn").addEventListener("click", function () {
      var textarea = document.getElementById("import-textarea");
      var added = importParticipants(textarea.value);
      if (added > 0) {
        textarea.value = "";
        render();
      }
    });

    document.getElementById("reset-all-btn").addEventListener("click", function () {
      if (state.participants.length === 0) return;
      if (window.confirm("全参加者のデータを削除します。よろしいですか？")) {
        resetAll();
        render();
      }
    });

    document.getElementById("participant-list").addEventListener("click", function (e) {
      var target = e.target.closest("[data-action]");
      if (!target || target.disabled) return;
      var action = target.dataset.action;
      var id = target.dataset.id;
      var category = target.dataset.category;

      if (action === "add-entry") {
        addEntry(id, category);
        render();
      } else if (action === "undo-entry") {
        undoEntry(id, category);
        render();
      } else if (action === "toggle-chip") {
        var index = parseInt(target.dataset.index, 10);
        toggleChip(id, category, index);
        render();
      } else if (action === "cycle-seatopen") {
        cycleSeatOpen(id);
        render();
      } else if (action === "toggle-waiting") {
        toggleWaiting(id);
        render();
      } else if (action === "remove-participant") {
        var p = findParticipant(id);
        var name = p ? p.name : "";
        if (window.confirm(name + " を削除しますか？")) {
          removeParticipant(id);
          render();
        }
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
