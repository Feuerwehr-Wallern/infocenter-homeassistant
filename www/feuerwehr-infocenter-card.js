/* Feuerwehr Infocenter Lovelace card. Add as a dashboard resource. */
class FeuerwehrInfocenterCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) throw new Error("Bitte entity angeben (z. B. sensor.feuerwehr_infocenter_einsatzliste).");
    this.config = {title:"Feuerwehr Infocenter", active_entity:"sensor.feuerwehr_infocenter_aktive_einsatzliste",
      list_entity:config.entity, stats_entity:"sensor.feuerwehr_infocenter_statistik", ...config};
    this.tab = "active";
    this.attachShadow({mode:"open"});
  }
  set hass(hass) { this._hass=hass; this.render(); }
  get data() {
    const state = id => this._hass?.states?.[id];
    const attrs = id => state(id)?.attributes || {};
    return {active:attrs(this.config.active_entity).operations || [], list:attrs(this.config.list_entity).operations || [],
      stats:attrs(this.config.stats_entity).statistics || {}, activeState:state(this.config.active_entity)};
  }
  esc(v) { return String(v ?? "—").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  date(v) { if(!v) return "Zeit unbekannt"; const d=new Date(v); return isNaN(d) ? this.esc(v) : d.toLocaleString("de-AT",{dateStyle:"short",timeStyle:"short"}); }
  render() {
    if(!this.shadowRoot || !this._hass) return;
    const d=this.data, items=this.tab==="active"?d.active:d.list;
    const rows=items.map(op=>`<article class="op"><span class="dot" style="background:${this.esc(op.type_color || "#777")}"></span><div class="body"><b>${this.esc(op.type_name || "Einsatz")}</b><small>${this.date(op.time_alert)}${op.city_name ? " · "+this.esc(op.city_name):""}</small>${op.alarm_level?`<small>Alarmstufe ${this.esc(op.alarm_level)}</small>`:""}${(op.roles||[]).flatMap(r=>(r.members||[]).map(m=>`${r.role_name||"Funktion"}: ${[m.rank,m.first_name,m.last_name].filter(Boolean).join(" ")}`)).map(line=>`<small>${this.esc(line)}</small>`).join("")}</div>${this.tab==="active"?'<span class="live">AKTIV</span>':""}</article>`).join("");
    const statEntries=Object.entries(d.stats).filter(([k,v])=>!["list","data"].includes(k) && (typeof v==="string"||typeof v==="number"||typeof v==="boolean"));
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;color:var(--primary-text-color)} ha-card{padding:16px;overflow:hidden}
      h2{font-size:18px;margin:0 0 12px}.tabs{display:flex;gap:8px;margin-bottom:12px}
      button{border:0;border-radius:18px;padding:8px 13px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer}
      button.sel{background:var(--primary-color);color:white}.count{font-size:28px;font-weight:700}
      .op{display:flex;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--divider-color)}
      .dot{width:9px;height:36px;border-radius:6px;flex:none}.body{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
      small{color:var(--secondary-text-color)}.live{font-size:10px;font-weight:700;color:var(--error-color)}
      .empty{padding:18px 0;color:var(--secondary-text-color)}.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .stat{background:var(--secondary-background-color);padding:12px;border-radius:10px;overflow-wrap:anywhere}
      .stat b{display:block;font-size:20px}.stat small{display:block;margin-top:4px}
      .foot{font-size:11px;color:var(--secondary-text-color);margin-top:12px}
    </style><ha-card><h2>${this.esc(this.config.title)}</h2>
      <div class="tabs"><button data-tab="active" class="${this.tab==="active"?"sel":""}">Aktiv (${d.active.length})</button>
      <button data-tab="list" class="${this.tab==="list"?"sel":""}">Einsatzliste (${d.list.length})</button>
      <button data-tab="stats" class="${this.tab==="stats"?"sel":""}">Statistik</button></div>
      ${this.tab==="stats"?`<div class="stats">${statEntries.map(([k,v])=>`<div class="stat"><b>${this.esc(v)}</b><small>${this.esc(k.replace(/_/g," "))}</small></div>`).join("") || '<div class="empty">Keine Statistikwerte in der API-Antwort gefunden.</div>'}</div>`:
      `<div class="count">${items.length}</div>${items.length?rows:'<div class="empty">Keine Einsätze vorhanden.</div>'}`}
      <div class="foot">Aktualisierung: ${this.date(d.activeState?.attributes?.updated)}</div></ha-card>`;
    this.shadowRoot.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{this.tab=b.dataset.tab;this.render();}));
  }
  getCardSize(){return 5;}
}
customElements.define("feuerwehr-infocenter-card",FeuerwehrInfocenterCard);
window.customCards=window.customCards||[];
window.customCards.push({type:"feuerwehr-infocenter-card",name:"Feuerwehr Infocenter",description:"Aktive Einsätze, Einsatzliste und Statistik"});
