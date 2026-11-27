import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, agents, terminals, theme, run, machines, shared } from "herdr";

// Same species/color as dungeon-map (duplicated on purpose: three lines, avoids importing across mods).
const BESTIARY = ["k", "o", "g", "h", "n", "e", "S", "D", "L", "T", "C", "Y", "x", "j", "B", "q"];
const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// Redact mode shows a NetHack item instead of the terminal title: [name, takes an enchantment].
const ITEMS = [["long sword", 1], ["elven dagger", 1], ["dwarvish mattock", 1], ["elven bow", 1], ["cloak of protection", 1], ["elven mithril-coat", 1], ["dwarvish iron helm", 1], ["silver saber", 1],
  ["war hammer", 1], ["orcish shield", 1], ["wand of sleep", 0], ["wand of digging", 0], ["wand of fire", 0], ["wand of teleportation", 0], ["bag of holding", 0], ["magic lamp", 0],
  ["amulet of life saving", 0], ["ring of invisibility", 0], ["ring of free action", 0], ["crystal ball", 0], ["scroll of teleportation", 0], ["scroll of enchant armor", 0],
  ["potion of speed", 0], ["potion of healing", 0], ["potion of see invisible", 0], ["boots of levitation", 0], ["spellbook of force bolt", 0], ["spellbook of sleep", 0],
  ["magic marker", 0], ["unicorn horn", 0], ["lock pick", 0], ["tinning kit", 0]];
// idx: the item slot picked for this agent (see the assignment in render, which avoids repeats).
function itemName(addr, status, idx) {
  const h = hash(addr), [name, ench] = ITEMS[idx];
  const buc = status === "working" ? "blessed" : status === "blocked" ? "cursed" : "uncursed";
  return `${buc}${ench ? " +" + ((h >> 11) % 4) : ""} ${name}`;
}
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FONT = "JetBrains Mono";

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${Math.floor(h / 24)}d`;
}
// Same abbreviation as the shipped agents mod: "…claude-sonnet-5-5-v1:0" -> "S5.5".
const VENDORS = /^(anthropic|amazon|meta|mistral|deepseek|zai|qwen|openai|cohere|ai21|google|moonshot|minimax)\.(?!v\d)/;
function shortModel(id) {
  if (!id) return "";
  let m = String(id).split("/").pop().toLowerCase();
  m = m.replace(/^(us|eu|apac|global)\./, "").replace(VENDORS, "");
  m = m.replace(/:\d+$/, "").replace(/-v\d+$/, "").replace(/-\d{8}$/, "").replace(/-latest$/, "").replace(/^claude-/, "");
  let f = m.match(/^(opus|sonnet|haiku|fable)-(\d+(?:-\d+)?)/);
  if (f) return f[1][0].toUpperCase() + f[2].replace("-", ".");
  f = m.match(/^gpt-(\d+(?:\.\d+)?)/);
  if (f) return "G" + f[1];
  return ((m.match(/^[a-z]+/) ?? [m])[0].slice(0, 4)) + ((m.match(/\d+(?:[.-]\d+)?/) ?? [""])[0].replace("-", "."));
}

export default class DungeonSheet extends View {
  init(_p, cx) {
    // address -> { s: state, t: ms when the change was seen }; survives mod restarts.
    try { this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}"); } catch { this.changed = {}; }
    cx.timer.every(30000, (cx2) => cx2.notify());
  }

  track(list, now) {
    let dirty = false;
    for (const a of list) {
      // done and idle count as one: looking at a finished agent is not the agent doing something.
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s !== s) { this.changed[a.address] = { s, t: now }; dirty = true; }
    }
    const live = new Set(list.map((a) => a.address));
    for (const k of Object.keys(this.changed)) if (!live.has(k)) { delete this.changed[k]; dirty = true; }
    if (dirty) { try { localStorage.setItem("changed", JSON.stringify(this.changed)); } catch {} }
  }

  render() {
    const t = theme(), now = Date.now();
    const redact = !!shared("dungeon.redact");
    const al = shared("dungeon.aliases") ?? {}; // redact mode: show a NetHack item instead of the terminal title
    const hues = [t.ansi1, t.ansi2, t.ansi3, t.ansi4, t.ansi5, t.ansi6, t.ansi9, t.ansi10, t.ansi11, t.ansi12, t.ansi13, t.ansi14];
    const ag = agents(), terms = terminals();
    this.track(ag, now);
    const model = new Map(terms.filter((x) => x.labels?.["herdr.model"]).map((x) => [x.address, x.labels["herdr.model"]]));
    const MARK = { working: ["*", t.working, "working"], blocked: ["!", t.blocked, "needs you"], done: ["$", t.done, "done"], idle: ["z", t.dim, "asleep"] };
    let n = 0;
    // Each agent starts at its hashed slot and moves on to the next free one, so no two entries repeat while the catalog lasts.
    const taken = new Set(), itemOf = new Map();
    for (const a of [...ag].sort((x, y) => (x.address < y.address ? -1 : 1))) {
      let i = (hash(a.address) >> 5) % ITEMS.length;
      for (let k = 0; k < ITEMS.length && taken.has(i); k++) i = (i + 1) % ITEMS.length;
      taken.add(i); itemOf.set(a.address, i);
    }
    // Current level only (if the machine is no longer ready, the map sends you back to the local one).
    const want = shared("dungeon.level") ?? "";
    const curKey = machines().some((m) => (m.name ?? "") === want && m.layout === "ready") ? want : "";
    const groups = spaces().filter((s) => (s.machine ?? "") === curKey).map((s) => ({ s, mine: ag.filter((a) => a.space === s.id) })).filter((g) => g.mine.length);

    return v_flex().id("sheet-root").size_full().bg(t.chrome).p(10).gap(8).overflow_y_scrollbar().font_family(FONT).text_size(13).text_color(t.foreground)
      .child(div().text_color(t.ansi11).font_bold().child("Inventory · " + (redact ? al["m:" + (curKey || shared("dungeon.host") || "local")] ?? "a level" : curKey || shared("dungeon.host") || "local")))
      .children(groups.map(({ s, mine }) => v_flex().gap(4)
        .child(div().text_color(t.accent).child((redact ? al["r:" + s.name] ?? "a room" : s.name) + (s.machine ? "@" + (redact ? al["m:" + s.machine] ?? "a level" : s.machine) : "")))
        .children(mine.map((a) => {
          const hh = hash(a.address), [mk, mc, word] = MARK[a.status] ?? MARK.idle;
          const since = this.changed[a.address]?.t ?? now;
          const meta = [a.app ?? a.program?.name, shortModel(model.get(a.address))].filter(Boolean).join(" · ");
          return v_flex().id(`inv-${a.address}`).gap(0).px(4).py(2).rounded(4)
            .hover((st) => st.bg(t.raised)).on_click(() => run("agent.focus", { terminal: a.address }))
            .child(h_flex().gap(6).whitespace_nowrap()
              .child(div().text_color(t.dim).child(`${LETTERS[n++] ?? "?"} -`))
              .child(div().text_color(hues[(hh >> 3) % hues.length]).font_bold().child(BESTIARY[hh % BESTIARY.length]))
              .child(div().text_color(a.focused ? t.accent : t.foreground).truncate().child(redact ? itemName(a.address, a.status, itemOf.get(a.address)) : (a.title || a.pane_name || a.address))))
            .child(div().pl(36).text_color(t.muted).truncate().child(meta))
            .child(div().pl(36).text_color(mc).child(`${mk} ${word} · ${duration(now - since)}`));
        }))));
  }
}
