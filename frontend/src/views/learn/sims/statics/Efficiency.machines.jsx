import { useState } from 'react';
import { Bike, Car, Cog, Lightbulb, Sparkles, Sun, Wrench } from 'lucide-react';

import { Explain, Readout, Segmented, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Chip, EC, Eq, EtaBar, FikPanel, GroupLabel, LabScene, Panel, PlayControls, SankeyFlow, SceneRow, Step, Sym, SvgSym, big } from './Efficiency.parts';
import DeviceArt from './Efficiency.devices';

/**
 * Tab 3 — where the energy of real machines goes. Pick a device and see a
 * Sankey-like flow of its input power into the useful part and the losses.
 * η = P_f / P_t = A_f / A_t (A = P·t), so it can be counted with powers.
 * Typical values (school textbooks, rounded):
 *   electric motor 1 kW            η ≈ 90 %  (heating 8 %, friction 2 %)
 *   petrol car engine 100 kW fuel  η ≈ 25 %  (exhaust 35 %, cooling 33 %, friction 7 %)
 *   incandescent bulb 60 W         η ≈ 5 %   (light 3 W, heat 57 W)
 *   LED bulb 7.5 W                 η ≈ 40 %  (the same 3 W of light, heat 4.5 W)
 *   a cyclist's muscles 500 W food η ≈ 20 %  (100 W of pedalling)
 *   solar panel 1000 W of sunlight η ≈ 20 %  (heating 72 %, reflected 8 %)
 * Running the device counts the energy spent in real time: A = P·t.
 */

const DEVICES = [
  { id: 'motor', icon: Cog, P: 1000, useful: 0.9, losses: [{ id: 'heat', f: 0.08, color: EC.heat, fill: EC.heatBar }, { id: 'fric', f: 0.02, color: EC.block, fill: EC.blockBar }] },
  {
    id: 'car',
    icon: Car,
    P: 100000,
    useful: 0.25,
    losses: [
      { id: 'exhaust', f: 0.35, color: EC.exhaust, fill: EC.exhaustBar },
      { id: 'cooling', f: 0.33, color: EC.heat, fill: EC.heatBar },
      { id: 'fric', f: 0.07, color: EC.block, fill: EC.blockBar },
    ],
  },
  { id: 'bulb', icon: Lightbulb, P: 60, useful: 0.05, losses: [{ id: 'heat', f: 0.95, color: EC.heat, fill: EC.heatBar }] },
  { id: 'led', icon: Sparkles, P: 7.5, useful: 0.4, losses: [{ id: 'heat', f: 0.6, color: EC.heat, fill: EC.heatBar }] },
  { id: 'human', icon: Bike, P: 500, useful: 0.2, losses: [{ id: 'heat', f: 0.8, color: EC.heat, fill: EC.heatBar }] },
  {
    id: 'solar',
    icon: Sun,
    P: 1000,
    useful: 0.2,
    losses: [
      { id: 'heat', f: 0.72, color: EC.heat, fill: EC.heatBar },
      { id: 'reflect', f: 0.08, color: EC.exhaust, fill: EC.exhaustBar },
    ],
  },
];
const BY_ID = Object.fromEntries(DEVICES.map((d) => [d.id, d]));
const IDLE = { t: 0, running: false };

/** A power with its unit: 7.5 W · 60 W · 25 kW; `ref` (the device's input) picks W or kW for all its parts. */
function powerText(P, T, ref = P) {
  if (ref >= 10000) {
    const r = Math.round(P / 100) / 10;
    return `${big(r, Number.isInteger(r) ? 0 : 1, T.decimal)} ${T.kW}`;
  }
  const r = Math.round(P * 10) / 10;
  return `${fmt(r, Number.isInteger(r) ? 0 : 1, T.decimal)} ${T.W}`;
}

/** An energy with its unit: 36 J · 2 880 J · 54.0 kJ · 1.2 MJ. */
function energyText(E, T) {
  const dec = T.decimal;
  if (E >= 1e7) return `${fmt(E / 1e6, 1, dec)} ${T.MJ}`;
  if (E >= 1e5) return `${big(E / 1000, 0, dec)} ${T.kJ}`;
  if (E >= 1e4) return `${fmt(E / 1000, 1, dec)} ${T.kJ}`;
  return `${big(E, E < 100 ? 1 : 0, dec)} ${T.J}`;
}

export default function MachinesSim({ T }) {
  const L = T.machines;
  const dec = T.decimal;
  const [id, setId] = useState('motor');
  const [sim, setSim] = useState(IDLE);
  const dev = BY_ID[id];
  const D = L.devices[id];

  useRafLoop(sim.running, (dt) => {
    setSim((p) => (p.running ? { ...p, t: p.t + dt } : p));
  });

  const pick = (v) => {
    setId(v);
    setSim(IDLE);
  };
  const toggle = () => setSim((p) => ({ ...p, running: !p.running }));
  const reset = () => setSim(IDLE);

  const Pf = dev.P * dev.useful;
  const Ploss = dev.P - Pf;
  const At = dev.P * sim.t;
  const Af = Pf * sim.t;
  const pct = (f) => fmt(f * 100, 0, dec);

  const key = sim.t > 0 ? `run-${id}` : `intro-${id}`;
  const settled = useSettled(key, 0);
  const text = sim.t > 0 ? L.explainRun(fmt(sim.t, 1, dec), energyText(At, T), energyText(Af, T), D.usefulTo, pct(1 - dev.useful)) : D.intro;
  const tone = dev.useful >= 0.5 ? '#34d399' : dev.useful >= 0.15 ? '#fbbf24' : '#f87171';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.devicesLabel}</GroupLabel>
          <Segmented
            label={L.devicesLabel}
            className="grid-cols-2 md:grid-cols-3"
            size="lg"
            value={id}
            onChange={pick}
            options={DEVICES.map((d) => ({ value: d.id, label: L.devices[d.id].name, sub: L.devices[d.id].sub, icon: d.icon }))}
          />
        </div>
        <PlayControls
          labels={{ start: L.start, pause: L.stop, resume: T.common.resume, again: L.start, reset: T.common.reset }}
          running={sim.running}
          done={false}
          started={sim.t > 0}
          onToggle={toggle}
          onReset={reset}
          className="xl:w-[190px] xl:flex-col"
        />
      </div>

      <SceneRow
        under={
          <Explain icon={Lightbulb} id={settled} tone={tone}>
            <Sym>{text}</Sym>
          </Explain>
        }
        renderScene={(fitH) => <MachineScene T={T} dev={dev} t={sim.t} running={sim.running} fitH={fitH} />}
        side={<MachineFik T={T} dev={dev} t={sim.t} At={At} Af={Af} />}
      />


      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.Pt} symbol={<Sym>{T.sym.Pt}</Sym>} value={powerText(dev.P, T).split(' ')[0]} unit={powerText(dev.P, T).split(' ')[1]} accent={EC.inputBar} textColor={EC.inputText} sub={D.input} />
        <Readout
          label={L.readouts.Pf}
          symbol={<Sym>{T.sym.Pf}</Sym>}
          value={powerText(Pf, T, dev.P).split(' ')[0]}
          unit={powerText(Pf, T, dev.P).split(' ')[1]}
          accent={EC.useful}
          textColor={EC.usefulText}
          active={sim.running}
          sub={D.useful}
        />
        <Readout
          label={L.readouts.loss}
          value={powerText(Ploss, T, dev.P).split(' ')[0]}
          unit={powerText(Ploss, T, dev.P).split(' ')[1]}
          accent={EC.heat}
          textColor={EC.heatText}
          active={sim.running}
          sub={L.lossSub(pct(1 - dev.useful))}
        />
        <Readout label={L.readouts.eta} symbol="η" value={pct(dev.useful)} unit="%" accent="#22d3ee" textColor="#a5f3fc" sub={D.sub}>
          <EtaBar eta={dev.useful} />
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-100">
            <Wrench size={16} className="text-cyan-300" aria-hidden="true" /> {L.tipTitle}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-gray-300">{D.tip}</p>
          <EnergyCells T={T} dev={dev} />
          <div className="mt-3 rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-snug text-gray-400">{L.never}</div>
        </Panel>
        <Panel className="lg:col-span-3">
          <CompareChart T={T} current={id} onPick={pick} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function MachineScene({ T, dev, t, running, fitH }) {
  const L = T.machines;
  const D = L.devices[dev.id];
  const dec = T.decimal;
  const items = [
    { id: 'use', label: D.useful, value: dev.useful, color: EC.useful, fill: EC.usefulBar, valueText: `${powerText(dev.P * dev.useful, T, dev.P)} · ${fmt(dev.useful * 100, 0, dec)} %` },
    ...dev.losses.map((q) => ({
      id: q.id,
      label: D.losses[q.id],
      value: q.f,
      color: q.color,
      fill: q.fill,
      valueText: `${powerText(dev.P * q.f, T, dev.P)} · ${fmt(q.f * 100, 0, dec)} %`,
    })),
  ];
  return (
    <LabScene
      legend={[
        { color: EC.inputBar, label: L.legend.input, kind: 'box' },
        { color: EC.usefulBar, label: L.legend.useful, kind: 'box' },
        { color: EC.heatBar, label: L.legend.loss, kind: 'box' },
      ]}
      chips={
        <>
          <Chip>{L.chip(fmt(t, 1, dec))}</Chip>
          <Chip icon={null}>{L.chipScale(powerText(dev.P, T))}</Chip>
        </>
      }
      height={(W, narrow) => fitH ?? (narrow ? 520 : 470)}
      ariaLabel={L.sceneLabel(D.name, fmt(dev.useful * 100, 0, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12.5;
        const art = narrow ? 92 : Math.min(150, H * 0.3);
        const leftW = narrow ? 0 : art + 40;
        const artC = narrow ? { x: 16 + art / 2, y: 62 + art / 2 } : { x: 20 + art / 2, y: H * 0.5 };
        const top = narrow ? 62 + art + 34 : 120;
        const sx0 = narrow ? 14 : leftW + 14;
        const flowBox = { x: sx0, y: top, w: W - sx0 - 12, h: H - top - (narrow ? 20 : 34) };
        const inputLabelY = top - 10;
        return (
          <>
            {/* the device, on a soft pad */}
            <circle cx={artC.x} cy={artC.y} r={art * 0.58} fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
            <DeviceArt id={dev.id} cx={artC.x} cy={artC.y} size={art} phase={t} on={running} />
            {narrow ? (
              <>
                <text x={artC.x + art / 2 + 18} y={artC.y - 6} fontSize={fs + 1} fontWeight="700" fill="#0f172a">
                  {D.name}
                </text>
                <text x={artC.x + art / 2 + 18} y={artC.y + 12} fontSize={fs - 1} fill="#475569">
                  {D.input}
                </text>
              </>
            ) : (
              <>
                <text x={artC.x} y={artC.y + art * 0.58 + 22} textAnchor="middle" fontSize={fs + 0.5} fontWeight="700" fill="#0f172a">
                  {D.name}
                </text>
                <text x={artC.x} y={artC.y + art * 0.58 + 40} textAnchor="middle" fontSize={fs - 1.5} fill="#475569">
                  {D.input}
                </text>
                {/* the input arrow into the flow */}
                <path
                  d={`M${artC.x + art * 0.6},${artC.y} L${sx0 - 6},${artC.y}`}
                  stroke={EC.inputBar}
                  strokeWidth="3"
                  strokeDasharray="5 5"
                  strokeDashoffset={running ? -((t * 30) % 10) : 0}
                />
              </>
            )}
            <SvgSym x={sx0} y={inputLabelY} text={T.sym.Pt} value={`${powerText(dev.P, T)} = 100 %`} color="#334155" fs={fs} anchor="start" halo={false} />
            <SankeyFlow
              box={flowBox}
              total={1}
              items={items}
              labelW={narrow ? Math.min(160, W * 0.47) : Math.min(230, W * 0.34)}
              fs={fs}
              barW={narrow ? 14 : 18}
              flowing={running}
              phase={t}
              minSlot={narrow ? 34 : 40}
            />
          </>
        );
      }}
    </LabScene>
  );
}

/* ============================================================ FIK panel */

function MachineFik({ T, dev, t, At, Af }) {
  const L = T.machines;
  const M = L.method;
  const D = L.devices[dev.id];
  const S = T.sym;
  const dec = T.decimal;
  const Pf = dev.P * dev.useful;
  const pS = (P) => powerText(P, T, dev.P);
  return (
    <FikPanel formula={M.formula} title={M.title}>
      <Step n={1} title={M.s1}>
        <Eq sym={`${S.Pt} = ${pS(dev.P)}`} />
        <p className="text-gray-400">{D.input}</p>
      </Step>
      <Step n={2} title={M.s2}>
        <Eq sym={`${S.Pf} = ${pS(Pf)}`} />
        <p className="text-gray-400">{D.useful}</p>
      </Step>
      <Step n={3} title={M.s3}>
        <Eq sym={`η = ${S.Pf} / ${S.Pt} · 100 %`} nums={`= ${pS(Pf)} / ${pS(dev.P)} · 100 % =`} result={`${fmt(dev.useful * 100, 0, dec)} %`} resultColor="#a5f3fc" />
        <p className="mt-1 text-gray-400">
          <Sym>{M.why}</Sym>
        </p>
      </Step>
      <Step n={4} title={M.s4(fmt(t, 1, dec))}>
        <Eq sym={`${S.At} = ${S.Pt}·t`} nums={`= ${energyText(At, T)}`} resultColor={EC.inputText} />
        <Eq sym={`${S.Af} = ${S.Pf}·t`} nums={`= ${energyText(Af, T)}`} />
        <p className="mt-1 text-gray-400">{t > 0 ? M.lost(energyText(At - Af, T)) : M.startHint}</p>
      </Step>
    </FikPanel>
  );
}

/* ====================================================== 100 J in cells */

/** Every 100 J spent, as 100 small cells coloured by where each joule goes. */
function EnergyCells({ T, dev }) {
  const L = T.machines;
  const D = L.devices[dev.id];
  const cats = [
    { id: 'use', n: Math.round(dev.useful * 100), color: EC.usefulBar, label: D.useful },
    ...dev.losses.map((q) => ({ id: q.id, n: Math.round(q.f * 100), color: q.fill, label: D.losses[q.id] })),
  ];
  const cells = cats.flatMap((c, i) => Array.from({ length: c.n }, () => i));
  return (
    <div className="mt-3">
      <p className="text-[12px] font-semibold text-gray-400">{L.cellsTitle}</p>
      <div className="mt-2 grid gap-[3px]" style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' }} aria-hidden="true">
        {cells.map((ci, k) => (
          <span key={k} className="aspect-square rounded-[3px]" style={{ background: cats[ci].color }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-gray-300">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} aria-hidden="true" />
            <b className="tabular-nums text-white">
              {c.n} {T.J}
            </b>
            — {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ======================================================= comparison chart */

function CompareChart({ T, current, onPick }) {
  const L = T.machines;
  const dec = T.decimal;
  const rows = [...DEVICES].sort((a, b) => b.useful - a.useful);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{L.compare.title}</p>
      <div role="group" aria-label={L.compare.title} className="mt-3 space-y-1.5">
        {rows.map((d) => {
          const on = d.id === current;
          const Icon = d.icon;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(d.id)}
              className={`grid w-full min-h-10 grid-cols-[minmax(0,9.5rem)_1fr_3.2rem] items-center gap-3 rounded-xl border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 sm:grid-cols-[minmax(0,12rem)_1fr_3.5rem] ${
                on ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.06]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon size={16} aria-hidden="true" className={on ? 'text-cyan-300' : 'text-gray-400'} />
                <span className={`truncate text-[13px] font-semibold ${on ? 'text-white' : 'text-gray-300'}`}>{L.devices[d.id].name}</span>
              </span>
              <span className="relative h-3 overflow-hidden rounded-full bg-white/10">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${d.useful * 100}%`, background: on ? '#22d3ee' : EC.usefulBar }} />
                <span className="absolute inset-y-0 right-0 w-px bg-white/30" />
              </span>
              <span className={`text-right text-sm font-bold tabular-nums ${on ? 'text-cyan-200' : 'text-gray-300'}`}>{fmt(d.useful * 100, 0, dec)} %</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-500">{L.compare.note}</p>
    </div>
  );
}
