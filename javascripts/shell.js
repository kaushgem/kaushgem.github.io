/*
 * Optional interactive shell. The page works fully without it; to remove it,
 * delete this file, stylesheets/shell.css, the card file, the linkedin/,
 * github/ and resume/ folders, and the <script src="javascripts/shell.js"> tag.
 */
(function () {
  "use strict";

  var idle = document.querySelector(".cmd--idle");
  if (!idle) return;

  var scriptSrc = document.currentScript && document.currentScript.src;
  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = scriptSrc ? scriptSrc.replace(/javascripts\/shell\.js.*$/, "stylesheets/shell.css") : "stylesheets/shell.css";
  document.head.appendChild(css);

  // /resume short link lands on /?print=1
  if (/[?&]print=1(&|$)/.test(location.search)) {
    history.replaceState(null, "", location.pathname + location.hash);
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 300);
    });
  }

  /* ---------- Profile data, read from the static page ---------- */

  var LINKS = {
    linkedin: "https://www.linkedin.com/in/kaushgem",
    github: "https://github.com/kaushgem"
  };
  var CARD_URL = "/card";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function stripSlash(s) { return s.replace(/\/$/, ""); }

  var jobs = $$(".ls__row").map(function (row) {
    return {
      name: stripSlash($(".ls__dir", row).textContent.trim()),
      company: row.getAttribute("data-company") || stripSlash($(".ls__dir", row).textContent.trim()),
      role: $(".ls__info .bright", row).textContent.trim(),
      date: $(".ls__date", row).textContent.trim(),
      row: row
    };
  });

  var projects = $$(".tree__item").map(function (item) {
    var a = $(".tree__name a", item);
    return { name: stripSlash(a.textContent.trim()), url: a.href, item: item };
  });

  var FILES = {
    "about.md": "#about",
    "stack.txt": ".stack",
    "education.txt": "#education",
    "publications.txt": "#writing",
    "volunteering.txt": "#community"
  };
  var DIRS = ["experience/", "projects/"];
  var SECTIONS = ["about", "experience", "projects", "education", "writing", "community", "contact"];

  /* ---------- Build the shell UI ---------- */

  var shell = el("div", "shell");
  shell.setAttribute("role", "region");
  shell.setAttribute("aria-label", "Interactive terminal");

  var log = el("div", "shell__log");
  log.setAttribute("aria-live", "polite");

  var form = el("form", "shell__form");
  var line = el("label", "shell__line");
  line.appendChild(promptEl());
  var srLabel = el("span", "sr-only", "Type a command, for example help");
  line.appendChild(srLabel);
  var field = el("span", "shell__field");
  var ghost = el("span", "shell__ghost");
  ghost.setAttribute("aria-hidden", "true");
  var ghostTyped = el("span", "shell__ghost-typed");
  var ghostRest = el("span", "shell__ghost-rest");
  ghost.appendChild(ghostTyped);
  ghost.appendChild(ghostRest);
  var input = document.createElement("input");
  input.className = "shell__input";
  input.type = "text";
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("enterkeyhint", "go");
  input.setAttribute("aria-describedby", "shell-hint");
  field.appendChild(ghost);
  field.appendChild(input);
  line.appendChild(field);
  form.appendChild(line);

  var chips = el("div", "shell__chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Suggested commands");
  var hint = el("p", "shell__hint");
  hint.id = "shell-hint";
  hint.appendChild(document.createTextNode("try "));
  hint.appendChild(el("kbd", null, "help"));
  hint.appendChild(document.createTextNode(" · "));
  hint.appendChild(el("kbd", null, "tab"));
  hint.appendChild(document.createTextNode(" completes · "));
  hint.appendChild(el("kbd", null, "↑"));
  hint.appendChild(document.createTextNode(" history · "));
  hint.appendChild(el("kbd", null, "/"));
  hint.appendChild(document.createTextNode(" jumps here"));

  shell.appendChild(log);
  shell.appendChild(form);
  shell.appendChild(chips);
  shell.appendChild(hint);
  idle.parentNode.replaceChild(shell, idle);

  /* ---------- DOM helpers ---------- */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function promptEl() {
    var p = el("span", "prompt", "kaushik@angi");
    p.setAttribute("aria-hidden", "true");
    p.appendChild(el("span", "prompt__path", ":~"));
    p.appendChild(document.createTextNode("$"));
    return p;
  }

  function linkEl(url, label) {
    var a = el("a", null, label || url);
    a.href = url;
    return a;
  }

  /* ---------- Output ---------- */

  var out; // container for the current command's output

  function newEntry(raw) {
    var entry = el("div", "shell__entry");
    var echo = el("p", "cmd");
    echo.appendChild(promptEl());
    echo.appendChild(document.createTextNode(" " + raw));
    entry.appendChild(echo);
    out = el("div", "shell__out");
    entry.appendChild(out);
    log.appendChild(entry);
  }

  function print(text, cls) {
    var p = el("p", cls || null, text);
    out.appendChild(p);
    return p;
  }

  function printNode(node) {
    out.appendChild(node);
    return node;
  }

  function printPre(text, cls) {
    return printNode(el("pre", "shell__pre" + (cls ? " " + cls : ""), text));
  }

  function printMixed(parts) {
    var p = el("p");
    parts.forEach(function (part) {
      if (typeof part === "string") p.appendChild(document.createTextNode(part));
      else p.appendChild(part);
    });
    return printNode(p);
  }

  function cloneOf(selector) {
    var src = $(selector);
    if (!src) return null;
    var copy = src.cloneNode(true);
    copy.removeAttribute("id");
    $$("[id]", copy).forEach(function (n) { n.removeAttribute("id"); });
    return copy;
  }

  function printSection(selector) {
    var section = $(selector);
    if (!section) return;
    $$(".out, .plain, .stack, .ls, .tree", section).forEach(function (n) {
      if (n.parentNode === section) printNode(n.cloneNode(true));
    });
  }

  /* ---------- Commands ---------- */

  function openUrl(url, label) {
    var w = window.open(url, "_blank");
    if (w) w.opener = null;
    printMixed([el("span", "shell__ok", "→ "), w ? "opening " : "pop-up blocked, follow the link: ", linkEl(url, label)]);
  }

  function openTarget(arg) {
    var t = (arg || "").toLowerCase().replace(/\/$/, "");
    if (!t) return print("usage: open <linkedin|github|resume|project>", "shell__err");
    if (LINKS[t]) return openUrl(LINKS[t], LINKS[t].replace(/^https:\/\/(www\.)?/, ""));
    if (t === "resume" || t === "cv") {
      print("→ opening the print dialog — choose “Save as PDF” to keep a copy", "shell__ok");
      return setTimeout(function () { window.print(); }, 50);
    }
    var matches = projects.filter(function (p) { return p.name.indexOf(t) === 0; });
    if (matches.length === 1) return openUrl(matches[0].url, matches[0].url.replace(/^https:\/\//, ""));
    print("open: can't find '" + arg + "'. Try linkedin, github, resume or a project: " +
      projects.map(function (p) { return p.name; }).join(", "), "shell__err");
  }

  function showExperience(arg) {
    if (!arg) return printSection("#experience");
    var t = arg.toLowerCase().replace(/\/$/, "");
    var job = jobs.filter(function (j) { return j.name.indexOf(t) === 0; })[0];
    if (!job) return print("experience: no entry for '" + arg + "'. Try: " + jobs.map(function (j) { return j.name; }).join(", "), "shell__err");
    var list = el("ul", "ls");
    list.appendChild(job.row.cloneNode(true));
    printNode(list);
  }

  function showProjects(arg) {
    if (!arg) return printSection("#projects");
    var t = arg.toLowerCase().replace(/\/$/, "");
    var p = projects.filter(function (x) { return x.name.indexOf(t) === 0; })[0];
    if (!p) return print("projects: no project '" + arg + "'. Try: " + projects.map(function (x) { return x.name; }).join(", "), "shell__err");
    var list = el("ul", "tree");
    list.appendChild(p.item.cloneNode(true));
    printNode(list);
    printMixed(["open it: ", el("kbd", null, "open " + p.name)]);
  }

  function listing(names) {
    var p = el("p", "shell__ls");
    names.forEach(function (n) {
      p.appendChild(el("span", /\/$/.test(n) ? "ls__dir" : null, n));
    });
    printNode(p);
  }

  function ls(arg) {
    var t = (arg || "").replace(/^\.\//, "");
    if (!t || t === "." || t === "~") return listing(Object.keys(FILES).concat(DIRS));
    if (/^experience\/?$/.test(t)) return listing(jobs.map(function (j) { return j.name + "/"; }));
    if (/^projects\/?$/.test(t)) return listing(projects.map(function (p) { return p.name + "/"; }));
    print("ls: " + arg + ": No such file or directory", "shell__err");
  }

  function cat(arg) {
    if (!arg) return print("usage: cat <file>. Try: ls", "shell__err");
    var t = arg.replace(/^\.\//, "");
    if (DIRS.indexOf(t) !== -1 || DIRS.indexOf(t + "/") !== -1) return print("cat: " + arg + ": Is a directory", "shell__err");
    var target = FILES[t];
    if (!target) return print("cat: " + arg + ": No such file or directory", "shell__err");
    if (target === ".stack") return printNode(cloneOf(".stack"));
    printSection(target);
  }

  function cd(arg) {
    var t = (arg || "~").replace(/\/$/, "").toLowerCase();
    if (t === "~" || t === ".." || t === "/") return window.scrollTo({ top: 0, behavior: "smooth" });
    if (SECTIONS.indexOf(t) === -1) return print("cd: no such file or directory: " + arg, "shell__err");
    var target = document.getElementById(t);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function whoami() {
    var hero = $(".block--hero");
    print($(".name", hero).textContent.trim(), "bright");
    $$(".out", hero).forEach(function (p) { printNode(p.cloneNode(true)); });
  }

  /* Card: shared with `curl kaushgem.github.io/card` in a real terminal */
  function renderAnsi(text) {
    var pre = el("pre", "shell__pre shell__card");
    var state = { fg: null, bold: false };
    var re = /\x1b\[([\d;]*)m/g, last = 0, m;
    function flush(chunk) {
      if (!chunk) return;
      var span = el("span");
      if (state.fg) span.className = "ansi-" + state.fg;
      if (state.bold) span.className += " ansi-bold";
      chunk.split(/(https:\/\/\S+)/).forEach(function (piece) {
        if (/^https:\/\//.test(piece)) span.appendChild(linkEl(piece));
        else if (piece) span.appendChild(document.createTextNode(piece));
      });
      pre.appendChild(span);
    }
    while ((m = re.exec(text))) {
      flush(text.slice(last, m.index));
      (m[1] || "0").split(";").forEach(function (code) {
        code = +code;
        if (code === 0) { state.fg = null; state.bold = false; }
        else if (code === 1) state.bold = true;
        else if (code === 39) state.fg = null;
        else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) state.fg = String(code);
      });
      last = re.lastIndex;
    }
    flush(text.slice(last));
    return pre;
  }

  function card() {
    var target = out;
    var loading = print("fetching card…", "comment");
    fetch(CARD_URL).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (text) {
      target.replaceChild(renderAnsi(text), loading);
      var tip = el("p", "comment", "# in your own terminal: curl -s kaushgem.github.io/card");
      target.appendChild(tip);
    }).catch(function () {
      loading.textContent = "curl: couldn't load the card. Try: whoami";
      loading.className = "shell__err";
    });
  }

  function curl(args) {
    var url = args.filter(function (a) { return a.charAt(0) !== "-"; })[0] || "";
    if (/(^|\/)card\/?$/.test(url) && (/^\/?card/.test(url) || /kaushgem\.github\.io/.test(url))) return card();
    if (!url) return print("usage: curl kaushgem.github.io/card", "shell__err");
    print("curl: (6) this terminal can only reach kaushgem.github.io/card", "shell__err");
  }

  /* ask: keyword answers, no network, no AI */
  var STACK_NAMES = { "ruby-on-rails": "Ruby on Rails", ruby: "Ruby", java: "Java", sql: "SQL", javascript: "JavaScript", kubernetes: "Kubernetes" };

  var TOPICS = [
    { words: ["stack", "tech", "language", "languages", "tools", "skills", "ruby", "rails", "java", "sql", "javascript", "kubernetes", "use", "with"], answer: function () {
      var items = $$(".stack li").slice(0, 4).map(function (li) { return STACK_NAMES[li.textContent] || li.textContent; });
      return ["Mostly " + items.slice(0, -1).join(", ") + " and " + items[items.length - 1] + ". ", "Try: ", el("kbd", null, "stack")];
    } },
    { words: ["work", "job", "company", "angi", "employer", "role", "title", "position", "handy"], answer: function () {
      var j = jobs[0];
      return ["I'm a " + j.role + " at " + j.company + " (" + j.date + "). ", "Try: ", el("kbd", null, "experience " + j.name)];
    } },
    { words: ["project", "projects", "built", "build", "portfolio", "code", "repo", "repos", "side"], answer: function () {
      return [projects.length + " projects on this page, all on GitHub. ", "Try: ", el("kbd", null, "projects"), " or ", el("kbd", null, "open github")];
    } },
    { words: ["education", "study", "studied", "degree", "school", "university", "college", "masters", "buffalo"], answer: function () {
      return [$$("#education li").map(function (li) { return li.textContent.replace(/\s+/g, " ").trim(); }).join("; ") + ". ", "Try: ", el("kbd", null, "education")];
    } },
    { words: ["contact", "reach", "email", "mail", "hire", "hiring", "connect", "talk", "message", "chat", "recruit", "recruiter", "available"], answer: function () {
      return ["The best way to reach me is LinkedIn. ", "Try: ", el("kbd", null, "open linkedin")];
    } },
    { words: ["where", "located", "location", "based", "live", "city", "remote"], answer: function () {
      return [$$(".block--hero .out")[1].textContent.trim() + "."];
    } },
    { words: ["paper", "publication", "published", "research", "journal", "writing"], answer: function () {
      return ["One paper on time-series similarity analysis (2013). ", "Try: ", el("kbd", null, "cat publications.txt")];
    } },
    { words: ["volunteer", "volunteering", "community", "tutor", "teaching", "nonprofit"], answer: function () {
      return ["I tutored with the Wild Wing Society from 2010 to 2014. ", "Try: ", el("kbd", null, "cat volunteering.txt")];
    } },
    { words: ["experience", "years", "long", "career", "background"], answer: function () {
      return ["Over a decade: " + jobs.map(function (j) { return j.company; }).join(", ") + ". ", "Try: ", el("kbd", null, "experience")];
    } }
  ];

  function ask(rest) {
    if (!rest) return printMixed(["usage: ask <question>, for example ", el("kbd", null, "ask where do you work?")]);
    var words = rest.toLowerCase().match(/[a-z]+/g) || [];
    var best = null, bestScore = 0;
    TOPICS.forEach(function (topic) {
      var score = words.filter(function (w) { return topic.words.indexOf(w) !== -1; }).length;
      if (score > bestScore) { best = topic; bestScore = score; }
    });
    if (best) return printMixed(best.answer());
    printMixed(["I don't have an answer for that here. Try ", el("kbd", null, "help"), ", or ask me directly: ", el("kbd", null, "open linkedin")]);
  }

  var HELP = [
    "about me",
    "  whoami                 who I am",
    "  about                  a short intro",
    "  experience [company]   where I've worked",
    "  projects [name]        things I've built",
    "  stack · education      tools and degrees",
    "  ask <question>         ask in plain words",
    "  neofetch               my card (curl kaushgem.github.io/card)",
    "",
    "go places",
    "  open <linkedin|github|resume|project>",
    "  /linkedin  /github  /resume",
    "  cd <section>           jump to a section",
    "",
    "shell",
    "  ls · cat <file> · history · clear · exit",
    "",
    "tab completes · ↑↓ history · ctrl+l clears · esc cancels"
  ].join("\n");

  var history_ = [];
  var histIdx = 0;

  var COMMANDS = {
    help: function () { printPre(HELP); },
    whoami: whoami,
    about: function () { printSection("#about"); },
    experience: function (a) { showExperience(a[0]); },
    projects: function (a) { showProjects(a[0]); },
    stack: function () { printNode(cloneOf(".stack")); },
    education: function () { printSection("#education"); },
    publications: function () { printSection("#writing"); },
    volunteering: function () { printSection("#community"); },
    ask: function (a, rest) { ask(rest); },
    open: function (a) { openTarget(a[0]); },
    linkedin: function () { openTarget("linkedin"); },
    github: function () { openTarget("github"); },
    resume: function () { openTarget("resume"); },
    contact: function () { printMixed(["The best way to reach me is LinkedIn: ", el("kbd", null, "open linkedin")]); },
    neofetch: card,
    curl: function (a) { curl(a); },
    cd: function (a) { cd(a[0]); },
    ls: function (a) { ls(a[0]); },
    cat: function (a) { cat(a[0]); },
    pwd: function () { print("/home/kaushik"); },
    date: function () { print(new Date().toString()); },
    echo: function (a, rest) { print(rest); },
    history: function () {
      printPre(history_.map(function (h, i) { return ("  " + (i + 1)).slice(-4) + "  " + h; }).join("\n"));
    },
    clear: function () { log.textContent = ""; },
    exit: function () { print("logout"); print("Thanks for stopping by. The prompt is still here if you change your mind.", "comment"); },
    sudo: function (a, rest) {
      if (/rm\s+-rf/.test(rest)) return print("Nice try.", "shell__err");
      printMixed([el("span", "shell__ok", "Permission granted. "), "Next step: ", el("kbd", null, "open linkedin")]);
    }
  };

  var ALIASES = {
    "?": "help", man: "help", goto: "open", go: "open", ll: "ls", dir: "ls", cls: "clear",
    exp: "experience", work: "experience", jobs: "experience", skills: "stack", cv: "resume",
    email: "contact", mail: "contact", hire: "contact", logout: "exit", quit: "exit", fetch: "neofetch"
  };

  // Shown by autocomplete; aliases and easter eggs stay hidden
  var COMPLETABLE = ["help", "whoami", "about", "experience", "projects", "stack", "education",
    "publications", "volunteering", "ask", "open", "linkedin", "github", "resume", "contact",
    "neofetch", "curl", "cd", "ls", "cat", "history", "clear", "exit", "pwd", "date", "echo"];
  var NEEDS_ARG = { ask: 1, open: 1, cd: 1, cat: 1, curl: 1, echo: 1 };

  function argOptions(cmd) {
    cmd = ALIASES[cmd] || cmd;
    switch (cmd) {
      case "open": return ["linkedin", "github", "resume"].concat(projects.map(function (p) { return p.name; }));
      case "experience": return jobs.map(function (j) { return j.name; });
      case "projects": return projects.map(function (p) { return p.name; });
      case "cat": return Object.keys(FILES);
      case "ls": return DIRS;
      case "cd": return SECTIONS;
      case "curl": return ["kaushgem.github.io/card"];
      case "ask": return ["where do you work?", "what is your stack?", "how do I contact you?", "where are you based?"];
      default: return null;
    }
  }

  function candidates(value) {
    var v = value.replace(/^\s+/, "");
    var slash = v.charAt(0) === "/" ? "/" : "";
    if (slash) v = v.slice(1);
    var sp = v.indexOf(" ");
    if (sp === -1) {
      var lower = v.toLowerCase();
      return COMPLETABLE.filter(function (n) { return n.indexOf(lower) === 0; })
        .map(function (n) { return slash + n; });
    }
    var cmd = v.slice(0, sp).toLowerCase();
    var arg = v.slice(sp + 1).replace(/^\s+/, "").toLowerCase();
    var opts = argOptions(cmd);
    if (!opts) return [];
    return opts.filter(function (o) { return o.toLowerCase().indexOf(arg) === 0; })
      .map(function (o) { return slash + cmd + " " + o; });
  }

  function commonPrefix(list) {
    return list.reduce(function (a, b) {
      var i = 0;
      while (i < a.length && i < b.length && a.charAt(i).toLowerCase() === b.charAt(i).toLowerCase()) i++;
      return a.slice(0, i);
    });
  }

  function distance(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) d[i] = [i];
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  function run(raw) {
    var lineText = raw.trim();
    newEntry(raw);
    if (!lineText) return;
    history_.push(lineText);
    histIdx = history_.length;

    var s = lineText.charAt(0) === "/" ? lineText.slice(1) : lineText;
    var parts = s.split(/\s+/);
    var name = parts[0].toLowerCase();
    var rest = s.slice(parts[0].length).trim();
    var fn = COMMANDS[name] || COMMANDS[ALIASES[name]];
    if (fn) return fn(parts.slice(1), rest);

    var guess = COMPLETABLE.map(function (c) { return { c: c, d: distance(name, c) }; })
      .sort(function (a, b) { return a.d - b.d; })[0];
    if (guess && guess.d <= 2) {
      printMixed([el("span", "shell__err", "command not found: " + name + ". "), "Did you mean ", el("kbd", null, guess.c), "?"]);
    } else {
      printMixed([el("span", "shell__err", "command not found: " + name + ". "), "Try ", el("kbd", null, "help"), " or ", el("kbd", null, "ask <question>")]);
    }
  }

  /* ---------- Suggestions: ghost text + chips ---------- */

  var DEFAULT_CHIPS = ["help", "experience", "projects", "ask where do you work?", "open linkedin", "open github"];

  function refresh() {
    var value = input.value;
    field.classList.toggle("is-empty", !value);
    var list = value.trim() ? candidates(value) : [];
    var first = list[0];
    if (first && value && first.toLowerCase().indexOf(value.toLowerCase()) === 0 && first.length > value.length) {
      ghostTyped.textContent = value;
      ghostRest.textContent = first.slice(value.length);
    } else {
      ghostTyped.textContent = "";
      ghostRest.textContent = "";
    }

    var chipList = value.trim() ? list.filter(function (c) { return c !== value.trim(); }) : DEFAULT_CHIPS;
    chips.textContent = "";
    chipList.slice(0, 6).forEach(function (c) {
      var b = el("button", "shell__chip", c);
      b.type = "button";
      b.addEventListener("click", function () { useSuggestion(c); });
      chips.appendChild(b);
    });
  }

  function useSuggestion(c) {
    var s = c.charAt(0) === "/" ? c.slice(1) : c;
    var cmd = s.split(" ")[0];
    if (NEEDS_ARG[cmd] && s.indexOf(" ") === -1) {
      input.value = c + " ";
      refresh();
      input.focus();
      return;
    }
    input.value = "";
    run(c);
    refresh();
    input.focus();
    form.scrollIntoView({ block: "nearest" });
  }

  function complete() {
    var value = input.value;
    var list = candidates(value);
    if (!list.length) return;
    if (list.length === 1) {
      var only = list[0];
      var cmd = (only.charAt(0) === "/" ? only.slice(1) : only).split(" ")[0];
      input.value = only + (only.indexOf(" ") === -1 && (NEEDS_ARG[cmd] || argOptions(cmd)) ? " " : "");
    } else {
      var prefix = commonPrefix(list);
      if (prefix.length > value.length) {
        input.value = prefix;
      } else {
        newEntry(value);
        listing(list.map(function (c) { return c.split(" ").pop(); }));
      }
    }
    refresh();
  }

  /* ---------- Events ---------- */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = input.value;
    input.value = "";
    run(value);
    refresh();
    form.scrollIntoView({ block: "nearest" });
  });

  input.addEventListener("input", refresh);

  input.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && !e.shiftKey && input.value.trim()) {
      e.preventDefault();
      complete();
    } else if (e.key === "ArrowRight" && ghostRest.textContent && input.selectionStart === input.value.length) {
      e.preventDefault();
      input.value += ghostRest.textContent;
      refresh();
    } else if (e.key === "ArrowUp") {
      if (!history_.length) return;
      e.preventDefault();
      histIdx = Math.max(0, histIdx - 1);
      input.value = history_[histIdx];
      refresh();
    } else if (e.key === "ArrowDown") {
      if (!history_.length) return;
      e.preventDefault();
      histIdx = Math.min(history_.length, histIdx + 1);
      input.value = history_[histIdx] || "";
      refresh();
    } else if (e.key === "Escape") {
      if (input.value) input.value = "";
      else input.blur();
      refresh();
    } else if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      log.textContent = "";
    } else if (e.ctrlKey && e.key === "c" && input.selectionStart === input.selectionEnd) {
      e.preventDefault();
      newEntry(input.value + "^C");
      input.value = "";
      refresh();
    }
  });

  shell.addEventListener("click", function (e) {
    if (e.target.closest("a, button, input") || window.getSelection().toString()) return;
    input.focus();
  });

  // Press "/" anywhere on the page to jump to the prompt
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    e.preventDefault();
    input.value = "/";
    refresh();
    input.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  refresh();
})();
