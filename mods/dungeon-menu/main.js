import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { run, props, closeOverlay, theme, knownAgents } from "herdr";

// Altar menu: pick who to summon in the room (props: { space, machine }).
export default class DungeonMenu extends View {
  init(_p, cx) {
    this.list = null;
    cx.spawn(async (cx2) => {
      try { this.list = (await knownAgents({ on: props().machine ?? null })).filter((a) => a.installed); }
      catch { this.list = []; }
      cx2.notify();
    });
  }

  render() {
    const t = theme(), p = props();
    const pick = (a) => {
      run("tab.new", a ? { space: p.space, argv: a.run, focus: false } : { space: p.space, focus: false });
      closeOverlay(p.overlay);
    };
    return v_flex().size_full().p(6).gap(2).text_size(14).text_color(t.foreground)
      .child(div().text_color(t.ansi11).px(6).child("Summon at the altar…"))
      .child(div().id("inv-shell").px(6).py(3).rounded(4).hover((s) => s.bg(t.raised)).on_click(() => pick(null)).child("› terminal"))
      .children(this.list === null ? [div().px(6).text_color(t.dim).child("checking…")]
        : this.list.length === 0 ? [div().px(6).text_color(t.blocked).child("no agents installed")]
        : this.list.map((a, i) => div().id(`inv-${i}`).px(6).py(3).rounded(4)
            .hover((s) => s.bg(t.raised)).on_click(() => pick(a)).child(`› ${a.name ?? a.run[0]}`)));
  }
}
