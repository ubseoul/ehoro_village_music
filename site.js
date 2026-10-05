// Ehoro Village site v3: theme toggle, nav border, cursor spotlight, scroll reveals, count-ups, slash-command demo.
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  // Theme: remember the viewer's choice (best effort; storage may be blocked).
  try { var saved = localStorage.getItem("ev-theme"); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-toggle-theme]");
    if (!t) return;
    var dark = root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("ev-theme", next); } catch (err) {}
  });

  // Nav hairline once the page scrolls.
  var nav = document.querySelector(".nav");
  var onScroll = function () { if (nav) nav.classList.toggle("scrolled", window.scrollY > 8); };
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // Cursor spotlight on the dotted grid.
  var hero = document.querySelector(".hero");
  if (hero && !reduce) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", (e.clientX - r.left) + "px");
      hero.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  }

  // Reveal blocks and count up numbers as they enter the viewport.
  var items = document.querySelectorAll(".reveal, [data-count]");
  var countUp = function (el) {
    var end = parseFloat(el.getAttribute("data-count")), suffix = el.getAttribute("data-suffix") || "";
    if (reduce) { el.textContent = end + suffix; return; }
    var start = performance.now(), dur = 1100;
    var step = function (now) {
      var p = Math.min(1, (now - start) / dur), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
      el.textContent = v + suffix; if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        if (en.target.hasAttribute("data-count")) countUp(en.target); else en.target.classList.add("in");
        io.unobserve(en.target);
      });
    }, { threshold: 0.15 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); if (el.hasAttribute("data-count")) countUp(el); });
  }

  // The slash-command demo: "/" opens a menu, a choice becomes a finished block.
  var demo = document.getElementById("demo");
  if (!demo) return;
  var lineEl = demo.querySelector(".line-in"), blocksEl = demo.querySelector(".blocks");
  var commands = [
    { key: "A", name: "Automate a workflow", typed: "/automate", block: "Form replies → summarized by AI → logged in a sheet. Tested, documented, handed over." },
    { key: "D", name: "Build a dashboard", typed: "/dashboard", block: "Messy CSV cleaned, dashboard live, monthly report runs itself." },
    { key: "B", name: "Set up an AI assistant", typed: "/assistant", block: "A custom assistant with your docs, house rules and a test transcript." },
    { key: "L", name: "Teach AI to a team", typed: "/teach", block: "A lesson people finish: practice on real tasks, plus a one-page AI policy." }
  ];
  if (reduce) {
    commands.forEach(function (c) { addBlock(c.block); });
    return;
  }
  var i = 0;
  function addBlock(text) {
    var b = document.createElement("div"); b.className = "blk done";
    b.innerHTML = '<span class="ic">✓</span><span></span>'; b.lastChild.textContent = text;
    blocksEl.appendChild(b);
    while (blocksEl.children.length > 3) blocksEl.removeChild(blocksEl.firstChild);
  }
  function run() {
    var c = commands[i % commands.length]; i++;
    lineEl.innerHTML = ""; var txt = document.createElement("span"); var caret = document.createElement("span"); caret.className = "caret";
    lineEl.appendChild(txt); lineEl.appendChild(caret);
    var n = 0;
    var type = setInterval(function () {
      n++; txt.textContent = c.typed.slice(0, n);
      if (n === 1) showMenu(c);
      if (n >= c.typed.length) { clearInterval(type); setTimeout(function () { hideMenu(); txt.textContent = ""; addBlock(c.block); setTimeout(run, 1600); }, 900); }
    }, 95);
  }
  var menu;
  function showMenu(active) {
    menu = document.createElement("div"); menu.className = "menu";
    menu.innerHTML = "<p>Basic blocks</p>" + commands.map(function (c) {
      return '<div class="' + (c === active ? "on" : "") + '"><b>' + c.key + "</b>" + c.name + "</div>";
    }).join("");
    lineEl.after(menu);
  }
  function hideMenu() { if (menu) { menu.remove(); menu = null; } }
  setTimeout(run, 700);
})();
