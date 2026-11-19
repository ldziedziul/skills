  // Set once per target (e.g. "self-review-myrepo-133-" or "self-review-myrepo-feature-x-") and never change it -
  // the user's notes and collapse states are keyed on it.
  var KEY_PREFIX = "self-review-REPO-TARGET-";
  // First line of the copied export; keep it specific enough that a fresh
  // Claude session knows which PR the feedback belongs to. Fill OWNER/REPO
  // in the string below.
  var EXPORT_HEADER = document.title.replace(" Self-Review", "") +
    " (OWNER/REPO) self-review report";

  // What differs between the review skills; core/report.js reads only this.
  var CONFIG = {
    actionPill: ".st.act",
    actionSt: ["tofix", "explain", "stale"],
    droppedSt: ["dropped"],
    groups: { sev: "Severity", cert: "Certainty", lens: "Perspective" },
    labelSources: ".item-head .tag, .item-head .lens",
    // "agree" = apply the suggested fix; "drop" = the code stays.
    decisions: [{ key: "agree", label: "Agree - fix it" }, { key: "drop", label: "Drop" }],
    noun: "decision", nouns: "decisions", verb: "decided",
    noteLabel: "Your decision",
    notePlaceholder: "Optional - e.g. explain in PR, a different fix, or why you dropped it",
    exportIntro: [
      "Each item carries its card title, target path:line, the report's verdict",
      "and suggested fix, so it is understandable without the report. A PR note",
      "marked EDITED BY ME is my wording, not yours: keep it verbatim on the card",
      "when you republish. MY DECISION",
      "is agree (apply the suggested fix) or drop (the code stays; flip the card",
      "to dropped); MY COMMENT is anything else, e.g. explain in PR, or a reason."
    ],
    draftLabel: "Paste-ready PR note", draftTargetPrefix: " (target ",
    draftEditedSuffix: " (EDITED BY ME - use this wording, not the original)",
    draftBeforeSuggest: true
  };
