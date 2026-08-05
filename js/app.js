(function () {
  "use strict";

  var STORAGE_KEY = "pokerEntryMemo.state.v1";

  var state = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { participants: [] };
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.participants)) {
        return { participants: [] };
      }
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
      kaikei: []
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
    saveState();
  }

  function undoEntry(id, category) {
    var p = findParticipant(id);
    if (!p || p[category].length === 0) return;
    p[category].pop();
    saveState();
  }

  // Reflects the oldest not-yet-reflected stroke. Returns true if a
  // stroke changed state, false if nothing was pending.
  function toggleReflect(id, category) {
    var p = findParticipant(id);
    if (!p) return false;
    for (var i = 0; i < p[category].length; i++) {
      if (!p[category][i].reflected) {
        p[category][i].reflected = true;
        saveState();
        return true;
      }
    }
    return false;
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

  function chipsHtml(strokes) {
    if (strokes.length === 0) return "";
    return strokes.map(function (s, i) {
      var cls = s.reflected ? "tally-chip blue" : "tally-chip red";
      return '<span class="' + cls + '">✓' + (i + 1) + "</span>";
    }).join("");
  }

  function counterRowHtml(p, category, label) {
    var strokes = p[category];
    var undoDisabled = strokes.length === 0 ? "disabled" : "";
    return (
      '<div class="counter-row">' +
        '<div class="counter-label">' + label + "</div>" +
        '<div class="tally-display" data-action="toggle-reflect" data-id="' +
          p.id + '" data-category="' + category + '">' +
          chipsHtml(strokes) +
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

  function participantCardHtml(p) {
    return (
      '<div class="participant-card" data-participant-id="' + p.id + '">' +
        '<div class="participant-header">' +
          '<span class="participant-name">' + escapeHtml(p.name) + "</span>" +
          '<button type="button" class="remove-btn" data-action="remove-participant" data-id="' +
            p.id + '" aria-label="削除">×</button>' +
        "</div>" +
        counterRowHtml(p, "chip", "チップ精算") +
        counterRowHtml(p, "kaikei", "会計精算") +
      "</div>"
    );
  }

  function render() {
    var listEl = document.getElementById("participant-list");
    var emptyEl = document.getElementById("empty-message");
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
      } else if (action === "toggle-reflect") {
        var changed = toggleReflect(id, category);
        if (changed) {
          render();
        } else {
          target.classList.remove("shake");
          void target.offsetWidth;
          target.classList.add("shake");
        }
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
