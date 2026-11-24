// Estilos da versão desktop (só web). Os tokens são os da app (src/lib/theme.ts, Identidade visual v1.0).
export const CSS = `
:root { --navy:#1B3A57; --green:#2D7D46; --greenL:#E8F2EB; --orange:#C2611F; --ground:#F2F4F6; --card:#FFFFFF; --muted:#6B7785; --line:#E6E9ED; --label:#1C2530;
  --ink2:#3B4754; --hover:#F7FAF8; --sel:#EFF6F1; --soft:#FAFBFC; --soft2:#EEF1F4; --soft3:#DDE5EC; --ctl:#D5DAE0; --faint:#B3BBC4; --side:rgba(255,255,255,.72);
  --thumb:#FFFFFF; --warnInk:#9C4C16; --dangerBg:#FDF3F2; --dangerLine:#F1C9C5; --danger:#B42318; color-scheme: light; }
/* Tema escuro (o mesmo interruptor do Perfil; guardado como na app). */
:root[data-theme="dark"] { --navy:#8DB3D8; --green:#3DA05C; --greenL:rgba(61,160,92,.18); --orange:#E08A4A; --ground:#0E1822; --card:#16222E; --muted:#8EA0B2; --line:#243443; --label:#E6EDF3;
  --ink2:#C2CEDA; --hover:#1B2A38; --sel:#1C3328; --soft:#13202B; --soft2:#22313F; --soft3:#2C3E4F; --ctl:#3A4B5C; --faint:#5C6E80; --side:rgba(18,29,40,.85);
  --thumb:#2A3B4C; --warnInk:#F0A26B; --dangerBg:#2A1715; --dangerLine:#5A2A25; --danger:#F07468; color-scheme: dark; }
html, body { background: var(--ground); }
.pf * { box-sizing: border-box; }
.pf { font-family: Inter_400Regular, Inter, -apple-system, system-ui, sans-serif; color: var(--label); }
.pf b, .pf strong, .pf .w7 { font-family: Inter_700Bold, Inter, system-ui, sans-serif; font-weight: 700; }
.pf .w6 { font-family: Inter_600SemiBold, Inter, system-ui, sans-serif; font-weight: 600; }
.pf .w8 { font-family: Inter_800ExtraBold, Inter, system-ui, sans-serif; font-weight: 800; }
.pf button { font: inherit; cursor: pointer; }
.pf button:focus-visible, .pf a:focus-visible, .pf input:focus-visible { outline: 3px solid rgba(45,125,70,.45); outline-offset: 2px; }
.pf-ground { position: fixed; inset: 0; background: var(--ground); overflow: hidden; }
.pf-ground:before { content: ""; position: absolute; width: 760px; height: 760px; border-radius: 50%; background: rgba(45,125,70,.09); right: -200px; top: -260px; }
.pf-ground:after { content: ""; position: absolute; width: 560px; height: 560px; border-radius: 50%; background: rgba(194,97,31,.07); left: 120px; bottom: -330px; }

/* ---------- shell ---------- */
.pf-app { position: absolute; inset: 0; display: flex; }
.pf-side { width: 248px; flex: none; padding: 28px 18px 22px; display: flex; flex-direction: column; background: var(--side); border-right: 1px solid var(--line); position: relative; z-index: 2; }
.pf-brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 26px; }
.pf-brand img { width: 34px; height: 34px; border-radius: 9px; }
.pf-word { font-size: 23px; letter-spacing: -.5px; color: var(--navy); } .pf-word span { color: var(--green); }
.pf-nav button { width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 12px; border: 0; background: none; border-radius: 12px; font-size: 15.5px; color: var(--ink2); margin-bottom: 3px; text-align: left; }
.pf-nav button:hover { background: rgba(27,58,87,.05); }
.pf-nav button.on { background: var(--greenL); color: var(--green); }
.pf-nav svg { width: 21px; height: 21px; flex: none; }
.pf-org { margin-top: auto; padding: 12px; border-radius: 14px; background: var(--card); border: 1px solid var(--line); font-size: 13px; color: var(--muted); }
.pf-org b { display: block; color: var(--label); font-size: 14.5px; margin-top: 2px; }
.pf-role { display: inline-block; margin-top: 8px; font-size: 12px; color: var(--green); background: var(--greenL); padding: 3px 9px; border-radius: 8px; }
.pf-role.pending { color: var(--warnInk); background: rgba(194,97,31,.12); }
.pf-me { display: flex; align-items: center; gap: 10px; padding: 14px 4px 0; }
.pf-me .who { border: 0; background: none; display: flex; align-items: center; gap: 10px; padding: 0; text-align: left; min-width: 0; flex: 1; }
.pf-av { width: 40px; height: 40px; border-radius: 50%; background: var(--green); color: #fff; font-size: 15px; display: flex; align-items: center; justify-content: center; flex: none; }
.pf-me .n { font-size: 14.5px; color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .pf-me .e { font-size: 12.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
.pf-dev { width: 40px; height: 40px; flex: none; border-radius: 12px; border: 1px solid var(--line); background: var(--card); display: flex; align-items: center; justify-content: center; color: var(--navy); position: relative; }
.pf-dev:hover { border-color: var(--green); color: var(--green); }
.pf-dev svg { width: 21px; height: 21px; }
.pf-dev .tip { position: absolute; left: 50%; bottom: 50px; transform: translateX(-50%); white-space: nowrap; background: #1B3A57; color: #fff; font-size: 12.5px; padding: 6px 10px; border-radius: 8px; opacity: 0; pointer-events: none; transition: opacity .15s; }
.pf-dev:hover .tip, .pf-dev:focus-visible .tip { opacity: 1; }
.pf-main { flex: 1; position: relative; overflow: auto; }
.pf-page { padding: 34px 40px 40px; position: relative; z-index: 1; max-width: 1280px; }
.pf h1 { font-size: 34px; letter-spacing: -.8px; margin: 0; color: var(--label); }
.pf-sub { color: var(--muted); font-size: 14.5px; margin-top: 4px; }
.pf-row { display: flex; gap: 20px; margin-top: 26px; }
.pf-card { background: var(--card); border-radius: 20px; border: 1px solid var(--line); }
.pf-histtbl { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; } .pf-histtbl th { text-align: left; color: var(--muted); font-weight: 600; padding: 4px 4px 4px 0; } .pf-histtbl td { padding: 5px 4px 5px 0; border-top: 1px solid var(--line); }
.pf-hero { flex: 1.25; padding: 26px 28px; display: flex; align-items: center; justify-content: space-between; }
.pf-k { font-size: 14px; color: var(--green); }
.pf-big { font-size: 64px; letter-spacing: -2px; margin-top: 4px; line-height: 1.05; } .pf-big small { font-size: 26px; letter-spacing: 0; color: var(--ink2); margin-left: 6px; }
.pf-ring { width: 118px; height: 118px; border-radius: 50%; border: 11px solid var(--green); display: flex; flex-direction: column; align-items: center; justify-content: center; flex: none; }
.pf-ring b { font-size: 24px; } .pf-ring span { font-size: 11px; color: var(--muted); letter-spacing: .5px; }
.pf-stats { flex: 1; display: grid; grid-template-columns: 1fr 1fr; }
.pf-stat { padding: 20px 22px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); } .pf-stat:nth-child(2n) { border-right: 0; } .pf-stat:nth-child(n+3) { border-bottom: 0; }
.pf-stat b { font-size: 30px; letter-spacing: -.6px; } .pf-stat span { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; }
.pf-sect { font-size: 13px; color: var(--muted); margin: 26px 0 10px 6px; letter-spacing: .3px; }
.pf-list .it { width: 100%; display: flex; align-items: center; gap: 14px; padding: 13px 18px; border: 0; border-bottom: 1px solid var(--line); background: none; font-size: 15px; text-align: left; color: var(--label); }
.pf-list .it:last-child { border-bottom: 0; } .pf-list .it:hover { background: var(--hover); } .pf-list .it.sel { background: var(--sel); }
.pf-ico { width: 34px; height: 34px; border-radius: 10px; background: var(--greenL); display: flex; align-items: center; justify-content: center; color: var(--green); flex: none; } .pf-ico svg { width: 18px; height: 18px; }
.pf-list .t span { display: block; font-size: 12.5px; color: var(--muted); margin-top: 1px; }
.pf-list .w { margin-left: auto; text-align: right; font-size: 17px; } .pf-list .w span { display: block; font-size: 11px; color: var(--muted); }
.pf-chev { color: var(--faint); width: 16px; flex: none; }
.pf-bars { display: flex; align-items: flex-end; gap: 10px; height: 170px; padding: 18px 22px 0; }
.pf-bars i { flex: 1; background: var(--green); border-radius: 6px 6px 0 0; opacity: .85; min-height: 3px; } .pf-bars i.m { background: var(--navy); opacity: .9; }
.pf-axis { display: flex; gap: 10px; padding: 8px 22px 16px; font-size: 11.5px; color: var(--muted); } .pf-axis span { flex: 1; text-align: center; }
.pf-note { display: flex; gap: 10px; align-items: center; padding: 14px 18px; font-size: 13.5px; color: var(--ink2); } .pf-note svg { color: var(--navy); width: 20px; flex: none; }
.pf-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
.pf-search { display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 12px; background: rgba(118,118,128,.12); color: var(--muted); width: 380px; }
.pf-search input { border: 0; background: none; font: inherit; font-size: 14.5px; padding: 11px 0; flex: 1; outline: none; color: var(--label); }
.pf-sheet { width: 400px; flex: none; padding: 24px; align-self: flex-start; position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow: auto; }
.pf-sheet-name { display: flex; align-items: center; gap: 8px; }
.pf-sexicon { display: inline-flex; width: 24px; height: 24px; } .pf-sexicon svg { width: 100%; height: 100%; stroke-width: 2.4; }
.pf-sexicon.female, .pf-sex.female, .pf-sexpick .female.on { color: var(--warnInk); } .pf-sexicon.male, .pf-sex.male, .pf-sexpick .male.on { color: var(--navy); }
.pf-sex { display: inline-flex; align-items: center; gap: 5px; } .pf-sex svg, .pf-sexpick svg { width: 14px; height: 14px; }
.pf-sexpick { display: inline-flex; padding: 2px; border-radius: 9px; background: var(--soft2); }
.pf-sexpick button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: none; padding: 4px 10px; border-radius: 7px; font-size: 12px; color: var(--muted); cursor: pointer; }
.pf-sexpick button.on { background: var(--card); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.pf-badge { display: inline-flex; gap: 6px; align-items: center; font-size: 12px; color: var(--green); background: var(--greenL); padding: 4px 10px; border-radius: 8px; }
.pf-est { margin-top: 18px; border-radius: 16px; border: 1px solid var(--line); padding: 18px 20px; }
.pf-est .lbl { font-size: 13px; color: var(--green); } .pf-est .exp { font-size: 12px; color: var(--warnInk); background: rgba(194,97,31,.12); padding: 2px 8px; border-radius: 6px; margin-left: 6px; }
.pf-est .num { font-size: 52px; letter-spacing: -1.5px; margin-top: 6px; } .pf-est .num small { font-size: 22px; color: var(--ink2); }
.pf-est p { font-size: 13px; color: var(--muted); margin: 6px 0 0; }
.pf-kv div { display: flex; justify-content: space-between; padding: 11px 2px; border-bottom: 1px solid var(--line); font-size: 14.5px; } .pf-kv div span:last-child { color: var(--ink2); }
.pf-empty { padding: 40px 24px; text-align: center; color: var(--muted); font-size: 14.5px; }
.pf-embed { position: relative; max-width: 760px; margin: 0 auto; height: 100%; }

/* ---------- transições entre páginas ---------- */
.pf-pagein { animation: pfIn .38s cubic-bezier(.2,.8,.2,1); }
@keyframes pfIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes pfGrowY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes pfGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes pfDot { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
@keyframes pfPanel { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
@keyframes pfPulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

/* ---------- analytics ---------- */
.pf-pills { position: relative; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); background: rgba(118,118,128,.12); border-radius: 12px; padding: 3px; min-width: 420px; }
.pf-pills button { position: relative; z-index: 1; border: 0; background: none; padding: 9px 14px; font-size: 14px; color: var(--ink2); border-radius: 10px; white-space: nowrap; transition: color .2s; }
.pf-pills button.on { color: var(--label); }
.pf-pills .thumb { position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / var(--n)); background: var(--thumb); border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,.1); transform: translateX(calc(100% * var(--i))); transition: transform .35s cubic-bezier(.3,.9,.3,1); }
.pf-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 26px; }
.pf-kpi { padding: 20px 22px; animation: pfIn .45s cubic-bezier(.2,.8,.2,1) both; }
.pf-kpi:nth-child(2) { animation-delay: .05s } .pf-kpi:nth-child(3) { animation-delay: .1s } .pf-kpi:nth-child(4) { animation-delay: .15s }
.pf-kpi .v { font-size: 40px; letter-spacing: -1.2px; margin-top: 4px; line-height: 1.1; font-variant-numeric: tabular-nums; } .pf-kpi .v small { font-size: 18px; letter-spacing: 0; color: var(--ink2); margin-left: 5px; }
.pf-cov { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pf-cov circle:last-of-type { transition: stroke-dashoffset .1s linear; }
.pf-pad { padding: 18px 22px 16px; }
.pf-hist-tip { font-size: 13.5px; color: var(--muted); min-height: 20px; } .pf-hist-tip b { color: var(--label); }
.pf-hist { position: relative; display: flex; align-items: flex-end; gap: 6px; height: 210px; margin-top: 12px; }
.pf-hist .b { flex: 1; height: 100%; border: 0; background: none; padding: 0; display: flex; align-items: flex-end; border-radius: 6px; }
.pf-hist .b i { display: block; width: 100%; min-height: 3px; background: var(--green); opacity: .82; border-radius: 6px 6px 2px 2px; transform-origin: bottom; animation: pfGrowY .6s cubic-bezier(.2,.8,.2,1) both; transition: opacity .15s, background .15s; }
.pf-hist .b:hover i, .pf-hist .b.on i { opacity: 1; background: #24683A; }
.pf-hist .avg { position: absolute; top: -6px; bottom: 0; width: 0; border-left: 2px dashed var(--navy); pointer-events: none; animation: pfIn .5s .35s both; }
.pf-hist .avg span { position: absolute; top: -4px; left: 6px; white-space: nowrap; font-size: 12px; color: var(--navy); background: var(--card); padding: 2px 6px; border-radius: 6px; }
.pf-hist-axis { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-top: 8px; }
.pf-breeds .r { padding: 10px 0; border-bottom: 1px solid var(--line); } .pf-breeds .r:last-child { border-bottom: 0; }
.pf-breeds .l { display: flex; justify-content: space-between; gap: 12px; font-size: 14.5px; } .pf-breeds .l span:last-child { color: var(--muted); font-size: 13px; }
.pf-breeds .bar { height: 8px; border-radius: 4px; background: var(--soft2); margin-top: 8px; overflow: hidden; }
.pf-breeds .bar i { display: block; height: 100%; background: var(--navy); border-radius: 4px; transform-origin: left; animation: pfGrowX .6s cubic-bezier(.2,.8,.2,1) both; }
.pf-mini { display: flex; gap: 28px; margin-bottom: 10px; } .pf-mini span { display: block; font-size: 13px; color: var(--muted); } .pf-mini b { font-size: 24px; letter-spacing: -.5px; } .pf-mini small { font-size: 14px; color: var(--ink2); }
.pf-scatter { width: 100%; height: auto; display: block; margin-top: 6px; }
.pf-scatter .ax { font-size: 11px; fill: var(--muted); }
.pf-scatter .grid { stroke: var(--line); stroke-dasharray: 3 4; }
.pf-scatter .ax.tt { font-size: 11.5px; fill: var(--ink2); font-family: Inter_600SemiBold, Inter, sans-serif; }
.pf-scatter .trend { stroke: var(--orange); stroke-width: 2; stroke-dasharray: 6 5; fill: none; opacity: .85; animation: pfFade .6s .3s both; }
.pf-scatter .guide { stroke: var(--navy); stroke-width: 1; stroke-dasharray: 2 3; opacity: .55; }
.pf-scatter .dotg { cursor: pointer; }
.pf-scatter .dot { fill: var(--green); fill-opacity: .8; stroke: var(--card); stroke-width: 2; transform-box: fill-box; transform-origin: center; animation: pfDot .4s cubic-bezier(.2,.8,.3,1.3) both; transition: r .15s, fill .15s; }
.pf-scatter .dot.on { fill: var(--navy); fill-opacity: 1; }
.pf-disclaimer { margin-top: 18px; color: var(--muted); } .pf-disclaimer svg { color: var(--muted); }
.pf-note span { min-width: 0; line-height: 1.45; }
.pf-rank { width: 30px; height: 30px; border-radius: 9px; background: var(--greenL); color: var(--green); display: flex; align-items: center; justify-content: center; font-size: 14px; flex: none; }
.pf-foot { font-size: 13px; color: var(--muted); margin: 14px 6px 0; line-height: 1.5; max-width: 760px; }

/* ---------- settings ---------- */
.pf-settings { align-items: flex-start; }
.pf-secnav { position: relative; width: 270px; flex: none; display: flex; flex-direction: column; gap: 4px; }
.pf-secnav button { position: relative; z-index: 1; display: flex; gap: 12px; align-items: center; height: 64px; padding: 0 14px; border: 0; background: none; border-radius: 14px; text-align: left; color: var(--ink2); transition: color .2s; }
.pf-secnav button:hover:not(.on) { background: rgba(27,58,87,.04); }
.pf-secnav button.on { color: var(--green); }
.pf-secnav b { display: block; font-size: 15px; } .pf-secnav small { display: block; font-size: 12.5px; color: var(--muted); margin-top: 1px; }
.pf-secnav .ic { width: 36px; height: 36px; border-radius: 10px; background: var(--card); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; flex: none; transition: background .25s, border-color .25s; } .pf-secnav .ic svg { width: 19px; height: 19px; }
.pf-secnav button.on .ic { background: var(--greenL); border-color: transparent; }
.pf-secnav .thumb { position: absolute; left: 0; right: 0; top: 0; height: 64px; border-radius: 14px; background: var(--card); border: 1px solid var(--line); box-shadow: 0 6px 18px rgba(27,58,87,.07); transform: translateY(calc(68px * var(--i))); transition: transform .38s cubic-bezier(.3,.9,.3,1); }
.pf-secpanel { flex: 1; min-width: 0; max-width: 760px; animation: pfPanel .34s cubic-bezier(.2,.8,.2,1); }
.pf-secpanel h2 { font-size: 22px; letter-spacing: -.4px; margin: 4px 0 14px 4px; }
.pf-set .row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 20px; border-bottom: 1px solid var(--line); font-size: 15px; min-height: 64px; }
.pf-set .row:last-child { border-bottom: 0; } .pf-set .row .pf-sub { font-size: 13.5px; margin-top: 2px; } .pf-set .val { color: var(--ink2); text-align: right; }
.pf-switch { position: relative; width: 50px; height: 30px; border-radius: 15px; border: 0; background: var(--ctl); flex: none; transition: background .25s; padding: 0; }
.pf-switch .knob { position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: var(--card); box-shadow: 0 2px 5px rgba(0,0,0,.2); transition: transform .3s cubic-bezier(.3,1.3,.5,1); }
.pf-switch.on { background: var(--green); } .pf-switch.on .knob { transform: translateX(20px); }
.pf-switch:active .knob { width: 28px; } .pf-switch.on:active .knob { transform: translateX(16px); }
.pf-status { display: flex; align-items: center; gap: 8px; color: var(--ink2); }
.pf-status .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--faint); transition: background .25s; }
.pf-status .dot.online { background: var(--green); } .pf-status .dot.offline { background: #B42318; } .pf-status .dot.checking { background: var(--orange); animation: pfPulse 1s infinite; }
.pf-link { border: 0; background: none; color: var(--green); font-size: 13.5px; margin-left: 8px; padding: 4px 6px; border-radius: 6px; } .pf-link:hover { background: var(--greenL); } .pf-link:disabled { opacity: .5; cursor: default; }
.pf-btn.r { background: #B42318; color: #fff; } .pf-btn.r:hover { background: #9A1D14; }
.pf-btn.r-l { background: var(--card); color: var(--danger); border: 1px solid var(--dangerLine); } .pf-btn.r-l:hover:not(:disabled) { background: var(--dangerBg); } .pf-btn.r-l:disabled { opacity: .5; cursor: default; }
.pf-btn { transition: background .15s, transform .1s; } .pf-btn:active:not(:disabled) { transform: scale(.97); }

@media (prefers-reduced-motion: reduce) {
  .pf-pagein, .pf-kpi, .pf-hist .b i, .pf-hist .avg, .pf-breeds .bar i, .pf-scatter circle, .pf-secpanel { animation: none !important; }
  .pf-pills .thumb, .pf-secnav .thumb, .pf-switch, .pf-switch .knob { transition: none !important; }
}

/* ---------- home ---------- */
.pf-actions { display: flex; gap: 10px; }
.pf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; } .pf-btn svg { width: 17px; height: 17px; }
.pf-btn.l:hover { border-color: var(--green); color: var(--green); }
.pf-secthead { display: flex; align-items: baseline; justify-content: space-between; } .pf-secthead .pf-link { margin-right: 2px; }
.pf-rise { animation: pfIn .4s cubic-bezier(.2,.8,.2,1) both; }
.pf-list .nm { display: inline !important; font-size: 15px !important; color: var(--label) !important; margin: 0 !important; }
.pf-sync { display: flex; align-items: center; gap: 18px; padding: 18px 22px; }
.pf-i { width: 15px; display: inline-flex; color: var(--green); }

/* ---------- herd ---------- */
.pf-toolbar { display: flex; align-items: center; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
.pf-toolbar .pf-pills { min-width: 0; }
.pf-sortlbl { margin-left: auto; font-size: 13px; color: var(--muted); }
.pf-table { overflow: hidden; outline: none; }
.pf-table:focus-visible { box-shadow: 0 0 0 3px rgba(45,125,70,.35); }
.pf-table .hd, .pf-table .tr { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) 110px 150px; align-items: center; gap: 12px; padding: 0 20px; }
.pf-table .hd { height: 42px; font-size: 12.5px; color: var(--muted); border-bottom: 1px solid var(--line); background: var(--soft); }
.pf-table .r { text-align: right; justify-self: end; }
.pf-table .tr { width: 100%; height: 58px; border: 0; border-bottom: 1px solid var(--line); background: none; text-align: left; font-size: 14.5px; color: var(--label); position: relative; transition: background .15s; }
.pf-table .tr:last-child { border-bottom: 0; } .pf-table .tr:hover { background: var(--hover); }
.pf-table .tr.sel { background: var(--sel); } .pf-table .tr.sel:before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: var(--green); }
.pf-table .nm { min-width: 0; } .pf-table .nm b, .pf-table .nm small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-table .nm b { font-size: 15px; } .pf-table .nm small { font-size: 12.5px; color: var(--muted); margin-top: 1px; }
.pf-table .br { color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-table .wt { position: relative; display: flex; align-items: baseline; gap: 4px; padding-bottom: 6px; min-width: 110px; justify-content: flex-end; }
.pf-table .wt b { font-size: 17px; } .pf-table .wt small { font-size: 11.5px; color: var(--muted); }
.pf-table .wt i { position: absolute; right: 0; bottom: 0; height: 3px; border-radius: 2px; background: var(--green); opacity: .35; transform-origin: right; animation: pfGrowX .5s cubic-bezier(.2,.8,.2,1) both; }
.pf-table .tr.sel .wt i { opacity: .8; }
.pf-sheetin { animation: pfPanel .32s cubic-bezier(.2,.8,.2,1); }
.pf-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.pf-tag { font-size: 12px; color: var(--ink2); background: var(--soft2); padding: 4px 10px; border-radius: 8px; }
.pf-delta { display: inline-block; margin-top: 8px; font-size: 13px; padding: 4px 10px; border-radius: 8px; }
.pf-delta.up { color: var(--green); background: var(--greenL); } .pf-delta.down { color: var(--warnInk); background: rgba(194,97,31,.12); }
.pf-cmp { padding: 10px 2px 12px; border-bottom: 1px solid var(--line); } .pf-cmp:last-of-type { border-bottom: 0; }
.pf-cmp .l { display: flex; justify-content: space-between; font-size: 14.5px; }
.pf-cmp .track { position: relative; height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--soft2), var(--soft3)); margin: 10px 0 6px; }
.pf-cmp .avg { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; background: var(--navy); opacity: .5; border-radius: 1px; }
.pf-cmp .dot { position: absolute; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; background: var(--green); border: 3px solid var(--card); box-shadow: 0 2px 6px rgba(0,0,0,.2); animation: pfSlideDot .6s cubic-bezier(.2,.8,.2,1) both; }
@keyframes pfSlideDot { from { left: 0; opacity: 0; } }
.pf-cmp .ax { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .pf-rise, .pf-sheetin, .pf-table .wt i, .pf-cmp .dot { animation: none !important; } }

/* ---------- perfil ---------- */
.pf-theme { position: relative; display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 16px 0 6px; border-radius: 22px; border: 1px solid var(--line); background: var(--card); color: var(--ink2); }
.pf-theme .ic { position: absolute; top: 6px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; z-index: 1; transition: color .3s, transform .4s cubic-bezier(.3,1.3,.5,1); } .pf-theme .ic svg { width: 17px; height: 17px; }
.pf-theme .sun { left: 6px; color: #fff; } .pf-theme .moon { left: 38px; color: var(--muted); }
.pf-theme .knob { width: 32px; height: 32px; border-radius: 50%; background: var(--orange); box-shadow: 0 3px 10px rgba(194,97,31,.35); transition: transform .4s cubic-bezier(.3,1.3,.5,1), background .3s; }
.pf-theme:before { content: ""; width: 64px; height: 32px; border-radius: 16px; background: var(--soft2); position: absolute; left: 6px; top: 6px; }
.pf-theme .knob { position: relative; z-index: 0; }
.pf-theme .lbl { margin-left: 40px; font-size: 14px; min-width: 34px; }
.pf-theme.dark .knob { transform: translateX(32px); background: #5B7FB0; box-shadow: 0 3px 10px rgba(91,127,176,.45); }
.pf-theme.dark .sun { color: var(--muted); transform: rotate(-90deg); } .pf-theme.dark .moon { color: #fff; transform: rotate(-20deg); }
.pf-theme:hover { border-color: var(--green); }
.pf-me-card { flex: 1.3; display: flex; gap: 24px; align-items: center; padding: 26px 28px; min-width: 0; }
.pf-me-card .nm { font-size: 28px; letter-spacing: -.6px; display: flex; align-items: center; gap: 10px; }
.pf-avatar-xl { position: relative; width: 104px; height: 104px; flex: none; }
.pf-avatar-xl .in { position: absolute; inset: 8px; border-radius: 50%; background: var(--green); color: #fff; font-size: 34px; display: flex; align-items: center; justify-content: center; animation: pfPop .5s cubic-bezier(.2,.9,.3,1.3) both; }
.pf-avatar-xl .ring { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(var(--green), var(--orange), var(--navy), var(--green)); -webkit-mask: radial-gradient(circle, transparent 48px, #000 49px); mask: radial-gradient(circle, transparent 48px, #000 49px); animation: pfSpin 6s linear infinite, pfFade .6s both; }
@keyframes pfSpin { to { transform: rotate(360deg); } }
.pf-saved { font-size: 12px; color: var(--green); background: var(--greenL); padding: 3px 9px; border-radius: 8px; letter-spacing: 0; animation: pfPop .3s both; }
.pf-edit { animation: pfIn .3s cubic-bezier(.2,.8,.2,1); } .pf-edit .flds { display: flex; gap: 12px; }
.pf-edit label { flex: 1; } .pf-edit label span { display: block; font-size: 13px; color: var(--ink2); margin-bottom: 6px; }
.pf-edit input { width: 100%; padding: 11px 13px; border-radius: 11px; border: 1px solid var(--ctl); background: var(--card); color: var(--label); font: inherit; font-size: 15px; }
.pf-edit input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 3px rgba(45,125,70,.2); }
.pf-edit .acts { display: flex; gap: 10px; margin-top: 14px; }
.pf-org-card { flex: 1; padding: 24px 26px; display: flex; flex-direction: column; gap: 6px; }
.pf-org-card .org { font-size: 24px; letter-spacing: -.5px; } .pf-org-card .meta { display: flex; align-items: center; gap: 14px; margin-top: 4px; }
.pf-org-card .pf-role { margin-top: 0; } .pf-org-card p { margin: 10px 0 6px; line-height: 1.45; } .pf-org-card .pf-btn { align-self: flex-start; }
.pf-role.mem { color: var(--ink2); background: var(--soft2); }
/* position + :has: a animação de entrada cria uma camada por linha; a linha com o menu aberto fica por cima das seguintes. */
.pf-people .pr:has(.pf-menu) { z-index: 5; }
.pf-people .pr { position: relative; display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-bottom: 1px solid var(--line); transition: opacity .3s, transform .3s, max-height .3s, padding .3s; max-height: 90px; }
.pf-events .ev { display: flex; align-items: center; gap: 14px; padding: 12px 20px; border-bottom: 1px solid var(--line); font-size: 14.5px; }
.pf-events .ev:last-child, .pf-events .ev:has(+ .more) { border-bottom: 0; }
.pf-events .tx { flex: 1; min-width: 0; color: var(--label); } .pf-events .when { font-size: 13px; color: var(--muted); white-space: nowrap; }
.pf-events .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--faint); }
.pf-events .dot.approved, .pf-events .dot.created { background: var(--green); } .pf-events .dot.leader_transferred { background: var(--navy); }
.pf-events .dot.removed, .pf-events .dot.rejected { background: var(--danger); } .pf-events .dot.left, .pf-events .dot.join_cancelled { background: var(--orange); }
.pf-events .more { display: block; width: 100%; padding: 12px 20px; border: 0; border-top: 1px solid var(--line); background: none; color: var(--green); font: inherit; text-align: left; cursor: pointer; }
.pf-people .pr:last-child { border-bottom: 0; } .pf-people .pr:hover { background: var(--hover); }
.pf-people .pr.out { opacity: 0; transform: translateX(24px); max-height: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; }
.pf-people .av { width: 40px; height: 40px; border-radius: 50%; background: var(--soft2); color: var(--ink2); display: flex; align-items: center; justify-content: center; font-size: 14px; flex: none; }
.pf-people .av.lead { background: var(--greenL); color: var(--green); }
.pf-people .who { flex: 1; min-width: 0; } .pf-people .who b { display: flex; align-items: center; gap: 8px; font-size: 15px; } .pf-people .who small { display: block; font-size: 13px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-people .you { font-size: 11.5px; color: var(--green); background: var(--greenL); padding: 2px 7px; border-radius: 6px; }
.pf-people .acts { display: flex; gap: 8px; }
.pf-iconbtn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid transparent; background: none; color: var(--muted); display: flex; align-items: center; justify-content: center; flex: none; transition: background .15s, border-color .15s; } .pf-iconbtn svg { width: 18px; height: 18px; }
.pf-iconbtn:hover, .pf-iconbtn[aria-expanded="true"] { background: var(--card); border-color: var(--line); color: var(--label); } .pf-iconbtn.ghost { visibility: hidden; }
.pf-menuwrap { position: relative; }
.pf-menu { position: absolute; right: 0; top: 42px; z-index: 20; min-width: 230px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 6px; box-shadow: 0 18px 40px rgba(18,36,52,.18); transform-origin: top right; animation: pfPop .18s cubic-bezier(.2,.9,.3,1.2); }
.pf-menu button { display: block; width: 100%; text-align: left; border: 0; background: none; padding: 10px 12px; border-radius: 9px; font-size: 14px; color: var(--label); }
.pf-menu button:hover { background: var(--hover); } .pf-menu button.dang { color: var(--danger); } .pf-menu button.dang:hover { background: var(--dangerBg); }
.pf-spin { width: 20px; height: 20px; border-radius: 50%; border: 2.5px solid var(--greenL); border-top-color: var(--green); animation: pfSpin .8s linear infinite; margin: 0 8px; }
.pf-acct .row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 16px 20px; border: 0; border-bottom: 1px solid var(--line); background: none; text-align: left; font-size: 15px; color: var(--label); transition: background .15s; }
.pf-acct .row:last-child { border-bottom: 0; } .pf-acct .row:hover { background: var(--hover); } .pf-acct .row span:nth-child(2) { flex: 1; }
.pf-acct .row.dang { color: var(--danger); } .pf-acct .ic { width: 32px; height: 32px; border-radius: 9px; background: var(--soft2); display: flex; align-items: center; justify-content: center; color: var(--ink2); } .pf-acct .ic svg { width: 18px; }
@media (prefers-reduced-motion: reduce) { .pf-avatar-xl .ring, .pf-avatar-xl .in, .pf-menu, .pf-edit { animation: none !important; } .pf-theme .knob, .pf-theme .ic, .pf-people .pr { transition: none !important; } }

/* ---------- histórico de peso ---------- */
.pf-hist2 .top { display: flex; align-items: center; justify-content: space-between; gap: 10px; } .pf-hist2 .pf-delta { margin-top: 0; }
.pf-wline { width: 100%; height: auto; display: block; margin-top: 10px; overflow: visible; }
.pf-wline .ln { stroke-dasharray: 1; stroke-dashoffset: 1; animation: pfDraw .9s .1s cubic-bezier(.4,0,.2,1) forwards; }
.pf-wline .ar { opacity: 0; animation: pfFade .6s .5s forwards; }
.pf-wline .pt { fill: var(--card); stroke: var(--green); stroke-width: 2.5; transform-box: fill-box; transform-origin: center; animation: pfDot .35s cubic-bezier(.2,.8,.3,1.4) both; transition: r .15s; }
.pf-wline .pt.on { fill: var(--green); }
@keyframes pfDraw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .pf-wline .ln { animation: none; stroke-dashoffset: 0; } .pf-wline .ar { animation: none; opacity: 1; } .pf-wline .pt { animation: none; } }

/* ---------- scan 3D ---------- */
.pf-3d { position: relative; height: 280px; border-radius: 16px; overflow: hidden; border: 1px solid var(--line);
  background: radial-gradient(120% 90% at 50% 20%, var(--card) 0%, var(--soft2) 100%); animation: pfIn .4s both; }
.pf-3d .cv { position: absolute; inset: 0; cursor: grab; } .pf-3d .cv:active { cursor: grabbing; } .pf-3d canvas { display: block; width: 100% !important; height: 100% !important; }
.pf-3d .ov { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--muted); font-size: 13.5px; }
.pf-3d .bar { position: absolute; left: 10px; right: 10px; bottom: 10px; display: flex; align-items: center; justify-content: space-between; animation: pfIn .35s .2s both; }
.pf-pills.sm { min-width: 0; background: var(--card); border: 1px solid var(--line); box-shadow: 0 4px 14px rgba(0,0,0,.12); } .pf-pills.sm .thumb { background: var(--greenL); box-shadow: none; } .pf-pills.sm button.on { color: var(--green); } .pf-pills.sm button { padding: 6px 12px; font-size: 12.5px; }
.pf-3d .bar .pf-link { background: var(--card); border: 1px solid var(--line); }
.pf-3d-empty { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 14px; border: 1px dashed var(--ctl); color: var(--muted); font-size: 13px; line-height: 1.45; }
.pf-3d-empty svg { width: 22px; flex: none; color: var(--navy); margin-top: 2px; } .pf-3d-empty b { display: block; color: var(--label); font-size: 14px; margin-bottom: 2px; }

/* ---------- esqueletos ---------- */
.pf-skel { display: block; background: linear-gradient(90deg, var(--soft2) 25%, var(--soft3) 37%, var(--soft2) 63%); background-size: 400% 100%; animation: pfShimmer 1.4s ease-in-out infinite; }
@keyframes pfShimmer { from { background-position: 100% 50%; } to { background-position: 0 50%; } }
.pf-skelbars { display: flex; align-items: flex-end; gap: 6px; margin-top: 14px; } .pf-skelbars .pf-skel { flex: 1; }
.pf-skelrow { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-bottom: 1px solid var(--line); } .pf-skelrow:last-child { border-bottom: 0; }
@media (prefers-reduced-motion: reduce) { .pf-skel { animation: none; } }

/* ---------- Definições dentro do Perfil (acordeão) ---------- */
.pf-acct .row .hint { display: block; font-size: 12.5px; color: var(--muted); margin-top: 1px; }
.pf-acct .chev { display: inline-flex; color: var(--faint); transition: transform .35s cubic-bezier(.3,1.2,.4,1), color .2s; } .pf-acct .chev.open { transform: rotate(90deg); color: var(--green); }
.pf-acct .row[aria-expanded="true"] { background: var(--hover); }
.pf-collapse { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .45s cubic-bezier(.3,.8,.3,1); border-bottom: 1px solid transparent; }
.pf-collapse.open { grid-template-rows: 1fr; border-bottom-color: var(--line); }
.pf-collapse .inner { overflow: hidden; min-height: 0; }
.pf-collapse .pad { padding: 18px 20px 22px; animation: pfIn .4s .08s cubic-bezier(.2,.8,.2,1) both; }
.pf-settings.emb { margin-top: 0; } .pf-settings.emb .pf-secpanel h2 { font-size: 18px; margin-top: 2px; }
@media (prefers-reduced-motion: reduce) { .pf-collapse, .pf-acct .chev { transition: none; } .pf-collapse .pad { animation: none; } }

/* ---------- troca de tema: passagem de scan ---------- */
::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
/* A revelação (clip-path diagonal) e a linha são animadas em themeScan.ts (Web Animations API),
   a partir do botão do tema, com a mesma curva e o mesmo percurso. */
.pf-scanline { position: fixed; left: 0; top: 0; height: 150px; z-index: 9999; pointer-events: none; view-transition-name: pf-scan;
  background:
    linear-gradient(180deg, rgba(61,160,92,0) 0%, rgba(61,160,92,.10) 60%, rgba(61,160,92,.28) 96%, rgba(140,255,170,.95) 98.5%, rgba(61,160,92,0) 100%),
    radial-gradient(circle, rgba(120,230,150,.55) 1px, transparent 1.6px) 0 0 / 14px 14px;
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 70%); mask-image: linear-gradient(180deg, transparent 0%, #000 70%);
  will-change: transform; }
/* Brilho por baixo da linha só com gradiente (o drop-shadow era repintado a cada frame). */
.pf-scanline::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 18px; background: linear-gradient(180deg, rgba(61,160,92,.35), rgba(61,160,92,0)); }
::view-transition-group(pf-scan) { animation: none; }
::view-transition-old(pf-scan) { display: none; }
::view-transition-new(pf-scan) { animation: none; transform-origin: 0 0; }

/* ---------- portáteis pequenos (1024–1279 px): menu só com ícones, cartões 2 a 2, blocos empilhados ---------- */
.pf-table .brs { display: none; }
@media (max-width: 1279px) {
  .pf-side { width: 80px; padding: 24px 12px 18px; align-items: center; }
  .pf-brand { padding: 0 0 22px; } .pf-brand .pf-word { display: none; }
  .pf-nav { width: 100%; } .pf-nav button { justify-content: center; padding: 12px; } .pf-nav .lbl { display: none; }
  .pf-org { display: none; }
  .pf-me { flex-direction: column; padding: 12px 0 0; } .pf-me .who { flex: none; } .pf-me .nmb { display: none; }
  .pf-page { padding: 28px 28px 34px; }
  .pf-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pf-row:not(.pf-split) { flex-direction: column; } .pf-row:not(.pf-split) > * { width: 100%; flex: none !important; }
  .pf-search { width: 300px; }
  .pf-table .hd, .pf-table .tr { grid-template-columns: minmax(0, 1fr) 96px 120px; padding: 0 16px; }
  .pf-table .hd span:nth-child(2), .pf-table .tr .br { display: none; }
  .pf-table .brs { display: inline; }
  .pf-sheet { width: 340px; padding: 20px; }
  .pf-secnav { width: 230px; }
  .pf-pills { min-width: 0; } .pf-pills button { padding: 9px 11px; }
}

/* ---------- login ---------- */
.pf-login { position: fixed; inset: 0; display: flex; }
.pf-lp { flex: 1.1; position: relative; overflow: hidden; background: #122434; display: flex; align-items: center; justify-content: center; padding: 56px; }
.pf-lp-icon { width: min(46%, 380px); aspect-ratio: 1; border-radius: 24%; box-shadow: 0 30px 80px rgba(0,0,0,.35); }
.pf-rp { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
.pf-form { width: 400px; position: relative; z-index: 1; }
.pf-seg { display: flex; background: rgba(118,118,128,.12); border-radius: 12px; padding: 3px; margin: 26px 0 8px; }
.pf-seg button { flex: 1; border: 0; background: none; padding: 10px; font-size: 15px; color: var(--ink2); border-radius: 10px; } .pf-seg button.on { background: var(--thumb); color: var(--label); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.pf-f label { display: block; font-size: 13.5px; color: var(--ink2); margin: 14px 0 7px; }
.pf-f input { width: 100%; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--ctl); background: var(--card); font: inherit; font-size: 15px; color: var(--label); }
.pf-btn { padding: 11px 18px; border-radius: 12px; font-size: 14.5px; border: 0; }
.pf-btn.g { background: var(--green); color: #fff; } .pf-btn.g:hover { background: #276E3D; } .pf-btn.g:disabled { opacity: .6; cursor: default; }
.pf-btn.l { background: var(--card); color: var(--navy); border: 1px solid var(--line); }
.pf-form .pf-btn.g { width: 100%; padding: 15px; margin-top: 22px; font-size: 16px; }
.pf-small { font-size: 13px; color: var(--muted); margin-top: 16px; text-align: center; line-height: 1.5; }
.pf-err { margin-top: 14px; color: var(--danger); font-size: 13.5px; }

/* ---------- ecrã de organização no computador + diálogos do Alert ---------- */
.pf-gate { align-items: stretch; padding: 24px 32px; overflow: auto; }
.pf-dlg .acts.col { flex-direction: column-reverse; }
/* ---------- tempo e bem-estar ---------- */
.pf-wxnav { position: relative; } .pf-wxnav .wxi { width: 21px; height: 21px; display: grid; place-items: center; flex: none; } .pf-wxnav .wxi svg { width: 21px; height: 21px; }
.pf-wxnav small { margin-left: auto; font-size: 12.5px; color: var(--muted); }
.pf-wxchip { display: flex; align-items: center; gap: 12px; padding: 6px 16px 6px 6px; border-radius: 16px; font: inherit; color: var(--label); cursor: pointer; text-align: left; }
.pf-wxchip b { display: block; font-size: 14.5px; } .pf-wxchip small { font-size: 12.5px; color: var(--muted); } .pf-wxchip small.warn { color: var(--warnInk); }
.pf-wx-grid { display: grid; grid-template-columns: 1.05fr 1fr 1.25fr; gap: 16px; }
.pf-wx-now, .pf-wx-thi { padding: 22px 24px; }
.pf-wx-now .k, .pf-wx-thi .k, .pf-wx-season .k { font-size: 13px; color: var(--green); }
.pf-wx-now .t { font-size: 56px; letter-spacing: -2px; line-height: 1; display: flex; align-items: center; gap: 12px; margin: 8px 0 6px; }
.pf-wx-now .t small { font-size: 22px; color: var(--muted); letter-spacing: 0; margin: 4px 0 0 -8px; align-self: flex-start; }
.pf-wx-now .cond { font-size: 15px; color: var(--ink2); } .pf-wx-now .facts { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 10px; font-size: 13px; color: var(--muted); } .pf-wx-now .facts b { color: var(--label); }
.pf-wx-thi .k { display: flex; justify-content: space-between; align-items: center; } .pf-wx-thi .v { font-size: 44px; letter-spacing: -1.5px; margin: 8px 0 4px; }
.band { display: inline-block; font-size: 12.5px; font-weight: 700; padding: 3px 10px; border-radius: 7px; }
.band.normal { background: var(--greenL); color: var(--green); } .band.alert { background: rgba(194,97,31,.12); color: var(--warnInk); } .band.danger { background: var(--dangerBg); color: var(--danger); } .band.emergency { background: var(--danger); color: #fff; }
.pf-wx-thi .scale { display: flex; height: 8px; border-radius: 6px; overflow: hidden; margin: 16px 0 6px; } .pf-wx-thi .scale span { flex: 1; }
.pf-wx-thi .scale .n { background: var(--green); opacity: .55; } .pf-wx-thi .scale .a { background: var(--orange); opacity: .6; flex: .55; } .pf-wx-thi .scale .d { background: var(--danger); opacity: .65; flex: .7; } .pf-wx-thi .scale .e { background: var(--danger); flex: .8; }
.pf-wx-thi .mk { position: relative; height: 0; } .pf-wx-thi .mk i { position: absolute; top: -18px; width: 3px; height: 14px; border-radius: 2px; background: var(--label); transform: translateX(-50%); }
.pf-wx-thi .lbls { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); } .pf-wx-thi p { font-size: 12.5px; color: var(--muted); margin: 12px 0 0; line-height: 1.5; }
.pf-wx-alerts { padding: 6px 0; } .pf-wx-alerts .al { display: flex; gap: 14px; padding: 14px 20px; border-bottom: 1px solid var(--line); align-items: flex-start; } .pf-wx-alerts .al:last-child { border-bottom: 0; }
.pf-wx-alerts .ic { width: 38px; height: 38px; border-radius: 11px; flex: none; display: grid; place-items: center; background: rgba(37,99,168,.12); color: #2563A8; } .pf-wx-alerts .ic svg { width: 20px; height: 20px; }
.pf-wx-alerts .ic.heat { background: rgba(194,97,31,.12); color: var(--warnInk); } .pf-wx-alerts .ic.danger { background: var(--dangerBg); color: var(--danger); } .pf-wx-alerts .ic.ok { background: var(--greenL); color: var(--green); } .pf-wx-alerts .ic.cold { color: var(--navy); }
.pf-wx-alerts b { display: block; font-size: 15px; margin-bottom: 3px; } .pf-wx-alerts span { font-size: 13px; color: var(--ink2); line-height: 1.45; } .pf-wx-alerts .when { margin-left: auto; font-size: 12px; color: var(--muted); white-space: nowrap; padding-top: 2px; }
.pf-wx-chart { padding: 18px 20px 12px; } .pf-wx-chart .legend { display: flex; gap: 16px; font-size: 12px; color: var(--muted); margin-bottom: 6px; flex-wrap: wrap; }
.pf-wx-chart .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; } .pf-wx-chart .legend i.al { background: rgba(194,97,31,.14); outline: 1px solid var(--orange); } .pf-wx-chart .legend i.dg { background: var(--dangerBg); outline: 1px solid var(--danger); }
.pf-wx-chart .svg { width: 100%; height: 230px; display: block; overflow: visible; } .pf-wx-chart rect.al { fill: rgba(194,97,31,.12); } .pf-wx-chart rect.dg { fill: var(--dangerBg); }
.pf-wx-chart .grid { stroke: var(--line); stroke-dasharray: 3 4; } .pf-wx-chart .ax { font-size: 11px; fill: var(--muted); } .pf-wx-chart .area { fill: var(--green); opacity: .08; } .pf-wx-chart .line { fill: none; stroke: var(--green); stroke-width: 2.5; stroke-linejoin: round; } .pf-wx-chart .dot { fill: var(--card); stroke: var(--green); stroke-width: 2.5; }
.pf-wx-row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; }
.pf-wx-week { display: grid; grid-template-columns: repeat(7, 1fr); } .pf-wx-week .wd { padding: 14px 8px; text-align: center; border-right: 1px solid var(--line); } .pf-wx-week .wd:last-child { border-right: 0; }
.pf-wx-week .d { font-size: 13px; color: var(--muted); } .pf-wx-week .ic { display: flex; justify-content: center; margin: 8px 0; } .pf-wx-week .mx { font-size: 17px; } .pf-wx-week .mn { font-size: 13px; color: var(--muted); } .pf-wx-week .p { font-size: 12px; color: #2563A8; margin-top: 4px; min-height: 15px; }
.pf-wx-season { padding: 22px 24px; } .pf-wx-season .big { display: flex; gap: 22px; margin: 12px 0 10px; } .pf-wx-season .big div { font-size: 13px; color: var(--muted); } .pf-wx-season .big b { display: block; font-size: 38px; letter-spacing: -1px; }
.pf-wx-season .big .a b { color: var(--warnInk); } .pf-wx-season .big .d b { color: var(--danger); } .pf-wx-season p { font-size: 13px; color: var(--ink2); line-height: 1.5; margin: 0; }
.pf-wx-empty { padding: 34px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-width: 560px; } .pf-wx-empty .ic { width: 52px; height: 52px; border-radius: 16px; background: var(--greenL); color: var(--green); display: grid; place-items: center; } .pf-wx-empty .ic svg { width: 26px; height: 26px; }
.pf-wx-empty b { font-size: 18px; } .pf-wx-empty p { color: var(--muted); font-size: 14px; margin: 0 0 6px; line-height: 1.5; }
.pf-dlg.pf-locdlg { width: min(680px, calc(100vw - 48px)); text-align: left; } .pf-locbar { display: flex; gap: 10px; margin: 16px 0 12px; } .pf-locbar .pf-btn { white-space: nowrap; }
.pf-locsearch { position: relative; flex: 1; } .pf-locsearch input { width: 100%; padding: 11px 14px; border-radius: 12px; border: 1px solid var(--ctl); background: var(--card); font: inherit; font-size: 14.5px; color: var(--label); }
.pf-locres { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 1000; background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.12); overflow: hidden; }
.pf-locres button { display: block; width: 100%; text-align: left; padding: 10px 14px; border: 0; background: none; font: inherit; font-size: 14px; color: var(--label); cursor: pointer; } .pf-locres button:hover { background: var(--hover); }
.pf-locsearch input { padding-right: 40px; } .pf-locspin { position: absolute; right: 13px; top: 50%; width: 16px; height: 16px; margin-top: -8px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--green); animation: pfSpin .8s linear infinite; }
.pf-locmsg { padding: 11px 14px; font-size: 13.5px; color: var(--ink2); line-height: 1.45; } .pf-locmsg.err { color: var(--danger); }
.pf-loccredit { margin-top: 10px; font-size: 11.5px; color: var(--muted); }
.pf-wx-notice { display: flex; align-items: center; gap: 8px; margin: 14px 4px 16px; font-size: 13.5px; color: var(--warnInk); line-height: 1.4; } .pf-wx-notice .pf-locspin { position: static; margin: 0; flex: none; border-top-color: var(--warnInk); }
.pf-wx-wait { padding: 34px; display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 14.5px; } .pf-wx-wait .pf-locspin { position: static; margin: 0; }
.pf-locpick { margin-top: 12px; } .pf-locpick b { display: block; font-size: 15.5px; } .pf-locpick span { font-size: 12.5px; color: var(--muted); }
.pf-pin { background: none; border: 0; }
.pf-farmloc { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); } .pf-farmloc .ic { width: 30px; height: 30px; border-radius: 9px; background: var(--greenL); color: var(--green); display: grid; place-items: center; flex: none; } .pf-farmloc .ic svg { width: 17px; height: 17px; }
.pf-farmloc small { display: block; font-size: 12px; color: var(--muted); } .pf-farmloc b { font-size: 14px; } .pf-farmloc .pf-link { margin-left: auto; }
.pf-wait { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; padding: 16px 20px; margin: 18px 0 22px; border-color: rgba(194,97,31,.35); background: rgba(194,97,31,.06); color: var(--label); font: inherit; cursor: pointer; }
.pf-wait .ic { width: 40px; height: 40px; flex: none; border-radius: 12px; display: grid; place-items: center; background: rgba(194,97,31,.14); color: var(--warnInk); } .pf-wait .ic svg { width: 21px; height: 21px; }
.pf-wait .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; font-size: 14px; line-height: 1.45; color: var(--ink2); } .pf-wait .tx b { font-size: 15.5px; color: var(--label); }

/* ---------- diálogo ---------- */
.pf-scrim { position: fixed; inset: 0; background: rgba(18,36,52,.34); z-index: 50; display: flex; align-items: center; justify-content: center; animation: pfFade .18s ease-out; }
.pf-dlg { width: 420px; background: var(--card); border-radius: 22px; padding: 26px 26px 20px; box-shadow: 0 30px 70px rgba(18,36,52,.3); text-align: center; animation: pfPop .26s cubic-bezier(.2,.9,.3,1.2); }
.pf-dlg .di { width: 66px; height: 66px; margin: 0 auto 14px; border-radius: 18px; background: var(--greenL); color: var(--green); display: flex; align-items: center; justify-content: center; } .pf-dlg .di svg { width: 34px; height: 34px; }
.pf-dlg h3 { font-size: 21px; letter-spacing: -.3px; margin: 0; } .pf-dlg p { font-size: 14.5px; color: var(--muted); margin: 8px 0 0; line-height: 1.45; }
.pf-dlg .acts { display: flex; gap: 10px; margin-top: 22px; } .pf-dlg .acts .pf-btn { flex: 1; padding: 13px; }
@keyframes pfFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes pfPop { from { opacity: 0; transform: scale(.94) } to { opacity: 1; transform: scale(1) } }

/* ---------- modo mobile ---------- */
.pf-phoneStage { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; }
.pf-bezel { position: relative; border-radius: 64px; background: #0E1620; padding: 14px; box-shadow: 0 46px 90px rgba(27,58,87,.3); flex: none; }
.pf-screen { position: relative; width: 392px; height: 852px; border-radius: 50px; overflow: hidden; background: var(--ground); transform: translateZ(0); }
.pf-back { position: fixed; right: 36px; top: 30px; display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--muted); z-index: 5; border: 0; background: none; padding: 0; }
.pf-back .pf-dev { pointer-events: none; }
.pf-caption { position: fixed; left: 0; right: 0; bottom: 20px; text-align: center; font-size: 13.5px; color: var(--muted); }
/* What's new — «Árvore por área»: 4 colunas, ramo à esquerda, selo da versão (verde = versão instalada). */
.pf-wn-back { display: inline-block; margin: 0 0 10px 2px; }
.pf-wn-seg { display: flex; background: rgba(118,118,128,.12); border-radius: 12px; padding: 3px; flex-shrink: 0; }
.pf-wn-seg button { border: 0; background: none; padding: 8px 14px; font-size: 14px; color: var(--ink2); border-radius: 10px; white-space: nowrap; }
.pf-wn-seg button.on { background: var(--thumb); color: var(--label); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.pf-wn-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-top: 24px; align-items: start; }
@media (max-width: 1100px) { .pf-wn-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.pf-wn-col { padding: 18px 18px 20px; min-width: 0; }
.pf-wn-col h2 { display: flex; align-items: center; gap: 10px; font-size: 16px; margin: 0 0 14px; color: var(--label); }
.pf-wn-col h2 .ic { width: 30px; height: 30px; border-radius: 9px; background: var(--greenL); color: var(--green); display: flex; align-items: center; justify-content: center; } .pf-wn-col h2 .ic svg { width: 18px; }
.pf-wn-branch { list-style: none; margin: 0 0 0 14px; padding: 2px 0; border-left: 2px solid var(--line); display: flex; flex-direction: column; gap: 12px; }
.pf-wn-branch li { position: relative; display: flex; align-items: flex-start; gap: 8px; padding-left: 16px; font-size: 14.5px; line-height: 1.45; color: var(--label); }
.pf-wn-branch li::before { content: ''; position: absolute; left: 0; top: 10px; width: 10px; height: 2px; background: var(--line); }
.pf-wn-branch .tx { min-width: 0; overflow-wrap: anywhere; }
.pf-wn-badge { flex-shrink: 0; min-width: 52px; text-align: center; font-size: 12px; border-radius: 7px; padding: 2px 7px; margin-top: 1px; background: #E3EBF3; color: #1B3A57; }
:root[data-theme="dark"] .pf-wn-badge { background: rgba(141,179,216,.16); color: #8DB3D8; }
.pf-wn-badge.new, :root[data-theme="dark"] .pf-wn-badge.new { background: #2D7D46; color: #FFFFFF; }
.pf-wn-empty { margin: 0 0 0 4px; font-size: 13.5px; color: var(--muted); }
.pf-wn-legend { display: flex; align-items: center; gap: 8px; } .pf-wn-legend .sw { width: 10px; height: 10px; border-radius: 3px; background: #2D7D46; }
.pf-wn-segs { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
.pf-wn-intro { margin: 20px 0 0; }
.pf-wn-next { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px; align-items: start; }
.pf-wn-up { padding: 18px 18px 20px; min-width: 0; }
.pf-wn-up h2 { display: flex; align-items: flex-start; gap: 10px; font-size: 16px; margin: 0; color: var(--label); line-height: 1.3; }
.pf-wn-up h2 small { display: block; margin-top: 2px; font-size: 13px; font-weight: 400; color: var(--muted); }
.pf-wn-up h2 .ic { flex-shrink: 0; width: 30px; height: 30px; border-radius: 9px; background: var(--greenL); color: var(--green); display: flex; align-items: center; justify-content: center; } .pf-wn-up h2 .ic svg { width: 18px; }
.pf-wn-up .tx { margin: 10px 0 0; font-size: 14.5px; line-height: 1.5; color: var(--label); overflow-wrap: anywhere; }
.pf-wn-status { display: inline-block; margin-top: 12px; font-size: 12px; border-radius: 7px; padding: 3px 8px; }
.pf-wn-status.in-progress { background: #FBEBDD; color: #9C4C16; }
.pf-wn-status.planned { background: #E3EBF3; color: #1B3A57; }
.pf-newdot { width: 9px; height: 9px; border-radius: 50%; background: var(--green); flex-shrink: 0; }

/* Seleção em massa na lista de membros (Perfil). */
.pf-people .pr.pick { cursor: pointer; } .pf-people .pr.pick:hover { background: var(--greenL); }
.pf-people .pr.sel { background: var(--greenL); } .pf-people .pr.busy { opacity: .5; }
.pf-boxgap { width: 30px; flex: none; }
.pf-check { width: 30px; height: 30px; flex: none; border-radius: 50%; border: 2px solid var(--muted); background: var(--card); color: #fff; display: inline-flex; align-items: center; justify-content: center; padding: 0; cursor: pointer; transition: background .15s, border-color .15s, transform .1s; }
.pf-check svg { width: 17px; height: 17px; opacity: 0; transition: opacity .12s; }
.pf-check.on { background: var(--green); border-color: var(--green); } .pf-check.on svg { opacity: 1; }
.pf-check:hover:not(:disabled) { border-color: var(--green); } .pf-check:active:not(:disabled) { transform: scale(.92); }
.pf-check:focus-visible { outline: 3px solid var(--green); outline-offset: 2px; } .pf-check:disabled { opacity: .5; cursor: default; }
.pf-bulkdock { position: sticky; bottom: 16px; z-index: 30; max-width: 640px; margin: 18px auto 0; }
`;
