import { lazy, Suspense, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A temporary page for choosing how the physics lessons' simulators should
 * look and work. The same lesson - "Basic concepts in mechanics", the first
 * physics lesson - is built four different ways; the one chosen becomes the
 * pattern for every other lesson, and this page goes away.
 *
 * The variants are Uzbek only while they are prototypes; the chosen one is
 * made trilingual through the locale files like the rest of the site.
 */

const VARIANTS = [
  {
    id: 'a',
    title: 'A — Klassik laboratoriya',
    blurb: "Toza 2D sahna, tugmalar, slayderlar va jonli ko'rsatkichlar. Siz yuborgan arava namunasiga o'xshash, lekin boyitilgan.",
    Component: lazy(() => import('./preview/VariantClassicLab')),
  },
  {
    id: 'b',
    title: "B — O'yin: o'zing chiz",
    blurb: "Trayektoriyani barmoq/sichqoncha bilan chizasiz, qahramon yuradi; yulduzli topshiriqlar bilan o'yin.",
    Component: lazy(() => import('./preview/VariantDrawGame')),
  },
  {
    id: 'c',
    title: 'C — 3D sahna',
    blurb: "3D shahar va yo'l: avtobus, kamera bilan sanoq sistemasini almashtirish, moddiy nuqtagacha uzoqlashish.",
    Component: lazy(() => import('./preview/Variant3DScene')),
  },
  {
    id: 'd',
    title: 'D — Qadam-baqadam',
    blurb: "Har bir tushunchaga bitta kichik interaktiv: moddiy nuqta, sanoq sistemasi, yo'l va ko'chish, so'ng tekshiruv savollari.",
    Component: lazy(() => import('./preview/VariantGuidedSteps')),
  },
];

/** The four variants with their tabs: what the first lesson's Lab shows for now. */
export function SimVariants() {
  const [params, setParams] = useSearchParams();
  const [active, setActive] = useState(() => VARIANTS.find((v) => v.id === params.get('v'))?.id ?? 'a');
  const variant = VARIANTS.find((v) => v.id === active) ?? VARIANTS[0];
  const { Component } = variant;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400 max-w-3xl">
        Bitta dars to'rt xil usulda qilingan. Bittasini tanlang — qolgan hamma darslarning simulyatorlari shu
        uslubda yasaladi.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="tablist">
        {VARIANTS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={v.id === active}
            onClick={() => {
              setActive(v.id);
              setParams({ v: v.id }, { replace: true });
            }}
            className={`text-left rounded-2xl border p-3 min-h-[40px] transition-colors ${
              v.id === active ? 'border-cyan-300/60 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <span className="block text-sm font-semibold">{v.title}</span>
            <span className="block text-xs text-gray-400 mt-1">{v.blurb}</span>
          </button>
        ))}
      </div>

      <Suspense fallback={<div className="h-[560px] rounded-3xl border border-white/10 bg-white/5 animate-pulse" />}>
        <Component key={variant.id} />
      </Suspense>
    </div>
  );
}

export default function SimPreviewView() {
  return (
    <div className="max-w-6xl mx-auto px-4 pt-28 pb-16 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-cyan-300">Fizika · 1-mavzu · 1-dars</p>
        <h1 className="text-2xl md:text-3xl font-bold">Mexanikaning asosiy tushunchalari — simulyator variantlari</h1>
      </header>
      <SimVariants />
    </div>
  );
}
