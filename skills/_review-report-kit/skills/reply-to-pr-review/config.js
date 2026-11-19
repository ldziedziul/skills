  // FILL: set once per PR (e.g. "triage-myrepo-127-") and never change it -
  // the user's notes and collapse states are keyed on it.
  var KEY_PREFIX = "triage-REPO-NNN-";
  // First line of the copied export; keep it specific enough that a fresh
  // Claude session knows which PR the feedback belongs to.
  var EXPORT_HEADER = document.title.replace(" Review Triage", "") +
    " (OWNER/REPO) review triage report";

  // What differs between the review skills; core/report.js reads only this.
  var CONFIG = {
    actionPill: ".st.open",
    actionSt: ["open"],
    droppedSt: ["dropped"],
    groups: { fix: "Code change", docs: "Doc fix", answer: "Answer", decision: "Decision" },
    labelSources: ".item-head .tag",
    // "agree" = do what the card says (apply the fix, post the reply); "drop" = leave it.
    decisions: [{ key: "agree", label: "Agree - do it" }, { key: "drop", label: "Drop" }],
    noun: "comment", nouns: "comments", verb: "commented",
    noteLabel: "Your comment",
    notePlaceholder: "Optional - e.g. a different fix, a reason, a question back",
    exportIntro: [
      "Each item quotes the report's verdict, suggested fix and paste-ready reply",
      "so my comments can be understood without the report itself.",
      "A reply marked EDITED BY ME is my wording, not yours: keep it verbatim",
      "on the card when you republish.",
      "MY DECISION is agree (do what the card says: apply the fix, post the reply",
      "as it stands here, edited or not) or drop (leave it; flip the card to",
      "dropped); MY COMMENT is anything else."
    ],
    draftLabel: "Paste-ready reply", draftTargetPrefix: " (",
    draftEditedSuffix: " (EDITED BY ME - post this wording, not the original)",
    draftBeforeSuggest: false
  };
