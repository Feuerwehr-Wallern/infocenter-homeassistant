/* Feuerwehr Infocenter Lovelace card. */
class FeuerwehrInfocenterCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) throw new Error("Bitte entity angeben (z. B. sensor.feuerwehr_infocenter_einsatzliste).");
    this.config = {title:"Feuerwehr Infocenter", active_entity:"sensor.feuerwehr_infocenter_aktive_einsatzliste",
      stats_entity:"sensor.feuerwehr_infocenter_statistik",
      events_entity:"sensor.feuerwehr_infocenter_naechste_termine", events_limit:5, ...config};
    this.tab = "active";
    this.attachShadow({mode:"open"});
  }
  set hass(hass) { this._hass=hass; this.render(); }
  get data() {
    const state = id => this._hass?.states?.[id];
    const attrs = id => state(id)?.attributes || {};
    return {active:attrs(this.config.active_entity).operations || [], list:(attrs(this.config.entity).operations || []).slice(0,5),
      stats:attrs(this.config.stats_entity).statistics || {},
      statsByYear:attrs(this.config.stats_entity).statistics_by_year || {},
      events:(attrs(this.config.events_entity).events || []).filter(ev=>{
        const selected=this.config.events_calendars;
        const name=ev.calendar_name || ev.calendar?.name || "";
        return !Array.isArray(selected) || selected.length===0 || selected.some(x=>String(x).toLowerCase()===String(name).toLowerCase());
      }),
      activeState:state(this.config.active_entity)};
  }
  esc(v) { return String(v ?? "—").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  date(v) { if(!v) return "Zeit unbekannt"; const d=new Date(v); return isNaN(d) ? this.esc(v) : d.toLocaleString("de-AT",{dateStyle:"short",timeStyle:"short"}); }
  renderStats(stats, byYear) {
    const years=Object.keys(byYear||{}).sort((a,b)=>Number(b)-Number(a));
    if(!years.length && !Array.isArray(stats.years)) return '<div class="empty">Keine Statistikdaten vorhanden.</div>';
    if(this.statsMode!=='all' && !years.includes(String(this.statsYear))) this.statsYear=years[0];
    const all=this.statsMode==='all';
    const selected=all?stats:(byYear||{})[String(this.statsYear)]||stats;
    const cats=Array.isArray(selected.statistics)?selected.statistics:[];
    const total=cats.reduce((n,c)=>n+(Number(c.operation_count)||0),0);
    let offset=0;
    const stops=cats.map(c=>{const v=total?(Number(c.operation_count)||0)/total*100:0;const a=offset;offset+=v;return `${c.category_color||'#888'} ${a}% ${offset}%`;}).join(',');
    const donut=`<div class="donut" style="background:conic-gradient(${stops||'var(--divider-color) 0 100%'})"><div class="donut-hole"><b>${total}</b><small>Einsätze</small></div></div>`;
    const legend=cats.map(c=>`<span class="legend-item"><i style="background:${this.esc(c.category_color||'#888')}"></i>${this.esc(c.category_name)} <b>${Number(c.operation_count)||0}</b></span>`).join('');
    let groups=[], labelKey='label', heading='Einsätze je Monat';
    if(all){groups=(stats.years||[]).filter(x=>x&&x.year).sort((a,b)=>Number(a.year)-Number(b.year));labelKey='year';heading='Einsätze je Jahr';}
    else groups=(selected.months||[]).filter(x=>x&&x.month).sort((a,b)=>Number(a.month)-Number(b.month));
    const max=Math.max(1,...groups.map(g=>Number(g.count)||0));
    const bars=groups.map(g=>{const entries=g.statistics||[];const sum=Number(g.count)||entries.reduce((n,c)=>n+(Number(c.operation_count)||0),0);const seg=entries.map(c=>{const v=Number(c.operation_count)||0;return v?`<i title="${this.esc(c.category_name)}: ${v}" style="height:${v/max*100}%;background:${this.esc(c.category_color||'#888')}"></i>`:''}).join('');return `<div class="yearbar"><b>${sum}</b><div class="bartrack">${seg}</div><small>${this.esc(g[labelKey])}</small></div>`}).join('');
    const options=years.map(y=>`<option value="${y}" ${String(this.statsYear)===y?'selected':''}>${y}</option>`).join('');
    return `<div class="stats-switch"><button data-mode="year" class="${all?'':'sel'}">Jahr</button><button data-mode="all" class="${all?'sel':''}">Alle</button></div>${!all?`<div class="year-select"><button data-year-step="-1">‹</button><select id="stats-year">${options}</select><button data-year-step="1">›</button></div>`:''}<div class="stats-top">${donut}<div class="legend">${legend}</div></div><h3>${heading}</h3><div class="year-chart">${bars}</div>`;
  }
  eventRunning(ev, now=Date.now()) {
    const start=Date.parse(ev.start_date);
    const end=Date.parse(ev.end_date_effective || "");
    return Number.isFinite(start) && start<=now && (!Number.isFinite(end) || now<=end);
  }
  eventDate(ev) {
    const start=new Date(ev.start_date);
    if(isNaN(start)) return "Zeit unbekannt";
    const allDay=!!ev.all_day_event;
    const date=start.toLocaleDateString("de-AT");
    if(allDay || (start.getHours()===0 && start.getMinutes()===0)) return date;
    return `${date} ${start.toLocaleTimeString("de-AT",{hour:"2-digit",minute:"2-digit"})}`;
  }
  renderEvents(events) {
    const now=Date.now();
    const sorted=[...events].sort((a,b)=>{
      const ar=this.eventRunning(a,now), br=this.eventRunning(b,now);
      if(ar!==br) return ar?-1:1;
      return Date.parse(a.start_date)-Date.parse(b.start_date);
    }).slice(0,Math.max(1,Number(this.config.events_limit)||5));
    if(!sorted.length) return '<div class="empty">Aktuell keine Termine.</div>';
    return `<ul class="event-list">${sorted.map(ev=>{
      const color=ev.calendar_color || ev.calendar?.color || "#9e9e9e";
      const cal=ev.calendar_name || ev.calendar?.name || "";
      const person=ev.contact_person_name || ev.contact_person?.display_name ||
        [ev.contact_person?.rank,ev.contact_person?.last_name].filter(Boolean).join(" ");
      const running=this.eventRunning(ev,now);
      return `<li class="event ${running?"running":""}" style="--event-color:${this.esc(color)}">
        <span class="event-dot ${running?"blink":""}">●</span><div class="event-body">
        <b>${this.esc(ev.title)}</b><small>🕑 ${this.esc(this.eventDate(ev))}</small>
        ${ev.location?`<small>📍 ${this.esc(ev.location)}</small>`:""}
        ${person?`<small>👤 ${this.esc(person)}</small>`:""}
        ${ev.description?`<small>ℹ️ ${this.esc(ev.description)}</small>`:""}
        ${cal?`<small>📅 ${this.esc(cal)}</small>`:""}
        </div>${running?'<span class="live">LÄUFT</span>':""}</li>`;
    }).join("")}</ul>`;
  }
  render() {
    if(!this.shadowRoot || !this._hass) return;
    const d=this.data, items=this.tab==="active"?d.active:d.list;
    const rows=items.map(op=>`<article class="op"><span class="dot" style="background:${this.esc(op.type_color || "#777")}"></span><div class="body"><b>${this.esc(op.type_name || "Einsatz")}</b><small>${this.date(op.time_alert)}${op.city_name ? " · "+this.esc(op.city_name):""}</small>${op.alarm_level?`<small>Alarmstufe ${this.esc(op.alarm_level)}</small>`:""}${(op.roles||[]).flatMap(r=>(r.members||[]).map(m=>`${r.role_name||"Funktion"}: ${[m.rank,m.first_name,m.last_name].filter(Boolean).join(" ")}`)).map(line=>`<small>${this.esc(line)}</small>`).join("")}</div>${this.tab==="active"?'<span class="live">AKTIV</span>':""}</article>`).join("");
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;color:var(--primary-text-color)}ha-card{padding:16px;overflow:hidden}h2{font-size:18px;margin:0 0 12px}
      .tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}button{border:0;border-radius:18px;padding:8px 13px;background:var(--secondary-background-color);color:var(--primary-text-color);cursor:pointer}button.sel{background:var(--primary-color);color:white}
      .op{display:flex;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--divider-color)}.dot{width:9px;height:36px;border-radius:6px;flex:none}.body{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
      .event-list{list-style:none;padding:0;margin:0}.event{margin-bottom:8px;padding:8px 10px;background:var(--secondary-background-color);border-radius:8px;border:1px solid var(--event-color);display:flex;align-items:center;gap:10px}
      .event-dot{font-size:20px;line-height:1;color:var(--event-color);flex:none}.event-body{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.event-body small{font-size:11px;color:var(--secondary-text-color)}
      .blink{animation:fw-blink 1.2s linear infinite;transform-origin:center}@keyframes fw-blink{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}}
      small{color:var(--secondary-text-color)}.live{font-size:10px;font-weight:700;color:var(--error-color)}.empty{padding:18px 0;color:var(--secondary-text-color)}
      .chart-head{display:flex;justify-content:space-between;align-items:center;margin:4px 0 12px}.chart-head span{color:var(--secondary-text-color);font-size:13px}.chart{height:190px;display:flex;align-items:stretch;gap:5px;border-bottom:1px solid var(--divider-color);padding:0 2px}
      .month{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px}.month-total{font-size:11px;font-weight:500;color:var(--secondary-text-color)}.bar-wrap{height:145px;width:100%;display:flex;align-items:flex-end;justify-content:center}.bar{width:min(25px,85%);height:100%;display:flex;flex-direction:column-reverse;justify-content:flex-start;border-radius:4px 4px 0 0;overflow:hidden;background:var(--secondary-background-color)}.segment{width:100%;min-height:0}.month small{font-size:10px;white-space:nowrap}
      .stats-switch,.year-select{display:flex;gap:8px;align-items:center;margin:8px 0 12px}.year-select{justify-content:center}.year-select select{padding:7px;border:1px solid var(--divider-color);border-radius:6px;background:var(--card-background-color);color:var(--primary-text-color)}.stats-top{display:flex;align-items:center;gap:20px;flex-wrap:wrap}.donut{width:170px;height:170px;border-radius:50%;display:grid;place-items:center;flex:none}.donut-hole{width:105px;height:105px;border-radius:50%;background:var(--card-background-color);display:flex;flex-direction:column;align-items:center;justify-content:center}.donut-hole b{font-size:26px}.donut-hole small{font-size:11px}.legend{display:flex;gap:8px 14px;flex-wrap:wrap;margin-top:14px}.year-chart{height:210px;display:flex;align-items:flex-end;gap:7px;overflow-x:auto;border-bottom:1px solid var(--divider-color)}.yearbar{height:100%;min-width:30px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}.bartrack{height:160px;width:min(26px,90%);display:flex;flex-direction:column-reverse;justify-content:flex-start;overflow:hidden;border-radius:4px 4px 0 0;background:var(--secondary-background-color)}.bartrack i{display:block;width:100%;min-height:0}.yearbar small,.yearbar b{font-size:10px;white-space:nowrap}.legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--secondary-text-color)}.legend-item i{width:9px;height:9px;border-radius:2px;display:inline-block}.foot{font-size:11px;color:var(--secondary-text-color);margin-top:12px}
    </style><ha-card><h2>${this.esc(this.config.title)}</h2><div class="tabs"><button data-tab="active" class="${this.tab==="active"?"sel":""}">Aktiv (${d.active.length})</button><button data-tab="list" class="${this.tab==="list"?"sel":""}">Einsatzliste (max. 5)</button><button data-tab="stats" class="${this.tab==="stats"?"sel":""}">Statistik</button><button data-tab="events" class="${this.tab==="events"?"sel":""}">Nächste Termine</button></div>
      ${this.tab==="stats"?this.renderStats(d.stats,d.statsByYear):this.tab==="events"?this.renderEvents(d.events):`<div>${items.length?rows:'<div class="empty">Keine Einsätze vorhanden.</div>'}</div>`}<div class="foot">Aktualisierung: ${this.date(d.activeState?.attributes?.updated)}</div></ha-card>`;
    this.shadowRoot.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.tab){this.tab=b.dataset.tab;}if(b.dataset.mode){this.statsMode=b.dataset.mode;}if(b.dataset.yearStep){const ys=Object.keys(d.statsByYear||{}).sort((a,b)=>Number(b)-Number(a));let i=ys.indexOf(String(this.statsYear||ys[0]));this.statsYear=ys[Math.max(0,Math.min(ys.length-1,i-Number(b.dataset.yearStep)))];}this.render();}));
    const yearSelect=this.shadowRoot.querySelector('#stats-year');if(yearSelect)yearSelect.addEventListener('change',e=>{this.statsYear=e.target.value;this.render();});
  }
  getCardSize(){return 6;}
}
customElements.define("feuerwehr-infocenter-card",FeuerwehrInfocenterCard);
window.customCards=window.customCards||[];window.customCards.push({type:"feuerwehr-infocenter-card",name:"Feuerwehr Infocenter",description:"Aktive Einsätze, Einsatzliste und Monatsstatistik"});
