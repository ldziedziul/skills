
  // One-click decisions on every card (labels from CONFIG.decisions). Either
  // decision collapses the card in place so the header alone tells the
  // story: an agreed card keeps its status pill, gains an "agreed" chip and
  // a green edge, and stays visible on every load (it is still to be acted
  // on); a dropped card dims, is struck through with a "dropped" chip, and
  // offers Undo in a toast; from the next page load on it hides until the
  // viewbar's "Show dropped" is on. Pill classes in CONFIG.droppedSt (already
  // published as dropped) hide the same way.
  var DECISIONS = CONFIG.decisions;
  var DROPPED_ST = CONFIG.droppedSt;
  var reapply = function () {};
  var hasDroppedPill = function (card) {
    return Array.prototype.some.call(card.querySelectorAll(".item-head .st"), function (el) {
      return DROPPED_ST.some(function (c) { return el.classList.contains(c); });
    });
  };

  // after a decision, move on to the next card still open and shown (filters
  // and hidden sections skipped); nothing open below means stay put
  var shownOnPage = function (el) {
    for (; el && el !== document.body; el = el.parentElement) {
      if (el.hidden || window.getComputedStyle(el).display === "none") return false;
    }
    return true;
  };
  var scrollToNextOpen = function (card) {
    var all = Array.prototype.slice.call(document.querySelectorAll("article.item"));
    var next = all.slice(all.indexOf(card) + 1).filter(function (c) {
      return !c.classList.contains("collapsed") && shownOnPage(c);
    })[0];
    if (!next) return;
    var reduce = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    next.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  // one toast at a time, above the action bar; Undo reverses the last drop
  var toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.hidden = true;
  var toastText = document.createElement("span");
  var toastUndo = document.createElement("button");
  toastUndo.type = "button";
  toastUndo.textContent = "Undo";
  toast.appendChild(toastText);
  toast.appendChild(toastUndo);
  document.body.appendChild(toast);
  var toastTimer = null;
  var toastAction = null;
  toastUndo.addEventListener("click", function () {
    if (toastAction) toastAction();
    toast.hidden = true;
  });
  var announce = function (text, undo) {
    toastText.textContent = text;
    toastAction = undo;
    toastUndo.hidden = !undo;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 7000);
  };

  var entries = [];
  var slug = function (s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  };

  // per-card comment boxes, persisted per browser
  document.querySelectorAll("article.item").forEach(function (card) {
    var title = card.querySelector("h3").textContent.replace(/\s+/g, " ").trim();
    var section = card.closest("section").querySelector("h2").firstChild.textContent.trim();
    var linkEl = card.querySelector(".who a");
    var link = linkEl ? linkEl.href : "";
    var key = KEY_PREFIX + "note-" + slug(title);

    var wrap = document.createElement("div");
    wrap.className = "note";
    var label = document.createElement("label");
    label.textContent = CONFIG.noteLabel;
    var mark = document.createElement("span");
    mark.className = "sentmark";
    label.appendChild(mark);
    var id = "note-" + slug(title);
    label.setAttribute("for", id);
    var ta = document.createElement("textarea");
    ta.id = id;
    ta.placeholder = CONFIG.notePlaceholder;
    try { ta.value = localStorage.getItem(key) || ""; } catch (e) {}

    var decKey = KEY_PREFIX + "decision-" + slug(title);
    var decision = "";
    try { decision = localStorage.getItem(decKey) || ""; } catch (e) {}
    var decide = document.createElement("div");
    decide.className = "decide";
    var decBtns = [];
    // the decision chips live in the header so a collapsed card still says
    // so; a card published with a dropped pill already carries one
    var head = card.querySelector(".item-head");
    var addChip = function (cls, text) {
      var chip = document.createElement("span");
      chip.className = "st " + cls;
      chip.textContent = text;
      var firstSt = head.querySelector(".st");
      head.insertBefore(chip, firstSt ? firstSt.nextSibling : head.querySelector(".tag"));
    };
    addChip("agreechip", "agreed");
    if (!hasDroppedPill(card)) addChip("dropchip", "dropped");
    // says this card is in the set the next "Copy new" will send; it lives in
    // the header so a collapsed card shows it too
    addChip("copychip", "to copy");
    var paint = function () {
      decBtns.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-decision") === decision));
      });
      card.__decision = decision;
      card.classList.toggle("decided", !!decision || !!ta.value.trim());
      card.classList.toggle("agreed", decision === "agree");
      card.classList.toggle("dropped", decision === "drop" || hasDroppedPill(card));
    };
    var setDecision = function (v) {
      decision = v;
      try { if (decision) localStorage.setItem(decKey, decision); else localStorage.removeItem(decKey); } catch (e) {}
      paint();
    };
    DECISIONS.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-decision", d.key);
      b.textContent = d.label;
      b.addEventListener("click", function () {
        var was = decision;
        setDecision(decision === d.key ? "" : d.key);
        if (decision === "agree") {
          // decided: the header (pill + agreed chip) says it all now
          if (card.__setOpen) card.__setOpen(false, true);
        } else if (!decision && card.__setOpen) {
          // decision taken back - open the card for another look
          card.__setOpen(true, true);
        }
        if (decision === "drop") {
          // stays visible for this page view, so the change is seen where it happened
          card.__stayVisible = true;
          if (card.__setOpen) card.__setOpen(false, true);
          announce("Dropped: " + title, function () {
            setDecision(was);
            if (card.__setOpen) card.__setOpen(true, true);
            refresh();
            reapply();
          });
        }
        refresh();
        reapply();
        if (decision) scrollToNextOpen(card);
      });
      decide.appendChild(b);
      decBtns.push(b);
    });
    paint();

    ta.addEventListener("input", function () {
      try {
        if (ta.value.trim()) localStorage.setItem(key, ta.value);
        else localStorage.removeItem(key);
      } catch (e) {}
      paint();
      refresh();
    });
    wrap.appendChild(label);
    wrap.appendChild(decide);
    wrap.appendChild(ta);
    card.appendChild(wrap);
    var entry = { title: title, section: section, link: link, ta: ta, card: card,
      sentKey: KEY_PREFIX + "sent-" + slug(title), mark: mark,
      decision: function () { return decision; }, setDecision: setDecision };
    card.__entry = entry;
    entries.push(entry);
  });

  // Each paste-ready block is editable in place: the drafted text sits in a
  // textarea, so the wording that goes on GitHub is the user's. Edits are
  // saved per browser under the card's title, Copy copies what is in the
  // box, Revert restores Claude's text and clears the saved edit. An edit
  // counts as a change everywhere a decision or a note does. The saved edit
  // remembers the draft it was written against: when a re-run rewrites that
  // draft, the new one wins and the old edit is offered read-only.
  var draftText = function (card) { return card.__draft ? card.__draft.text() : ""; };
  var draftEdited = function (card) { return !!(card.__draft && card.__draft.edited()); };

  document.querySelectorAll(".snippet.draft").forEach(function (s) {
    var card = s.closest("article.item");
    var title = card ? card.querySelector("h3").textContent.replace(/\s+/g, " ").trim() : "";
    var key = KEY_PREFIX + "draft-" + slug(title);
    var head = s.querySelector(".snippet-head");
    var pre = s.querySelector("pre");
    var original = pre.textContent.replace(/\s+$/, "");

    var ta = document.createElement("textarea");
    ta.className = "draftbox";
    ta.setAttribute("aria-label", CONFIG.draftLabel + (title ? ": " + title : ""));
    ta.value = original;
    var stale = null;
    try {
      var saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && typeof saved.text === "string") {
        if (saved.base === original) ta.value = saved.text;
        else stale = saved.text;
      }
    } catch (e) {}
    // rows keep the box about right before layout; autosize refines it
    ta.rows = Math.max(2, ta.value.split("\n").length);
    pre.parentNode.replaceChild(ta, pre);
    // rows drop to 1 while measuring so the box shrinks as well as grows;
    // without layout (scrollHeight 0) the row count stays as the fallback
    var autosize = function () {
      var rows = ta.rows;
      ta.rows = 1;
      ta.style.height = "auto";
      if (ta.scrollHeight) ta.style.height = (ta.scrollHeight + 2) + "px";
      else ta.rows = rows;
    };

    var tools = document.createElement("span");
    tools.className = "snippet-tools";
    var mark = document.createElement("span");
    mark.className = "editmark";
    mark.textContent = "edited";
    mark.hidden = true;
    var revert = document.createElement("button");
    revert.type = "button";
    revert.className = "revertdraft";
    revert.textContent = "Revert";
    revert.hidden = true;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copydraft";
    btn.textContent = "Copy";
    tools.appendChild(mark);
    tools.appendChild(revert);
    tools.appendChild(btn);
    head.appendChild(tools);

    var text = function () { return ta.value.replace(/\s+$/, ""); };
    var edited = function () { return text() !== original; };
    var paintDraft = function () {
      var on = edited();
      s.classList.toggle("edited", on);
      mark.hidden = !on;
      revert.hidden = !on;
      if (card) card.classList.toggle("editeddraft", on);
    };
    var save = function () {
      try {
        if (edited()) localStorage.setItem(key, JSON.stringify({ base: original, text: ta.value }));
        else localStorage.removeItem(key);
      } catch (e) {}
    };
    // filters run on focusout, not on every keystroke, so a card cannot
    // vanish from under the cursor mid-edit
    ta.addEventListener("input", function () {
      autosize();
      save();
      paintDraft();
      refresh();
    });
    revert.addEventListener("click", function () {
      ta.value = original;
      autosize();
      save();
      paintDraft();
      refresh();
      reapply();
    });
    btn.addEventListener("click", function () {
      var done = function () {
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 2000);
      };
      var manual = function () {
        ta.focus();
        ta.select();
        btn.textContent = "Select + copy manually";
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text()).then(done, manual);
      } else {
        manual();
      }
    });

    if (stale !== null) {
      var noticeText = document.createElement("span");
      noticeText.textContent = "Your earlier edit was written against an older draft.";
      var show = document.createElement("button");
      show.type = "button";
      show.textContent = "Show it";
      var old = document.createElement("pre");
      old.className = "staletext";
      old.textContent = stale;
      old.hidden = true;
      show.addEventListener("click", function () {
        old.hidden = !old.hidden;
        show.textContent = old.hidden ? "Show it" : "Hide it";
      });
      var notice = document.createElement("div");
      notice.className = "staleedit";
      notice.appendChild(noticeText);
      notice.appendChild(show);
      s.appendChild(notice);
      s.appendChild(old);
    }

    paintDraft();
    autosize();
    if (card) {
      card.__draft = { text: text, edited: edited, reset: function () {
        ta.value = original;
        save();
        paintDraft();
      } };
      card.__autosize = autosize;
    }
  });

  // collapsible cards: action-needed expanded by default, memory wins
  var cards = [];
  document.querySelectorAll("article.item").forEach(function (card) {
    var head = card.querySelector(".item-head");
    var title = card.querySelector("h3").textContent.replace(/\s+/g, " ").trim();
    var openKey = KEY_PREFIX + "open-" + slug(title);

    var body = document.createElement("div");
    body.className = "item-body";
    var sib = head.nextSibling;
    while (sib) { var next = sib.nextSibling; body.appendChild(sib); sib = next; }
    card.appendChild(body);

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "toggle";
    toggle.setAttribute("aria-label", "Toggle: " + title);
    head.insertBefore(toggle, head.firstChild);

    var setOpen = function (open, remember) {
      card.classList.toggle("collapsed", !open);
      toggle.setAttribute("aria-expanded", String(open));
      if (open && card.__autosize) card.__autosize();
      if (remember) {
        try { localStorage.setItem(openKey, open ? "1" : "0"); } catch (e) {}
      }
    };
    var defaultOpen = !!card.querySelector(CONFIG.actionPill);
    var stored = null;
    try { stored = localStorage.getItem(openKey); } catch (e) {}
    setOpen(stored === null ? defaultOpen : stored === "1", false);

    head.addEventListener("click", function (ev) {
      if (ev.target.closest("a, textarea, label")) return;
      setOpen(card.classList.contains("collapsed"), true);
    });
    card.__setOpen = setOpen;
    cards.push(setOpen);
  });

  document.getElementById("expand-all").addEventListener("click", function () {
    cards.forEach(function (setOpen) { setOpen(true, true); });
  });
  document.getElementById("collapse-all").addEventListener("click", function () {
    cards.forEach(function (setOpen) { setOpen(false, true); });
  });

  // ---- filters ------------------------------------------------------------
  // Three filters compose: status (the tally tiles; "Action needed only" is a
  // preset of them), labels (chips from each card's tags; pinned ones stay in
  // the viewbar, the rest sit under "More filters" grouped by tag kind; a
  // chip carries its tag's other classes so a theme can style each value), and
  // words (all terms must appear on the card, "quoted" terms as a phrase),
  // plus "Without my comment" (cards whose note box is still empty).
  // A card shows only if it passes all of them; a section hides when none of
  // its cards show. Status, label and no-comment picks persist per browser.
  var ACTION_ST = CONFIG.actionSt;
  var GROUPS = CONFIG.groups;
  var allCards = Array.prototype.slice.call(document.querySelectorAll("article.item"));
  var labelOf = function (el) { return el.textContent.replace(/\s+/g, " ").trim(); };
  var norm = function (s) { return s.replace(/\s+/g, " ").trim().toLowerCase(); };
  var toggleIn = function (arr, v) { var i = arr.indexOf(v); if (i === -1) arr.push(v); else arr.splice(i, 1); };
  var sameSet = function (a, b) {
    return a.length === b.length && a.every(function (v) { return b.indexOf(v) !== -1; });
  };
  var stClasses = function (card) {
    var out = [];
    card.querySelectorAll(".item-head .st").forEach(function (el) {
      el.classList.forEach(function (c) { if (c !== "st" && c !== "act" && out.indexOf(c) === -1) out.push(c); });
    });
    return out;
  };
  var cardTags = function (card) { return Array.prototype.slice.call(card.querySelectorAll(CONFIG.labelSources)); };
  var isDropped = function (card) {
    return card.__decision === "drop" || stClasses(card).some(function (c) { return DROPPED_ST.indexOf(c) !== -1; });
  };
  var decided = function (card) { return !!card.__decision || !!noteText(card).trim() || draftEdited(card); };

  // status tiles
  var stKey = KEY_PREFIX + "filter-status";
  var tiles = [];
  var selectedSt = [];
  document.querySelectorAll(".tally li[data-st]").forEach(function (li) {
    var st = li.getAttribute("data-st");
    li.setAttribute("role", "button");
    li.tabIndex = 0;
    li.setAttribute("aria-pressed", "false");
    var flip = function () { toggleIn(selectedSt, st); applyFilters(); };
    li.addEventListener("click", flip);
    li.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); flip(); }
    });
    tiles.push({ st: st, li: li, text: labelOf(li.querySelector(".lbl") || li) });
  });
  var presentSt = tiles.map(function (t) { return t.st; });
  var presentAction = ACTION_ST.filter(function (st) { return presentSt.indexOf(st) !== -1; });
  try {
    var storedSt = localStorage.getItem(stKey);
    if (storedSt === null && localStorage.getItem(KEY_PREFIX + "filter-action") === "1") storedSt = JSON.stringify(presentAction);
    (JSON.parse(storedSt || "[]") || []).forEach(function (st) {
      if (presentSt.indexOf(st) !== -1 && selectedSt.indexOf(st) === -1) selectedSt.push(st);
    });
  } catch (e) {}
  var filterBtn = document.getElementById("filter-action");
  var actionOn = function () { return presentAction.length > 0 && sameSet(selectedSt, presentAction); };
  filterBtn.disabled = !presentAction.length;
  filterBtn.addEventListener("click", function () {
    selectedSt = actionOn() ? [] : presentAction.slice();
    applyFilters();
  });

  // label chips
  var labelKey = KEY_PREFIX + "filter-labels";
  var labels = {};
  var labelOrder = [];
  allCards.forEach(function (card) {
    cardTags(card).forEach(function (el) {
      var l = labelOf(el);
      if (!labels[l]) {
        var group = "other";
        var kinds = [];
        el.classList.forEach(function (c) {
          if (GROUPS[c]) group = c;
          else if (c !== "tag") kinds.push(c);
        });
        labels[l] = { text: l, group: group, kinds: kinds, count: 0 };
        labelOrder.push(l);
      }
      labels[l].count++;
    });
  });
  var selectedLabels = [];
  try {
    (JSON.parse(localStorage.getItem(labelKey) || "[]") || []).forEach(function (l) {
      if (labels[l] && selectedLabels.indexOf(l) === -1) selectedLabels.push(l);
    });
  } catch (e) {}
  var viewbar = document.querySelector(".viewbar");
  var pinned = (viewbar.getAttribute("data-pinned") || "").split(",").map(norm).filter(Boolean);
  var isPinned = function (l) { return pinned.indexOf(norm(l)) !== -1; };
  var chips = [];
  var makeChip = function (l) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = ["labelchip", labels[l].group].concat(labels[l].kinds).join(" ");
    btn.setAttribute("aria-pressed", "false");
    btn.appendChild(document.createTextNode(l));
    var n = document.createElement("span");
    n.className = "n";
    n.textContent = String(labels[l].count);
    btn.appendChild(n);
    btn.addEventListener("click", function () { toggleIn(selectedLabels, l); applyFilters(); });
    chips.push({ label: l, btn: btn, pinned: isPinned(l) });
    return btn;
  };
  var searchInput = document.getElementById("search-text");
  labelOrder.filter(isPinned).forEach(function (l) { viewbar.insertBefore(makeChip(l), searchInput); });
  var groupsBox = document.getElementById("label-groups");
  var more = document.getElementById("more-filters");
  var moreSummary = more.querySelector("summary");
  var byCount = function (a, b) { return labels[b].count - labels[a].count || a.localeCompare(b); };
  var groupKeys = Object.keys(GROUPS).concat(["other"]);
  groupKeys.forEach(function (g) {
    var ls = labelOrder.filter(function (l) { return labels[l].group === g && !isPinned(l); }).sort(byCount);
    if (!ls.length) return;
    var row = document.createElement("div");
    row.className = "labelgroup";
    var name = document.createElement("span");
    name.className = "gname";
    name.textContent = GROUPS[g] || "Other";
    row.appendChild(name);
    ls.forEach(function (l) { row.appendChild(makeChip(l)); });
    groupsBox.appendChild(row);
  });
  if (!groupsBox.children.length) more.hidden = true;

  // cards without a note yet; re-evaluated when a note box loses focus so a
  // card does not vanish mid-typing
  var noNoteKey = KEY_PREFIX + "filter-nonote";
  var noNoteBtn = document.getElementById("filter-nonote");
  var noNote = false;
  try { noNote = localStorage.getItem(noNoteKey) === "1"; } catch (e) {}
  noNoteBtn.addEventListener("click", function () { noNote = !noNote; applyFilters(); });
  var noteText = function (card) {
    var note = card.querySelector(".note textarea");
    return note ? note.value : "";
  };
  document.addEventListener("focusout", function (ev) {
    if (ev.target.closest(".note textarea, .snippet.draft textarea")) applyFilters();
  });

  // cards whose current state has not been copied back yet
  var pendingBtn = document.getElementById("filter-pending");
  var pendingOnly = false;
  pendingBtn.addEventListener("click", function () { pendingOnly = !pendingOnly; applyFilters(); });

  // dropped cards (a local "drop" decision, or a published dropped pill)
  // hide by default; this toggle shows them and persists per browser
  var showDroppedKey = KEY_PREFIX + "show-dropped";
  var showDroppedBtn = document.getElementById("show-dropped");
  var showDropped = false;
  try { showDropped = localStorage.getItem(showDroppedKey) === "1"; } catch (e) {}
  showDroppedBtn.addEventListener("click", function () { showDropped = !showDropped; applyFilters(); });

  // words
  var terms = function (q) {
    var out = [], re = /"([^"]*)"|(\S+)/g, m;
    while ((m = re.exec(q))) { var t = norm(m[1] != null ? m[1] : m[2]); if (t) out.push(t); }
    return out;
  };
  var textMatches = function (card, ts) {
    if (!ts.length) return true;
    var hay = norm(card.textContent + " " + noteText(card) + " " + draftText(card));
    return ts.every(function (t) { return hay.indexOf(t) !== -1; });
  };
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "/" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.target.closest("input, textarea, [contenteditable]")) return;
    ev.preventDefault();
    searchInput.focus();
  });

  var line = document.getElementById("filter-line");
  var applyFilters = function () {
    var ts = terms(searchInput.value);
    var shown = 0;
    var dropped = 0;
    allCards.forEach(function (card) {
      var okSt = !selectedSt.length || stClasses(card).some(function (c) { return selectedSt.indexOf(c) !== -1; });
      var okLabel = !selectedLabels.length || cardTags(card).some(function (el) { return selectedLabels.indexOf(labelOf(el)) !== -1; });
      var okNote = !noNote || !decided(card);
      var okPending = !pendingOnly || cardPending(card);
      var show = okSt && okLabel && okNote && okPending && textMatches(card, ts);
      var isDrop = isDropped(card);
      if (isDrop) dropped++;
      var okDrop = showDropped || !isDrop || !!card.__stayVisible;
      card.classList.toggle("filtered-out", !show);
      card.classList.toggle("dropped-hidden", !okDrop);
      if (show && okDrop) shown++;
    });
    document.querySelectorAll("section").forEach(function (sec) {
      sec.classList.toggle("filtered-out", !sec.querySelector("article.item:not(.filtered-out):not(.dropped-hidden)"));
    });
    paintPending();
    showDroppedBtn.hidden = !dropped;
    showDroppedBtn.textContent = (showDropped ? "Hide dropped (" : "Show dropped (") + dropped + ")";
    showDroppedBtn.setAttribute("aria-pressed", String(showDropped));
    tiles.forEach(function (t) { t.li.setAttribute("aria-pressed", String(selectedSt.indexOf(t.st) !== -1)); });
    filterBtn.setAttribute("aria-pressed", String(actionOn()));
    noNoteBtn.setAttribute("aria-pressed", String(noNote));
    var hiddenActive = 0;
    chips.forEach(function (c) {
      var on = selectedLabels.indexOf(c.label) !== -1;
      c.btn.setAttribute("aria-pressed", String(on));
      if (on && !c.pinned) hiddenActive++;
    });
    moreSummary.textContent = hiddenActive ? "More filters (" + hiddenActive + " on)" : "More filters";
    var active = actionOn() ? ["action needed"] : tiles.filter(function (t) { return selectedSt.indexOf(t.st) !== -1; }).map(function (t) { return t.text.toLowerCase(); });
    if (noNote) active.push("without my comment");
    if (pendingOnly) active.push("not copied yet");
    active = active.concat(selectedLabels, ts.map(function (t) { return "“" + t + "”"; }));
    if (active.length) {
      line.textContent = "Showing " + shown + " of " + allCards.length + " cards · " + active.join(", ") + " · ";
      var clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = "Clear filters";
      clear.addEventListener("click", function () {
        selectedSt = []; selectedLabels = []; noNote = false; pendingOnly = false; searchInput.value = "";
        applyFilters();
      });
      line.appendChild(clear);
    }
    line.hidden = !active.length;
    try {
      localStorage.setItem(stKey, JSON.stringify(selectedSt));
      localStorage.setItem(labelKey, JSON.stringify(selectedLabels));
      localStorage.setItem(noNoteKey, noNote ? "1" : "0");
      localStorage.setItem(showDroppedKey, showDropped ? "1" : "0");
    } catch (e) {}
  };
  reapply = applyFilters;
  searchInput.addEventListener("input", applyFilters);
  applyFilters();

  // bottom action bar: status, jump, copy-all, clear
  var bar = document.createElement("div");
  bar.className = "actionbar";
  var status = document.createElement("span");
  status.className = "status";
  var copyBtn = document.createElement("button");
  copyBtn.className = "copyall";
  copyBtn.textContent = "Copy new " + CONFIG.nouns;
  var copyAllBtn = document.createElement("button");
  copyAllBtn.className = "clearall";
  copyAllBtn.textContent = "Copy all";
  var clearBtn = document.createElement("button");
  clearBtn.className = "clearall";
  clearBtn.textContent = "Clear";
  var jumpBtn = document.createElement("button");
  jumpBtn.className = "jumpnote";
  jumpBtn.type = "button";
  bar.appendChild(status);
  bar.appendChild(jumpBtn);
  bar.appendChild(copyBtn);
  bar.appendChild(copyAllBtn);
  bar.appendChild(clearBtn);
  document.body.appendChild(bar);

  var fallback = document.getElementById("fallback");
  var fallbackText = document.getElementById("fallback-text");

  // a card is commented once it has a decision, any text, or an edited draft
  function commented() {
    return entries.filter(function (e) {
      return e.decision() || e.ta.value.trim() || draftEdited(e.card);
    });
  }

  // a comment is "new" until its exact decision + text + draft wording has
  // been copied once; changing any of them afterwards makes it new again
  function snapshot(e) {
    return e.decision() + "\n" + e.ta.value.trim() + "\n" +
      (draftEdited(e.card) ? draftText(e.card) : "");
  }
  function sentText(e) {
    try { return localStorage.getItem(e.sentKey) || ""; } catch (err) { return ""; }
  }
  function pending() {
    return entries.filter(function (e) { return cardPending(e.card); });
  }
  // the toggle stays reachable while it is on, even once the batch is empty
  function paintPending() {
    var n = pending().length;
    pendingBtn.hidden = !n && !pendingOnly;
    pendingBtn.textContent = "Not copied yet (" + n + ")";
    pendingBtn.setAttribute("aria-pressed", String(pendingOnly));
  }
  // a card is waiting to be copied when it says something that has not been
  // sent in exactly this form; hoisted so the filters above can call it
  function cardPending(card) {
    var e = card.__entry;
    if (!e) return false;
    var has = e.decision() || e.ta.value.trim() || draftEdited(e.card);
    return !!has && snapshot(e) !== sentText(e);
  }

  function markSent(list) {
    list.forEach(function (e) {
      try { localStorage.setItem(e.sentKey, snapshot(e)); } catch (err) {}
    });
  }

  // export embeds each card's verdict + suggested fix so the pasted block
  // is understandable in a session that has never seen this report
  function collect(list) {
    var lines = ["Feedback on the " + EXPORT_HEADER + "."].concat(CONFIG.exportIntro, [""]);
    var draftLines = function (card) {
      var out = [];
      var draft = card.querySelector(".snippet.draft");
      if (draft) {
        var target = draft.querySelector(".where");
        out.push(CONFIG.draftLabel +
                 (target ? CONFIG.draftTargetPrefix + target.textContent.trim() + ")" : "") +
                 (draftEdited(card) ? CONFIG.draftEditedSuffix : "") + ":");
        out.push("```");
        out.push(card.__draft ? draftText(card) : draft.querySelector("pre").textContent.replace(/\s+$/, ""));
        out.push("```");
      }
      return out;
    };
    list.forEach(function (e) {
      lines.push("## " + e.title + "  [" + e.section + "]");
      if (e.link) lines.push("Thread: " + e.link);
      var st = e.card.querySelector(".st");
      if (st) lines.push("Status in report: " + st.textContent.trim());
      var verdict = e.card.querySelector(".verdict");
      if (verdict) lines.push("Report verdict: " + verdict.textContent.replace(/\s+/g, " ").trim());
      if (CONFIG.draftBeforeSuggest) lines = lines.concat(draftLines(e.card));
      e.card.querySelectorAll(".snippet.suggest").forEach(function (s) {
        var where = s.querySelector(".where");
        var label = s.querySelector(".fixlbl");
        lines.push((label ? label.textContent.trim() : "Suggested fix") +
                   (where ? " (" + where.textContent.trim() + ")" : "") + ":");
        lines.push("```");
        lines.push(s.querySelector("pre").textContent.replace(/\s+$/, ""));
        lines.push("```");
      });
      if (!CONFIG.draftBeforeSuggest) lines = lines.concat(draftLines(e.card));
      if (e.decision()) lines.push("MY DECISION: " + e.decision());
      if (e.ta.value.trim()) lines.push("MY COMMENT: " + e.ta.value.trim());
      lines.push("");
    });
    return lines.join("\n");
  }

  function refresh() {
    var n = commented().length;
    var p = pending().length;
    status.textContent = n === 0 ? "No " + CONFIG.nouns + " yet"
      : p === 0 ? n + " of " + entries.length + " " + CONFIG.verb + ", all copied"
      : p === n ? n + " of " + entries.length + " items " + CONFIG.verb
      : p + " new of " + n + " " + CONFIG.nouns;
    copyBtn.disabled = p === 0;
    copyBtn.textContent = p === n ? "Copy all " + CONFIG.nouns : "Copy new " + CONFIG.nouns + (p ? " (" + p + ")" : "");
    copyAllBtn.hidden = n === 0 || p === n;
    copyAllBtn.textContent = "Copy all (" + n + ")";
    clearBtn.hidden = n === 0;
    jumpBtn.hidden = n === 0;
    if (n > 0) {
      jumpBtn.textContent = n === 1 ? "Jump to my " + CONFIG.noun : "Jump to my " + CONFIG.nouns + " (" + n + ")";
    }
    entries.forEach(function (e) {
      var v = e.decision() || e.ta.value.trim() || draftEdited(e.card);
      var sent = v && snapshot(e) === sentText(e);
      e.mark.textContent = sent ? " - copied" : "";
      e.card.classList.toggle("tocopy", !!v && !sent);
    });
    paintPending();
  }

  var jumpIdx = -1;
  var flashTimer = null;
  jumpBtn.addEventListener("click", function () {
    var noted = commented();
    if (!noted.length) return;
    jumpIdx = (jumpIdx + 1) % noted.length;
    var card = noted[jumpIdx].card;
    if (card.__setOpen) card.__setOpen(true, false);
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    document.querySelectorAll("article.item.flash").forEach(function (c) { c.classList.remove("flash"); });
    card.classList.add("flash");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { card.classList.remove("flash"); }, 1500);
    jumpBtn.textContent = "Comment " + (jumpIdx + 1) + " of " + noted.length + " - next";
  });

  function doCopy(list, btn) {
    if (!list.length) return;
    var text = collect(list);
    var done = function () {
      markSent(list);
      refresh();
      reapply();
      btn.textContent = "Copied - paste it back to Claude";
      setTimeout(refresh, 2500);
    };
    var showFallback = function () {
      markSent(list);
      refresh();
      reapply();
      fallbackText.value = text;
      fallback.hidden = false;
      fallbackText.focus();
      fallbackText.select();
      fallback.scrollIntoView({ block: "nearest" });
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, showFallback);
    } else {
      showFallback();
    }
  }
  // hovering or focusing the button shows the set it would send
  var preview = function (on) { document.body.classList.toggle("previewcopy", on); };
  ["mouseenter", "focus"].forEach(function (ev) {
    copyBtn.addEventListener(ev, function () { preview(true); });
  });
  ["mouseleave", "blur"].forEach(function (ev) {
    copyBtn.addEventListener(ev, function () { preview(false); });
  });
  copyBtn.addEventListener("click", function () { doCopy(pending(), copyBtn); });
  copyAllBtn.addEventListener("click", function () { doCopy(commented(), copyAllBtn); });

  // window.confirm is silently blocked in the artifact sandbox, so
  // confirmation is a second click on the armed button
  var clearArmed = false;
  var clearDisarm = null;
  clearBtn.addEventListener("click", function () {
    if (!clearArmed) {
      clearArmed = true;
      clearBtn.textContent = "Really clear " + commented().length + "? Click again";
      clearDisarm = setTimeout(function () {
        clearArmed = false;
        clearBtn.textContent = "Clear";
      }, 4000);
      return;
    }
    clearTimeout(clearDisarm);
    clearArmed = false;
    clearBtn.textContent = "Clear";
    entries.forEach(function (e) {
      e.ta.value = "";
      e.setDecision("");
      if (e.card.__draft) e.card.__draft.reset();
      try {
        localStorage.removeItem(KEY_PREFIX + "note-" + slug(e.title));
        localStorage.removeItem(e.sentKey);
      } catch (err) {}
    });
    fallback.hidden = true;
    refresh();
    reapply();
  });

  refresh();
