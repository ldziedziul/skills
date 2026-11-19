  // Set once per PR (e.g. "outbox-myrepo-133-") and never change it -
  // the user's notes and collapse states are keyed on it.
  var KEY_PREFIX = "outbox-REPO-NNN-";
  // First line of the copied export; keep it specific enough that a fresh
  // Claude session knows which PR the feedback belongs to. Fill OWNER/REPO
  // in the string below.
  var EXPORT_HEADER = document.title.replace(" Review Outbox", "") +
    " (OWNER/REPO) review outbox report";

  // What differs between the review skills; core/report.js reads only this.
  var CONFIG = {
    actionPill: ".st.act",
    actionSt: ["topost", "recheck", "stale"],
    droppedSt: ["skipped"],
    groups: { sev: "Severity", cert: "Certainty" },
    labelSources: ".item-head .tag",
    // "agree" = the user posts the draft as written; "drop" = it is not going out.
    decisions: [{ key: "agree", label: "Agree - post as drafted" }, { key: "drop", label: "Drop" }],
    noun: "comment", nouns: "comments", verb: "commented",
    noteLabel: "Your comment",
    notePlaceholder: "Optional - e.g. a rephrase, or why you dropped it",
    exportIntro: [
      "Each item carries its card id, target path:line, the report's verdict,",
      "and the draft comment, so it is understandable without the report.",
      "A draft marked EDITED BY ME is my wording, not yours: keep it verbatim",
      "on the card when you republish. MY DECISION is agree (I will post the",
      "draft as it stands here, edited or not) or drop (not posting it - flip",
      "the card to skipped); MY COMMENT is anything else."
    ],
    draftLabel: "Draft comment", draftTargetPrefix: " (target ",
    draftEditedSuffix: " (EDITED BY ME - post this wording, not the original)",
    draftBeforeSuggest: true
  };
