import { View, div } from "gpui-kit";
import { agents, spaces, machines, theme, run, shared, setShared } from "herdr";

export default class DungeonStatus extends View {
  // Redact mode survives restarts: restore it into the shared state.
  init() { try { if (localStorage.getItem("redact") === "1") setShared("dungeon.redact", true); } catch {} }

  render() {
    const t = theme(), a = agents();
    const n = (s) => a.filter((x) => x.status === s).length;
    const ms = machines().map((m) => ({ key: m.name ?? "", ok: m.layout === "ready" }))
      .sort((a, b) => (a.key === "" ? -1 : b.key === "" ? 1 : a.key.localeCompare(b.key)));
    const want = shared("dungeon.level") ?? "";
    const at = Math.max(0, ms.findIndex((m) => m.key === want && m.ok));
    const lvName = ms[at]?.key || shared("dungeon.host") || "local";
    const dl = `${at + 1}/${ms.length} ${shared("dungeon.redact") ? (shared("dungeon.aliases") ?? {})["m:" + lvName] ?? "a level" : lvName}`;
    return div().size_full().bg(t.chrome).px(12).flex().items_center().gap(18).text_size(14).text_color(t.foreground)
      .child(`Dlvl:${dl}`).child(`Rooms:${spaces().length}`).child(`Agents:${a.length}`)
      .child(div().text_color(t.working).child(`HP:${n("working")}`))
      .child(div().text_color(t.blocked).child(`⚠:${n("blocked")}`))
      .child(div().text_color(t.done).child(`$:${n("done")}`))
      .child(div().text_color(t.idle).child(`z:${n("idle")}`))
      .child(div().flex_1())
      .child(div().id("st-redact").px(8).rounded(4).text_color(shared("dungeon.redact") ? t.accent : t.muted).hover((x) => x.bg(t.raised))
        .on_click(() => { const on = !shared("dungeon.redact"); setShared("dungeon.redact", on); try { localStorage.setItem("redact", on ? "1" : "0"); } catch {} })
        .child(shared("dungeon.redact") ? "◉ Redact" : "◐ Redact"))
      .child(div().id("st-layout").px(8).rounded(4).text_color(t.muted).hover((x) => x.bg(t.raised)).on_click(() => run("layout.switch")).child("⇄ Layout"))
      .child(div().id("st-settings").px(8).rounded(4).text_color(t.accent).hover((x) => x.bg(t.raised)).on_click(() => run("app.settings")).child("⚙ Settings"));
  }
}
