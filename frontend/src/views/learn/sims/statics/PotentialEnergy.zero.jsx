import { useRef, useState } from 'react';
import { Armchair, House, LampDesk, Lightbulb, Timer, Trees } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  DimLine,
  EC,
  Formula,
  G,
  GroupLabel,
  Ground,
  HaloText,
  InfoBox,
  LabScene,
  PaperGrid,
  PlayControls,
  RichPill,
  plain,
  rich,
  richSvg,
  signed,
  smart,
} from './PotentialEnergy.parts';

/**
 * Tab 2 — the zero level. A cut-away two-storey house: a book lies on a
 * shelf 2 m above the room floor (A, 5 m above the ground); pushed off, it
 * falls onto the floor (B, 3 m above the ground). E_p = mgh with h measured
 * from a zero level the reader drags (or picks: ground 0 m, floor 3 m, table
 * top 4 m, roof 6 m). For m = 1 kg: E_A = 49 / 19.6 / 9.8 / −9.8 J and
 * E_B = 29.4 / 0 / −9.8 / −29.4 J, but ΔE_p = E_B − E_A = −19.6 J for every
 * choice. The energy panel uses the scene's metre scale (1 m ↔ mg·1 J), so
 * its bars start on the zero line and end level with A and B, and the ΔE_p
 * bracket never moves. Strings come from T.zero.
 */

const FLOOR = 3; // room floor above the ground, m
const TABLE = 4; // table top
const SHELF = 5; // shelf top
const ROOF = 6; // roof
const Z_MAX = 6.5;
const SNAP = 0.2; // m: the dragged zero line jumps to a named level this close
const BOOK_W = 0.6;
const BOOK_T = 0.12; // drawn thicker than a real book, for visibility
const BOOK_X0 = 7.0; // left edge of the book on the shelf (the shelf ends at 7.6)
const SLIDE = 0.62; // m the book is pushed to clear the shelf edge
const T_SLIDE = 0.45; // s on screen, the push (not part of the physics)
const SLOW = 4; // the fall is shown 4 times slower than real
const T_FALL = Math.sqrt((2 * (SHELF - FLOOR)) / G); // 0.639 s
const T_TOTAL = T_SLIDE + T_FALL * SLOW;
const IDLE = { t: 0, running: false, done: false };

const LEVELS = [
  { id: 'ground', z: 0, icon: Trees },
  { id: 'floor', z: FLOOR, icon: Armchair },
  { id: 'table', z: TABLE, icon: LampDesk },
  { id: 'roof', z: ROOF, icon: House },
];

const levelOf = (z) => LEVELS.find((l) => Math.abs(l.z - z) < 1e-6)?.id ?? 'custom';

function bookAt(t) {
  if (t <= T_SLIDE) {
    const p = t / T_SLIDE;
    const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    return { x: BOOK_X0 + SLIDE * e, y: SHELF, phase: t > 0 ? 'slide' : 'rest' };
  }
  const tr = (t - T_SLIDE) / SLOW;
  const y = SHELF - 0.5 * G * tr * tr;
  if (y <= FLOOR) return { x: BOOK_X0 + SLIDE, y: FLOOR, phase: 'landed' };
  return { x: BOOK_X0 + SLIDE, y, phase: 'fall' };
}

const TONES = { ground: '#22d3ee', floor: '#22d3ee', table: '#fb7185', roof: '#fb7185', custom: '#a78bfa', slide: '#60a5fa', fall: '#fbbf24', done: '#34d399' };

export default function ZeroSim({ T }) {
  const Z = T.zero;
  const dec = T.decimal;
  const [z, setZ] = useState(FLOOR);
  const [m, setM] = useState(1);
  const [sim, setSim] = useState(IDLE);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(T_TOTAL, p.t + dt);
      const done = t >= T_TOTAL - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const mg = m * G;
  const EA = mg * (SHELF - z);
  const EB = mg * (FLOOR - z);
  const dE = EB - EA;
  const book = bookAt(sim.t);
  const level = levelOf(z);
  const S = (n) => smart(n, dec);
  const paren = (n) => (n < -1e-9 ? `(${S(n)})` : S(n));

  /* ---- explanation */
  let key = level;
  if (sim.done) key = 'done';
  else if (sim.running || sim.t > 0) key = book.phase === 'slide' ? 'slide' : 'fall';
  const settled = useSettled(key, key === 'custom' ? 260 : 0);
  const vals = {
    z: fmt(z, 1, dec),
    hA: S(SHELF - z),
    EA: S(EA),
    EB: S(EB),
    dE: S(dE),
    dEabs: S(-dE),
    EBminusEA: `${S(EB)} − ${paren(EA)}`,
    level: Z.levelShort[level] ?? Z.levelShort.custom(fmt(z, 1, dec)),
  };
  const text = Z.explain[settled](vals);
  const tone = TONES[settled] ?? '#22d3ee';

  const rows = LEVELS.map((l) => ({ id: l.id, z: l.z, name: Z.levels[l.id].name }));
  if (level === 'custom') rows.push({ id: 'custom', z, name: Z.table.custom(fmt(z, 1, dec)) });
  rows.sort((a, b) => a.z - b.z);

  const signColor = (n) => (n < -1e-9 ? EC.negText : EC.epText);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{Z.levelsLabel}</GroupLabel>
          <Segmented
            label={Z.levelsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={level}
            onChange={(id) => setZ(LEVELS.find((l) => l.id === id).z)}
            accent={EC.zero}
            options={LEVELS.map((l) => ({ value: l.id, label: Z.levels[l.id].name, sub: Z.levels[l.id].sub, icon: l.icon }))}
          />
        </div>
        <PlayControls
          labels={{ ...T.common, start: Z.drop, again: Z.again }}
          running={sim.running}
          done={sim.done}
          started={sim.t > 0}
          onToggle={toggle}
          onReset={reset}
        />
      </div>

      <ZeroScene T={T} z={z} setZ={setZ} m={m} book={book} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={Z.readouts.A}
          symbol={rich('E_A')}
          value={S(EA)}
          unit={T.J}
          accent={EA < -1e-9 ? EC.neg : EC.ep}
          textColor={signColor(EA)}
          sub={rich(Z.hSub('A', signed(SHELF - z, dec)))}
        />
        <Readout
          label={Z.readouts.B}
          symbol={rich('E_B')}
          value={S(EB)}
          unit={T.J}
          accent={EB < -1e-9 ? EC.neg : EC.ep}
          textColor={signColor(EB)}
          sub={rich(Z.hSub('B', signed(FLOOR - z, dec)))}
        />
        <Readout label={Z.readouts.dE} symbol={rich('ΔE_p')} value={S(dE)} unit={T.J} accent={EC.work} textColor={EC.workText} active sub={Z.dESub} />
        <Readout label={Z.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[16px] text-gray-100">
              <Formula text="ΔE_p = mg(h_B − h_A)" />
            </p>
            <p className="tabular-nums text-gray-400">
              = {S(m)} · {fmt(G, 1, dec)} · ({S(FLOOR - z)} − {paren(SHELF - z)}) = <b style={{ color: EC.workText }}>{S(dE)}</b> {T.J}
            </p>
            <p className="text-xs text-gray-500">{rich(Z.formulaNote)}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="pe-zero-z"
            label={Z.zeroField}
            symbol={rich('h_0')}
            min={0}
            max={Z_MAX}
            step={0.1}
            value={z}
            onChange={(n) => setZ(Math.round(n * 10) / 10)}
            accent={EC.zero}
            display={`${fmt(z, 1, dec)} ${T.m}`}
            valueText={`${fmt(z, 1, dec)} ${T.m}`}
            hint={Z.zeroHint}
          />
          <RangeField
            id="pe-zero-m"
            label={Z.mass}
            symbol="m"
            min={0.5}
            max={3}
            step={0.5}
            value={m}
            onChange={setM}
            accent={EC.mg}
            display={`${S(m)} ${T.kg}`}
            hint={Z.massHint(S(mg))}
          />
          <InfoBox title={Z.info.title}>{Z.info.text}</InfoBox>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{Z.table.title}</p>
          <table className="mt-2 w-full border-separate border-spacing-y-1 text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
                <th className="px-2 font-semibold">{Z.table.level}</th>
                <th className="hidden px-2 text-right font-semibold normal-case sm:table-cell">{rich(Z.table.hA)}</th>
                <th className="px-2 text-right font-semibold normal-case">{rich(Z.table.EA)}</th>
                <th className="px-2 text-right font-semibold normal-case">{rich(Z.table.EB)}</th>
                <th className="px-2 text-right font-semibold normal-case">{rich(Z.table.dE)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = Math.abs(r.z - z) < 1e-6;
                const a = mg * (SHELF - r.z);
                const b = mg * (FLOOR - r.z);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setZ(r.z)}
                    className={`cursor-pointer transition-colors ${on ? 'bg-cyan-400/10 text-white' : 'bg-white/[0.03] text-gray-300 hover:bg-white/[0.07]'}`}
                  >
                    <td className={`rounded-l-lg px-2 py-1.5 ${on ? 'font-semibold' : ''}`} style={on ? { boxShadow: `inset 3px 0 0 ${EC.zero}` } : undefined}>
                      <button type="button" className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 rounded" aria-pressed={on}>
                        {r.name}
                      </button>
                    </td>
                    <td className="hidden px-2 py-1.5 text-right sm:table-cell">
                      {signed(SHELF - r.z, dec)} {T.m}
                    </td>
                    <td className="px-2 py-1.5 text-right" style={{ color: signColor(a) }}>
                      {S(a)}
                    </td>
                    <td className="px-2 py-1.5 text-right" style={{ color: signColor(b) }}>
                      {S(b)}
                    </td>
                    <td className="rounded-r-lg px-2 py-1.5 text-right font-semibold" style={{ color: EC.workText }}>
                      {S(b - a)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">
            {rich(Z.table.note)} ({T.J})
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ scene */

const WX0 = -0.5;
const WX1 = 12.2;
const WX1_N = 9.7;
const WORLD_TOP = 7.0;

function ZeroScene({ T, z, setZ, m, book, running }) {
  const Z = T.zero;
  const dec = T.decimal;
  const mg = m * G;
  const drag = useRef(false);
  const level = levelOf(z);
  const EA = mg * (SHELF - z);
  const EB = mg * (FLOOR - z);

  return (
    <LabScene
      legend={[
        { color: EC.zero, label: Z.legend.zero, kind: 'dash' },
        { color: EC.ep, label: Z.legend.pos, kind: 'bar' },
        { color: EC.neg, label: Z.legend.neg, kind: 'bar' },
        { color: EC.work, label: Z.legend.dE, kind: 'arrow' },
      ]}
      chips={
        <Chip icon={Timer}>
          {Z.chip(SLOW)}
        </Chip>
      }
      height={(W, narrow) => {
        if (!narrow) return 500;
        const k = (W - 36 - 8) / (WX1_N - WX0);
        return clamp(40 + 30 + WORLD_TOP * k, 250, 380);
      }}
      ariaLabel={plain(Z.sceneLabel(Z.levelShort[level] ?? Z.levelShort.custom(fmt(z, 1, dec)), smart(EA, dec), smart(EB, dec)))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const topPad = narrow ? 40 : 62;
        const groundY = H - (narrow ? 26 : 34);
        const axisW = narrow ? 36 : 52;
        const panelW = narrow ? 0 : Math.round(clamp(W * 0.3, 250, 340));
        const sceneR = W - panelW;
        const wx1 = narrow ? WX1_N : WX1;
        const k = Math.min((sceneR - axisW - 8) / (wx1 - WX0), (groundY - topPad) / WORLD_TOP);
        const ox = axisW + (sceneR - axisW - (wx1 - WX0) * k) / 2 - WX0 * k;
        const sx = (xm) => ox + xm * k;
        const sy = (ym) => groundY - ym * k;
        const y0 = sy(z);

        const toZ = (e) => {
          const svg = e.currentTarget.ownerSVGElement ?? e.currentTarget;
          const r = svg.getBoundingClientRect();
          const py = ((e.clientY - r.top) / r.height) * H;
          let v = clamp((groundY - py) / k, 0, Z_MAX);
          const near = LEVELS.find((l) => Math.abs(l.z - v) < SNAP);
          v = near ? near.z : Math.round(v * 10) / 10;
          return v;
        };
        const onDown = (e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = true;
          setZ(toZ(e));
        };
        const onMove = (e) => {
          if (drag.current) setZ(toZ(e));
        };
        const onUp = () => {
          drag.current = false;
        };

        /* the book now */
        const bx0 = sx(book.x);
        const bx1 = sx(book.x + BOOK_W);
        const byTop = sy(book.y + BOOK_T);
        const byBot = sy(book.y);
        const hNow = book.y - z;
        const Enow = mg * hNow;
        const dimX = sx(book.x + BOOK_W + 0.3);
        const dimColor = hNow < -1e-9 ? EC.neg : EC.ep;

        /* axis ticks: whole metres from the zero line */
        const ticks = [];
        for (let j = Math.ceil(-z - 1e-9); z + j <= WORLD_TOP - 0.2; j += 1) ticks.push(j);

        const handleText = Z.handle(Z.levelShort[level] ?? Z.levelShort.custom(fmt(z, 1, dec)));

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={W} y1={groundY} cell={0.5 * k} ax={sx(0)} ay={groundY} />

            <HouseCut sx={sx} sy={sy} k={k} narrow={narrow} />
            <LevelTags Z={Z} sx={sx} sy={sy} fs={fs} narrow={narrow} />

            {/* above / below the zero level */}
            <rect x={0} y={0} width={W} height={Math.max(0, y0)} fill={EC.ep} opacity="0.045" pointerEvents="none" />
            <rect x={0} y={y0} width={W} height={Math.max(0, H - y0)} fill={EC.neg} opacity="0.06" pointerEvents="none" />

            {/* ghost of the other position */}
            {book.phase === 'rest' || book.phase === 'slide' ? (
              <rect x={sx(BOOK_X0 + SLIDE)} y={sy(FLOOR + BOOK_T)} width={BOOK_W * k} height={BOOK_T * k} rx={1.5} fill="none" stroke="#64748b" strokeWidth="1.3" strokeDasharray="4 3" />
            ) : (
              <rect x={sx(BOOK_X0)} y={sy(SHELF + BOOK_T)} width={BOOK_W * k} height={BOOK_T * k} rx={1.5} fill="none" stroke="#64748b" strokeWidth="1.3" strokeDasharray="4 3" />
            )}
            <HaloText x={sx(BOOK_X0) - 6} y={sy(SHELF) - 3} anchor="end" size={fs + 1} weight={800} fill={EC.ink}>
              A
            </HaloText>
            <HaloText x={sx(BOOK_X0 + SLIDE) - 6} y={sy(FLOOR) - 3} anchor="end" size={fs + 1} weight={800} fill={EC.ink}>
              B
            </HaloText>

            {/* guides from A and B to the energy panel */}
            {!narrow && (
              <g aria-hidden="true">
                <line x1={sx(7.75)} x2={sceneR + 40} y1={sy(SHELF)} y2={sy(SHELF)} stroke="#64748b" strokeOpacity="0.5" strokeDasharray="2 4" />
                <line x1={sx(BOOK_X0 + SLIDE + BOOK_W + 0.1)} x2={sceneR + 40} y1={sy(FLOOR)} y2={sy(FLOOR)} stroke="#64748b" strokeOpacity="0.5" strokeDasharray="2 4" />
              </g>
            )}

            {/* the book */}
            {running && <circle cx={(bx0 + bx1) / 2} cy={(byTop + byBot) / 2} r={BOOK_W * k * 0.7} fill={EC.ep} opacity="0.2" className="cl-pulse" />}
            <Book x0={bx0} x1={bx1} y0={byTop} y1={byBot} />

            {/* its height above (or below) the zero level */}
            <DimLine x={dimX} y1={y0} y2={byBot} color={dimColor} />
            <RichPill
              x={dimX + 7}
              y={Math.abs(byBot - y0) > 30 ? (y0 + byBot) / 2 : Math.min(y0, byBot) - 14}
              anchor="start"
              text={Z.hTag(signed(hNow, dec, 1))}
              bg="#ffffff"
              color={dimColor}
              border={dimColor}
              size={fs}
              box={{ w: sceneR, h: H }}
            />
            <RichPill
              x={(bx0 + bx1) / 2}
              y={byTop - (narrow ? 13 : 16)}
              text={Z.epTag(smart(Enow, dec, 2))}
              bg={hNow < -1e-9 ? EC.neg : EC.ep}
              size={fs}
              box={{ w: sceneR, h: H }}
            />

            <Ground x0={0} x1={sceneR} y={groundY} depth={H - groundY} />

            {/* h axis measured from the zero level */}
            <g aria-hidden="true">
              <rect x={0} y={0} width={axisW - 4} height={groundY} fill="#fbfcfe" opacity="0.9" />
              <line x1={axisW - 4} x2={axisW - 4} y1={topPad - 8} y2={groundY} stroke="#94a3b8" />
              {ticks.map((j) => (
                <g key={`t${j}`}>
                  <line x1={axisW - 9} x2={axisW - 4} y1={sy(z + j)} y2={sy(z + j)} stroke={j === 0 ? EC.zero : '#64748b'} strokeWidth={j === 0 ? 2 : 1} />
                  <text
                    x={axisW - 11}
                    y={sy(z + j) + 4}
                    textAnchor="end"
                    fontSize={fs - 1}
                    fontWeight={j === 0 ? 800 : 500}
                    fill={j === 0 ? EC.zero : j < 0 ? EC.neg : EC.ep}
                  >
                    {j > 0 ? `+${j}` : j < 0 ? `−${-j}` : '0'}
                  </text>
                </g>
              ))}
              <text x={6} y={sy(z + ticks[ticks.length - 1]) - 14} fontSize={fs - 1} fontWeight="700" fill="#475569">
                {Z.axisH}
              </text>
            </g>

            {!narrow && <EnergyPanel Z={Z} T={T} x0={sceneR} x1={W} top={topPad} sy={sy} y0={y0} z={z} mg={mg} fs={fs} groundY={groundY} />}

            {/* the zero line and its handle */}
            <g role="presentation" style={{ cursor: 'ns-resize', touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <rect x={0} y={y0 - 15} width={W} height={30} fill="transparent" />
              <line x1={axisW - 4} x2={W} y1={y0} y2={y0} stroke="#ffffff" strokeWidth="5" opacity="0.8" />
              <line x1={axisW - 4} x2={W} y1={y0} y2={y0} stroke={EC.zero} strokeWidth="2.4" strokeDasharray="9 5" />
              <RichPill x={axisW + 4} y={y0} anchor="start" text={handleText} bg={EC.zero} size={fs} box={box} />
            </g>
          </>
        );
      }}
    </LabScene>
  );
}

/** The bars E_A and E_B from the zero line, on the scene's metre scale, and the ΔE_p bracket. */
function EnergyPanel({ Z, T, x0, x1, top, sy, y0, z, mg, fs, groundY }) {
  const dec = T.decimal;
  const axisX = x0 + 58;
  const bw = clamp((x1 - axisX) * 0.17, 34, 48);
  const gap = clamp((x1 - axisX) * 0.08, 14, 26);
  const aX = axisX + 22;
  const bX = aX + bw + gap;
  const brX = bX + bw + 22;
  const yA = sy(SHELF);
  const yB = sy(FLOOR);
  const EA = mg * (SHELF - z);
  const EB = mg * (FLOOR - z);
  const dE = EB - EA;
  const ticks = [];
  for (let j = Math.ceil(-z - 1e-9); z + j <= WORLD_TOP - 0.2; j += 1) ticks.push(j);
  const bar = (x, yEnd, E, label) => {
    const neg = E < -1e-9;
    const col = neg ? EC.neg : EC.ep;
    const yT = Math.min(y0, yEnd);
    const hgt = Math.abs(yEnd - y0);
    return (
      <g>
        {hgt > 0.5 ? <rect x={x} y={yT} width={bw} height={hgt} rx={3} fill={col} opacity="0.88" /> : <rect x={x} y={y0 - 1.5} width={bw} height={3} fill={col} />}
        <text x={x + bw / 2} y={neg ? yEnd + 16 : yEnd - 7} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill={neg ? '#be123c' : '#1d4ed8'}>
          {smart(E, dec)}
        </text>
        <text x={x + bw / 2} y={groundY + 16} textAnchor="middle" fontSize={fs + 1} fontStyle="italic" fontWeight="700" fill="#334155">
          E
          <tspan fontSize={(fs + 1) * 0.72} dy={(fs + 1) * 0.28}>
            {label}
          </tspan>
        </text>
      </g>
    );
  };
  return (
    <g aria-hidden="true">
      <rect x={x0} y={0} width={x1 - x0} height={groundY + 40} fill="#f8fafc" opacity="0.7" />
      <line x1={x0} x2={x0} y1={10} y2={groundY + 30} stroke="#cbd5e1" strokeDasharray="4 5" />
      <text x={(x0 + x1) / 2} y={top + 8} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
        {richSvg(Z.panel.title, fs)}
      </text>
      <line x1={axisX} x2={axisX} y1={sy(WORLD_TOP - 0.2)} y2={groundY} stroke="#94a3b8" />
      {ticks.map((j) => (
        <g key={`e${j}`}>
          <line x1={axisX - 5} x2={axisX} y1={sy(z + j)} y2={sy(z + j)} stroke="#64748b" />
          <text x={axisX - 7} y={sy(z + j) + 4} textAnchor="end" fontSize={fs - 2} fill={j === 0 ? EC.zero : j < 0 ? '#be123c' : '#1d4ed8'} fontWeight={j === 0 ? 800 : 500}>
            {j === 0 ? '0' : signed(mg * j, dec)}
          </text>
        </g>
      ))}
      <text x={axisX - 7} y={sy(WORLD_TOP - 0.2) - 6} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {T.J}
      </text>
      {bar(aX, yA, EA, 'A')}
      {bar(bX, yB, EB, 'B')}
      {/* ΔE_p: from A's level to B's level, the same wherever the zero is */}
      <line x1={brX - 6} x2={brX + 6} y1={yA} y2={yA} stroke={EC.work} strokeWidth="2" />
      <line x1={brX} x2={brX} y1={yA} y2={yB - 10} stroke={EC.work} strokeWidth="2.6" />
      <path d={`M${brX},${yB} L${brX - 6},${yB - 11} L${brX + 6},${yB - 11} Z`} fill={EC.work} />
      <line x1={brX - 6} x2={brX + 6} y1={yB} y2={yB} stroke={EC.work} strokeWidth="2" />
      <RichPill x={brX + 8} y={(yA + yB) / 2 - 10} anchor="start" text={Z.panel.dE(smart(dE, dec))} bg={EC.work} size={fs - 1} box={{ w: x1 - 2, h: groundY }} />
      <text x={brX + 10} y={(yA + yB) / 2 + 16} fontSize={fs - 2} fill="#92400e" fontWeight="600">
        {Z.panel.same}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------- drawings */

function Book({ x0, x1, y0, y1 }) {
  const h = y1 - y0;
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y0} width={x1 - x0} height={h} rx={1.5} fill="#4f46e5" stroke="#312e81" strokeWidth="1.2" />
      <rect x={x0 + 2} y={y0 + h * 0.3} width={x1 - x0 - 4} height={Math.max(1.5, h * 0.4)} fill="#f8fafc" />
    </g>
  );
}

const WOOD = '#b7793f';

function HouseCut({ sx, sy, k, narrow }) {
  const X0 = 0;
  const X1 = 9.4;
  const R = (x0, y0, x1, y1, props) => <rect x={sx(x0)} y={sy(y1)} width={(x1 - x0) * k} height={(y1 - y0) * k} {...props} />;
  return (
    <g aria-hidden="true">
      {/* storeys */}
      {R(X0, 0, X1, 2.8, { fill: '#f1f5f9', stroke: '#94a3b8', strokeWidth: 1.2 })}
      {R(X0, FLOOR, X1, 5.8, { fill: '#fffdf8', stroke: '#94a3b8', strokeWidth: 1.2 })}
      {/* floor slab and roof */}
      {R(X0, 2.8, X1, FLOOR, { fill: '#cbd5e1', stroke: '#94a3b8' })}
      {R(X0, FLOOR - 0.01, X1, FLOOR + 0.05, { fill: '#d6b48a' })}
      {R(X0, 5.8, X1, ROOF, { fill: '#94a3b8', stroke: '#64748b' })}
      {R(X0 - 0.15, ROOF, X0 + 0.15, ROOF + 0.3, { fill: '#cbd5e1', stroke: '#94a3b8' })}
      {R(X1 - 0.15, ROOF, X1 + 0.15, ROOF + 0.3, { fill: '#cbd5e1', stroke: '#94a3b8' })}
      {/* ground floor: door and window */}
      {R(1.0, 0, 2.0, 2.2, { fill: '#a8a29e', stroke: '#78716c', rx: 1 })}
      <circle cx={sx(1.82)} cy={sy(1.1)} r={Math.max(1.5, 0.05 * k)} fill="#57534e" />
      {R(4.4, 0.9, 6.0, 2.3, { fill: '#dbeafe', stroke: '#94a3b8', rx: 1 })}
      <line x1={sx(5.2)} x2={sx(5.2)} y1={sy(2.3)} y2={sy(0.9)} stroke="#94a3b8" />
      {/* room: window */}
      {R(8.15, 3.9, 9.0, 5.3, { fill: '#e0f2fe', stroke: '#94a3b8', rx: 1 })}
      <line x1={sx(8.575)} x2={sx(8.575)} y1={sy(5.3)} y2={sy(3.9)} stroke="#94a3b8" />
      {/* table with a lamp */}
      {R(1.4, TABLE - 0.07, 3.8, TABLE, { fill: WOOD, stroke: '#7c4a1e', strokeWidth: 0.8 })}
      {R(1.55, FLOOR, 1.65, TABLE - 0.07, { fill: '#7c4a1e' })}
      {R(3.55, FLOOR, 3.65, TABLE - 0.07, { fill: '#7c4a1e' })}
      {!narrow && (
        <g>
          {R(3.0, TABLE, 3.3, TABLE + 0.04, { fill: '#475569' })}
          <line x1={sx(3.15)} y1={sy(TABLE + 0.04)} x2={sx(2.95)} y2={sy(TABLE + 0.5)} stroke="#475569" strokeWidth={Math.max(1.5, 0.04 * k)} />
          <path d={`M${sx(2.95)},${sy(TABLE + 0.5)} L${sx(2.6)},${sy(TABLE + 0.32)} L${sx(2.8)},${sy(TABLE + 0.22)} Z`} fill="#f59e0b" stroke="#b45309" strokeWidth="0.8" />
          {R(1.9, TABLE, 2.25, TABLE + 0.05, { fill: '#e2e8f0', stroke: '#94a3b8', strokeWidth: 0.6 })}
        </g>
      )}
      {/* wall shelf with standing books */}
      {R(5.6, SHELF - 0.07, 7.6, SHELF, { fill: WOOD, stroke: '#7c4a1e', strokeWidth: 0.8 })}
      <path d={`M${sx(5.8)},${sy(SHELF - 0.07)} L${sx(5.8)},${sy(SHELF - 0.4)} L${sx(6.1)},${sy(SHELF - 0.07)} Z`} fill="#94a3b8" />
      <path d={`M${sx(7.3)},${sy(SHELF - 0.07)} L${sx(7.3)},${sy(SHELF - 0.4)} L${sx(7.0)},${sy(SHELF - 0.07)} Z`} fill="#94a3b8" />
      {[
        [5.7, 0.42, '#16a34a'],
        [5.84, 0.36, '#f59e0b'],
        [5.97, 0.44, '#0ea5e9'],
        [6.11, 0.38, '#db2777'],
        [6.25, 0.4, '#64748b'],
      ].map(([x, hh, c]) => (
        <g key={`bk${x}`}>{R(x, SHELF, x + 0.12, SHELF + hh, { fill: c, stroke: '#1e293b', strokeWidth: 0.5, rx: 1 })}</g>
      ))}
      {/* tree outside */}
      {!narrow && (
        <g>
          {R(10.9, 0, 11.1, 1.6, { fill: '#a16207' })}
          <circle cx={sx(11)} cy={sy(2.25)} r={0.8 * k} fill="#bbf7d0" stroke="#16a34a" strokeWidth="1.2" />
          <circle cx={sx(10.55)} cy={sy(1.95)} r={0.48 * k} fill="#bbf7d0" stroke="#16a34a" strokeWidth="1.2" />
        </g>
      )}
    </g>
  );
}

function LevelTags({ Z, sx, sy, fs, narrow }) {
  const s = fs - 2;
  return (
    <g aria-hidden="true">
      <HaloText x={sx(9.6)} y={sy(ROOF) + 4} size={s} weight={600} fill="#64748b">
        {Z.tags.roof}
      </HaloText>
      <HaloText x={sx(1.35)} y={sy(TABLE) + 4} anchor="end" size={s} weight={600} fill="#64748b">
        {Z.tags.table}
      </HaloText>
      <HaloText x={sx(5.55)} y={sy(SHELF) + 4} anchor="end" size={s} weight={600} fill="#64748b">
        {Z.tags.shelf}
      </HaloText>
      <HaloText x={sx(9.25)} y={sy(FLOOR) - 5} anchor="end" size={s} weight={600} fill="#64748b">
        {Z.tags.floor}
      </HaloText>
      {!narrow && (
        <HaloText x={sx(9.6)} y={sy(0) - 5} size={s} weight={600} fill="#64748b">
          {Z.tags.ground}
        </HaloText>
      )}
    </g>
  );
}
