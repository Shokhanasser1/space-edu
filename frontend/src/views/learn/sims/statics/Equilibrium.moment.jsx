import { useId, useState } from 'react';
import { DoorOpen, Grid3x3, Hand, Lightbulb, MoveDiagonal, Target } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph, makeView } from '../kit/scene';
import {
  AngleArc,
  Chip,
  DimLine,
  Eq,
  ForceArrow,
  ForceScale,
  GroupLabel,
  InfoBox,
  LabScene,
  MethodPanel,
  MomentArc,
  Panel,
  PaperGrid,
  RightAngle,
  SceneRow,
  Step,
  Sym,
  SvgSym,
  ceil4,
  deg,
  rad,
} from './Equilibrium.parts';

/**
 * Tab 2 — the moment of a force on a door seen from above. The door turns
 * about its hinge O; a force F acts at distance r from O at an angle α to
 * the door.
 *   lever arm   d = r·sinα   (the perpendicular from O to the line of action)
 *   moment      M = F·d = F·r·sinα = F⊥·r
 * A door closer resists with M_p = k·φ (k = 20 N·m/rad), so the door turns
 * until M = k·φ — ΣM = 0 again, and a bigger moment opens it wider.
 * Preset: F = 20 N at the handle (r = 0.8 m) at 90°: d = 0.8 m, M = 16 N·m,
 * φ = 0.80 rad ≈ 45.8°. Near the hinge (r = 0.1 m) the same 20 N gives only
 * 2 N·m; at α = 30° d = 0.4 m, M = 8 N·m; pushed towards the hinge, d = 0.
 */

const COL = {
  F: '#dc2626',
  FText: '#fca5a5',
  arm: '#d97706',
  armText: '#fcd34d',
  r: '#475569',
  M: '#dc2626',
  Mp: '#0891b2',
  MpText: '#67e8f9',
  door: '#e7c9a0',
  doorEdge: '#a16207',
};

const DOOR_L = 0.9; // m
const DOOR_T = 0.045; // m
const HANDLE_R = 0.8; // m
const K_SPRING = 20; // N·m/rad, the door closer
const I_DOOR = (20 * DOOR_L ** 2) / 3; // kg·m², a 20 kg door about its edge
const C_DOOR = 2 * 0.8 * Math.sqrt(K_SPRING * I_DOOR); // the closer's damping
const PHI_MAX = rad(110);
const F_MAX = 40;
const SWEEP_PER_NM = rad(240) / (F_MAX * DOOR_L); // the same angular scale for M and M_p
const BOX = { x0: -0.55, x1: 1.28, y0: -0.48, y1: 1.08 };
const F_LEN = 0.6; // m of drawing for the largest force

const PRESETS = {
  handle: { F: 20, r: 0.8, a: 90, icon: DoorOpen },
  hinge: { F: 20, r: 0.1, a: 90, icon: Hand },
  slant: { F: 20, r: 0.8, a: 30, icon: MoveDiagonal },
  axis: { F: 20, r: 0.8, a: 180, icon: Target },
};

const r2 = (v) => Math.round(v * 100) / 100;

function momentPhysics(F, r, a) {
  const sa = Math.sin(rad(a));
  const ca = Math.cos(rad(a));
  const d = Math.abs(sa) < 1e-12 ? 0 : r * sa;
  const M = F * d;
  return { sa, ca, d, M, Fp: F * sa, Fl: F * ca, phiEq: Math.min(PHI_MAX, M / K_SPRING) };
}

/* ==================================================================== sim */

export default function MomentSim({ T }) {
  const L = T.moment;
  const dec = T.decimal;
  const [F, setF] = useState(20);
  const [r, setR] = useState(0.8);
  const [a, setA] = useState(90);
  const [door, setDoor] = useState({ phi: 0.8, om: 0 });
  const [touched, setTouched] = useState(false);
  const ph = momentPhysics(F, r, a);
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].F === F && PRESETS[k].r === r && PRESETS[k].a === a) ?? null;
  const moving = Math.abs(door.phi - ph.phiEq) > 1e-4 || Math.abs(door.om) > 1e-3;

  useRafLoop(moving, (dt) => {
    setDoor((p) => {
      let { phi, om } = p;
      const n = 6;
      const h = dt / n;
      for (let i = 0; i < n; i += 1) {
        const acc = (ph.M - K_SPRING * phi - C_DOOR * om) / I_DOOR;
        om += acc * h;
        phi += om * h;
        if (phi < 0) {
          phi = 0;
          om = Math.max(0, om);
        } else if (phi > PHI_MAX) {
          phi = PHI_MAX;
          om = Math.min(0, om);
        }
      }
      if (Math.abs(phi - ph.phiEq) < 1e-4 && Math.abs(om) < 1e-3) return { phi: ph.phiEq, om: 0 };
      return { phi, om };
    });
  });

  const change = (fn) => (v) => {
    fn(v);
    setTouched(true);
  };
  const pick = (id) => {
    const p = PRESETS[id];
    setF(p.F);
    setR(p.r);
    setA(p.a);
    setTouched(true);
  };

  const F2 = (v) => fmt(v, 2, dec);
  const F1 = (v) => fmt(v, 1, dec);
  const Mh = F * HANDLE_R; // what the same force gives at the handle, at 90°
  const Fneed = ph.d > 1e-9 ? Mh / ph.d : Infinity;

  let key;
  if (F === 0) key = 'noForce';
  else if (ph.d < 1e-6) key = 'zero';
  else if (!touched && preset === 'handle') key = 'intro';
  else if (r <= 0.25 + 1e-9) key = 'near';
  else if (a === 90) key = 'perp';
  else key = 'slant';
  const settled = useSettled(`${key}|${F}|${r}|${a}`, 240);
  const sKey = settled.split('|')[0];
  const ex = L.explain;
  const phiDeg = fmt(deg(ph.phiEq), 1, dec);
  const text = {
    intro: ex.intro(F2(ph.d), F1(ph.M), phiDeg),
    noForce: ex.noForce,
    zero: ex.zero,
    near: ex.near(F1(ph.M), F, F1(Mh), fmt(Fneed, 0, dec)),
    perp: ex.perp(F2(r), F1(ph.M), phiDeg),
    slant: ex.slant(F2(ph.d), F2(r), F1(ph.Fp), F1(Math.abs(ph.Fl)), F1(ph.M)),
  }[sKey];
  const tone = { intro: '#22d3ee', noForce: '#94a3b8', zero: '#f87171', near: '#fbbf24', perp: '#34d399', slant: '#fb923c' }[sKey];

  const need = (rr) => (ph.M > 1e-9 ? `${fmt(ph.M / rr, ph.M / rr >= 100 ? 0 : 1, dec)} ${T.N}` : '—');

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <GroupLabel>{L.presetsLabel}</GroupLabel>
        <Segmented
          label={L.presetsLabel}
          className="grid-cols-2 md:grid-cols-4"
          size="lg"
          value={preset}
          onChange={pick}
          options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
        />
      </div>

      <SceneRow
        renderScene={(fitH) => <DoorScene T={T} F={F} r={r} a={a} ph={ph} phi={door.phi} fitH={fitH} />}
        method={<MomentMethod T={T} F={F} r={r} a={a} ph={ph} />}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.d} symbol="d" value={F2(ph.d)} unit={T.m} accent={COL.arm} textColor={COL.armText} sub={<Sym>{L.readouts.dSub(F2(r), fmt(ph.sa, 3, dec))}</Sym>} />
        <Readout label={L.readouts.M} symbol="M" value={F1(ph.M)} unit={T.Nm} accent={COL.M} textColor={COL.FText} sub={<Sym>{L.readouts.MSub(F, F2(ph.d))}</Sym>} active={ph.M > 0} />
        <Readout
          label={L.readouts.Fp}
          symbol={<Sym>{'F_{⊥}'}</Sym>}
          value={F1(ph.Fp)}
          unit={T.N}
          accent={COL.F}
          textColor={COL.FText}
          sub={<Sym>{L.readouts.FpSub(F1(Math.abs(ph.Fl)))}</Sym>}
        />
        <Readout
          label={L.readouts.phi}
          symbol="φ"
          value={fmt(deg(door.phi), 1, dec)}
          unit="°"
          accent={COL.Mp}
          textColor={COL.MpText}
          sub={<Sym>{L.readouts.phiSub(F1(K_SPRING * door.phi))}</Sym>}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-2">
          <RangeField id="eq-F" label={L.F} symbol="F" min={0} max={F_MAX} step={1} value={F} onChange={change(setF)} accent={COL.F} display={`${F} ${T.N}`} />
          <RangeField
            id="eq-r"
            label={L.r}
            symbol="r"
            min={0.05}
            max={DOOR_L}
            step={0.05}
            value={r}
            onChange={change((v) => setR(r2(v)))}
            accent="#94a3b8"
            display={`${F2(r)} ${T.m}`}
            hint={L.rHint(F2(HANDLE_R))}
          />
          <RangeField id="eq-a" label={L.a} symbol="α" min={0} max={180} step={5} value={a} onChange={change(setA)} accent={COL.arm} display={`${a}°`} hint={L.aHint(fmt(ph.sa, 3, dec))} />
          <InfoBox
            title={L.info.title(F1(ph.M))}
            items={[
              [`r = ${F2(0.9)} ${T.m}`, need(0.9), '#fde68a'],
              [`r = ${F2(0.45)} ${T.m}`, need(0.45), '#fdba74'],
              [`r = ${F2(0.1)} ${T.m}`, need(0.1), '#fca5a5'],
            ]}
          >
            <p className="mt-2 text-[11px] leading-snug text-gray-500">{L.info.note}</p>
          </InfoBox>
        </Panel>
        <Panel className="lg:col-span-3">
          <MomentGraph T={T} F={F} r={r} a={a} ph={ph} onPick={(x) => change(setR)(clamp(Math.round(x * 20) / 20, 0.05, DOOR_L))} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function doorView(W, H, narrow) {
  return makeView(BOX, W, H, narrow ? { l: 6, r: 6, t: 38, b: 6 } : { l: 12, r: 12, t: 56, b: 10 });
}

function DoorScene({ T, F, r, a, ph, phi, fitH }) {
  const L = T.moment;
  const dec = T.decimal;
  return (
    <LabScene
      legend={[
        { color: COL.F, label: L.legend.F, kind: 'arrow' },
        { color: COL.arm, label: L.legend.d, kind: 'dim' },
        { color: '#64748b', label: L.legend.line, kind: 'dashline' },
        { color: COL.M, label: L.legend.M, kind: 'arc' },
        { color: COL.Mp, label: L.legend.Mp, kind: 'arc' },
      ]}
      chips={(W, narrow, H) => {
        const view = doorView(W, H, narrow);
        return (
          <>
            {!narrow && (
              <Chip icon={Grid3x3} color="#64748b">
                {L.cell(fmt(0.1, 1, dec))}
              </Chip>
            )}
            <ForceScale kF={(F_LEN * view.k) / F_MAX} label={T.scale} unit={T.N} decimal={dec} />
          </>
        );
      }}
      height={(W, narrow) => fitH ?? (narrow ? Math.max(300, W * 0.86) : 470)}
      ariaLabel={L.sceneLabel(F, fmt(r, 2, dec), a, fmt(ph.d, 2, dec), fmt(ph.M, 1, dec), fmt(deg(phi), 0, dec))}
    >
      {(W, H, narrow) => <DoorDrawing T={T} W={W} H={H} narrow={narrow} F={F} r={r} a={a} ph={ph} phi={phi} />}
    </LabScene>
  );
}

function DoorDrawing({ T, W, H, narrow, F, r, a, ph, phi }) {
  const L = T.moment;
  const dec = T.decimal;
  const hatchId = useId().replace(/:/g, '');
  const view = doorView(W, H, narrow);
  const { k } = view;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12.5;
  const box = { w: W, h: H };
  const kF = (F_LEN * k) / F_MAX;
  const O = { x: X(0), y: Y(0) };
  const e = { x: Math.cos(phi), y: Math.sin(phi) }; // along the door (world)
  const nrm = { x: -e.y, y: e.x }; // across it, towards the room
  const psi = phi + rad(a);
  const u = { x: Math.cos(psi), y: Math.sin(psi) }; // the force direction (world)
  const P = { x: X(r * e.x), y: Y(r * e.y) };
  const Q = { x: X(r * e.x - r * ph.ca * u.x), y: Y(r * e.y - r * ph.ca * u.y) }; // foot of the perpendicular from O
  const us = { x: u.x, y: -u.y }; // screen
  const doorDeg = (-phi * 180) / Math.PI;
  const wallH = 0.12;

  /* the line of action, long enough to cross the drawing */
  const far = 3 * k;
  const line = { x1: P.x - us.x * far, y1: P.y - us.y * far, x2: P.x + us.x * far, y2: P.y + us.y * far };

  /* force components at P */
  const Fp = ph.Fp * kF;
  const Fl = ph.Fl * kF;
  const showComp = F > 0 && a % 180 !== 0 && a !== 90;

  /* right-angle mark at Q */
  const toO = { x: O.x - Q.x, y: O.y - Q.y };
  const lo = Math.hypot(toO.x, toO.y) || 1;
  const toP = { x: P.x - Q.x, y: P.y - Q.y };
  const lp = Math.hypot(toP.x, toP.y);
  const along = lp > 2 ? { x: toP.x / lp, y: toP.y / lp } : us;
  const markS = narrow ? 6 : 8;

  /* moments, both on one angular scale: equal arcs when the door is at rest */
  const rM = clamp(0.19 * k, 20, 64);
  const rMp = clamp(0.1 * k, 12, 34);
  const sweepM = Math.min(rad(300), ph.M * SWEEP_PER_NM);
  const Mp = K_SPRING * phi;
  const sweepMp = Math.min(rad(300), Mp * SWEEP_PER_NM);

  /* labels */
  const dMid = { x: (O.x + Q.x) / 2, y: (O.y + Q.y) / 2 };
  const showArm = ph.d * k > 8;
  const armAway = { x: P.x, y: P.y };
  const nArm = { x: -(Q.y - O.y) / lo, y: (Q.x - O.x) / lo };
  const armSide = (dMid.x + nArm.x - armAway.x) ** 2 + (dMid.y + nArm.y - armAway.y) ** 2 > (dMid.x - nArm.x - armAway.x) ** 2 + (dMid.y - nArm.y - armAway.y) ** 2 ? 1 : -1;

  const swing = [];
  for (let i = 0; i <= 22; i += 1) {
    const t = (PHI_MAX * i) / 22;
    swing.push(`${X(DOOR_L * Math.cos(t)).toFixed(1)},${Y(DOOR_L * Math.sin(t)).toFixed(1)}`);
  }

  /* the r label sits on the side of the door away from the force */
  const rSide = ph.sa >= 0 ? -1 : 1;
  const rLab = { x: X((r / 2) * e.x + rSide * 0.06 * nrm.x), y: Y((r / 2) * e.y + rSide * 0.06 * nrm.y) + fs * 0.35 };

  return (
    <g>
      <defs>
        <pattern id={`hatch${hatchId}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#e2e8f0" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2" />
        </pattern>
      </defs>
      <PaperGrid view={view} W={W} H={H} step={narrow ? 0.2 : 0.1} />

      {/* room and corridor captions */}
      {!narrow && (
        <>
          <text x={X(1.24)} y={Y(0.1)} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#94a3b8">
            {L.room}
          </text>
          <text x={X(1.24)} y={Y(-0.1) + fs} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#94a3b8">
            {L.corridor}
          </text>
        </>
      )}

      {/* wall with the doorway */}
      <rect x={X(BOX.x0 - 0.1)} y={Y(wallH / 2)} width={(0 - BOX.x0 + 0.1) * k - 0.035 * k} height={wallH * k} fill={`url(#hatch${hatchId})`} stroke="#64748b" strokeWidth="1.5" />
      <rect x={X(DOOR_L + 0.035)} y={Y(wallH / 2)} width={(BOX.x1 + 0.1 - DOOR_L - 0.035) * k} height={wallH * k} fill={`url(#hatch${hatchId})`} stroke="#64748b" strokeWidth="1.5" />

      {/* the door's swing */}
      <polyline points={swing.join(' ')} fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 5" />

      {/* line of action and lever arm */}
      {F > 0 && <line {...line} stroke="#64748b" strokeWidth="1.3" strokeDasharray="7 5" opacity="0.85" />}
      {/* the door */}
      <g transform={`rotate(${doorDeg.toFixed(2)} ${O.x} ${O.y})`}>
        <rect x={O.x} y={O.y - (DOOR_T / 2) * k} width={DOOR_L * k} height={DOOR_T * k} rx={2} fill={COL.door} stroke={COL.doorEdge} strokeWidth="1.5" />
        <rect x={X(HANDLE_R - 0.05)} y={O.y - (DOOR_T / 2 + 0.035) * k} width={0.1 * k} height={0.035 * k} rx={2} fill="#475569" />
        <circle cx={X(HANDLE_R)} cy={O.y - (DOOR_T / 2) * k} r={Math.max(1.5, 0.012 * k)} fill="#1e293b" />
      </g>
      {/* the lever arm, drawn over the door (at α = 90° it runs along it) */}
      {F > 0 && showArm && (
        <>
          <DimLine
            x1={O.x}
            y1={O.y}
            x2={Q.x}
            y2={Q.y}
            color={COL.arm}
            width={narrow ? 2.4 : 3}
            label="d"
            value={`${fmt(ph.d, 2, dec)} ${T.m}`}
            fs={fs}
            side={armSide}
            box={box}
          />
          {Math.abs(ph.ca) > 1e-6 && <RightAngle x={Q.x} y={Q.y} ux={toO.x / lo} uy={toO.y / lo} vx={along.x} vy={along.y} s={markS} color={COL.arm} />}
        </>
      )}

      {/* r along the door (not when the arm already runs along it) */}
      {r * k > 30 && !(F > 0 && Math.abs(ph.ca) < 0.05) && (
        <SvgSym x={rLab.x} y={rLab.y} text="r" value={`${fmt(r, 2, dec)} ${T.m}`} color={COL.r} fs={fs - 1} weight={600} anchor="middle" />
      )}

      {/* moments about O */}
      <MomentArc cx={O.x} cy={O.y} r={rM} from={-(phi + rad(14))} sweep={-sweepM} color={COL.M} width={narrow ? 2.6 : 3.2} head={narrow ? 9 : 11} label="M" value={`${fmt(ph.M, 1, dec)} ${T.Nm}`} fs={fs} box={box} />
      <MomentArc
        cx={O.x}
        cy={O.y}
        r={rMp}
        from={-(phi - rad(12))}
        sweep={sweepMp}
        color={COL.Mp}
        width={narrow ? 2.2 : 2.6}
        head={narrow ? 8 : 9}
      />

      {/* hinge */}
      <circle cx={O.x} cy={O.y} r={Math.max(4, 0.028 * k)} fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
      <circle cx={O.x} cy={O.y} r={1.8} fill="#0f172a" />
      <text x={O.x - 0.05 * k} y={O.y + 0.1 * k + 4} textAnchor="end" fontSize={fs} fontWeight="700" fontStyle="italic" fill="#0f172a" stroke="#fff" strokeWidth="3" paintOrder="stroke">
        O
      </text>

      {/* the force and its parts */}
      {showComp && (
        <>
          <ForceArrow x={P.x} y={P.y} dx={nrm.x * Fp} dy={-nrm.y * Fp} color={COL.F} width={2} head={8} dash="5 4" opacity={0.75} label="F_{⊥}" fs={fs - 1.5} box={box} />
          {Math.abs(Fl) > 6 && <ForceArrow x={P.x} y={P.y} dx={e.x * Fl} dy={-e.y * Fl} color={COL.F} width={2} head={8} dash="5 4" opacity={0.75} label="F_{∥}" fs={fs - 1.5} box={box} />}
        </>
      )}
      {F > 0 && a % 180 !== 0 && a !== 90 && (
        <AngleArc cx={P.x} cy={P.y} r={narrow ? 15 : 20} from={-phi} to={-psi} label="α" color={COL.arm} fs={fs} labelR={narrow ? 25 : 32} />
      )}
      {F > 0 && a === 90 && <RightAngle x={P.x} y={P.y} ux={e.x} uy={-e.y} vx={us.x} vy={us.y} s={markS} color={COL.arm} />}
      <ForceArrow
        x={P.x}
        y={P.y}
        dx={us.x * F * kF}
        dy={us.y * F * kF}
        color={COL.F}
        label="F"
        value={`${F} ${T.N}`}
        fs={fs}
        box={box}
        width={narrow ? 2.8 : 3.4}
        labelAt={Math.abs(ph.sa) < 0.3 ? { x: P.x + (us.x * F * kF) / 2 + nrm.x * 18, y: P.y + (us.y * F * kF) / 2 - nrm.y * 18 - 4, anchor: 'middle' } : undefined}
      />
      <circle cx={P.x} cy={P.y} r={narrow ? 3.5 : 4.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
    </g>
  );
}

/* =========================================================== the method */

function MomentMethod({ T, F, r, a, ph }) {
  const L = T.moment;
  const M = L.method;
  const dec = T.decimal;
  const F2 = (v) => fmt(v, 2, dec);
  const F1 = (v) => fmt(v, 1, dec);
  return (
    <MethodPanel badge="M = F·d" title={M.title}>
      <Step n={1} title={M.s1}>
        <p className="mt-0.5">
          <Sym>{M.axis}</Sym>
        </p>
      </Step>
      <Step n={2} title={M.s2}>
        <Eq sym="d = r·sinα" nums={`d = ${F2(r)}·sin${a}° = ${F2(r)}·${fmt(ph.sa, 3, dec)} =`} result={`${F2(ph.d)} ${T.m}`} resultColor={COL.armText} />
      </Step>
      <Step n={3} title={M.s3}>
        <Eq sym="M = F·d" nums={`M = ${F}·${F2(ph.d)} =`} result={`${F1(ph.M)} ${T.Nm}`} resultColor={COL.FText} />
        <Eq sym="M = F_{⊥}·r = F·sinα·r" nums={`= ${F1(ph.Fp)}·${F2(r)} = ${F1(ph.M)} ${T.Nm}`} />
        <p className="mt-1 text-[12px] text-gray-400">
          <Sym>{M.parallel(F1(Math.abs(ph.Fl)))}</Sym>
        </p>
      </Step>
      <Step n={4} title={M.s4}>
 <Eq sym={`M − ${T.sym.Mp} = 0,  ${T.sym.Mp} = k·φ  ⇒  φ = M / k`} nums={`φ = ${F1(ph.M)} / ${K_SPRING} = ${F2(ph.phiEq)} ${T.rad} ≈`} result={`${fmt(deg(ph.phiEq), 1, dec)}°`} resultColor={COL.MpText} />
        <p className="mt-1 text-[12px] text-gray-400">{M.closer(K_SPRING)}</p>
      </Step>
    </MethodPanel>
  );
}

/* ================================================================ graph */

function MomentGraph({ T, F, r, a, ph, onPick }) {
  const L = T.moment;
  const dec = T.decimal;
  const yMax = ceil4(Math.max(F * DOOR_L, 4));
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'max', label: L.graph.max, color: '#fca5a5', points: [{ x: 0, y: 0 }, { x: DOOR_L, y: F * DOOR_L }], dot: false, dash: '6 5' },
        { id: 'now', label: L.graph.line(a), color: '#fdba74', points: [{ x: 0, y: 0 }, { x: DOOR_L, y: F * Math.max(0, ph.sa) * DOOR_L }], dot: false },
        { id: 'handle', label: L.graph.handle, color: '#34d399', points: [{ x: HANDLE_R, y: F * Math.max(0, ph.sa) * HANDLE_R }] },
        { id: 'pt', label: L.graph.now, color: '#ffffff', points: [{ x: r, y: ph.M }] },
      ]}
      xMax={1}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={r}
      decimal={dec}
      xDigits={2}
      height={286}
      ariaLabel={L.graph.label(F, a)}
      onScrub={onPick}
      note={L.graph.note}
    />
  );
}
