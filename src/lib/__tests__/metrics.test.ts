/**
 * src/lib/__tests__/metrics.test.ts — Métriques en mémoire.
 *
 * Aucun mock : `metrics.ts` est de la logique pure en mémoire. L'état vit sur
 * `globalThis` (survie au HMR) — `reset()` est appelé dans `beforeEach` pour
 * empêcher toute influence entre tests.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { increment, observe, reset, snapshot } from "@/lib/metrics";

/** Plafond global de séries (recopié de metrics.ts, constante interne). */
const MAX_SERIES = 1000;
/** Plafond de séries par nom de métrique (recopié de metrics.ts). */
const MAX_SERIES_PER_METRIC = 100;

describe("metrics — compteurs", () => {
  beforeEach(() => {
    reset();
  });

  it("increment puis snapshot reflète la valeur cumulée", () => {
    increment("analyses_total");
    increment("analyses_total");
    increment("analyses_total", undefined, 5);

    const snap = snapshot();
    expect(snap.counters).toHaveLength(1);
    expect(snap.counters[0]).toMatchObject({
      name: "analyses_total",
      labels: {},
      value: 7,
    });
    expect(snap.series).toBe(1);
  });

  it("les labels distinguent les séries", () => {
    increment("api_requests_total", { route: "/analyze" });
    increment("api_requests_total", { route: "/analyze" });
    increment("api_requests_total", { route: "/history" });

    const snap = snapshot();
    expect(snap.series).toBe(2);
    const analyze = snap.counters.find(
      (c) => c.labels.route === "/analyze"
    );
    const history = snap.counters.find((c) => c.labels.route === "/history");
    expect(analyze?.value).toBe(2);
    expect(history?.value).toBe(1);
  });

  it("les appels invalides sont ignorés sans jamais lever", () => {
    increment(""); // nom vide → ignoré
    increment("nom invalide avec espaces"); // caractère hors pattern → ignoré
    increment("ok_counter", undefined, Number.NaN); // valeur non finie → ignoré

    const snap = snapshot();
    expect(snap.counters).toHaveLength(0);
    expect(snap.series).toBe(0);
  });
});

describe("metrics — histogrammes", () => {
  beforeEach(() => {
    reset();
  });

  it("observe calcule count/sum/min/max/avg", () => {
    observe("analysis_duration_ms", 10);
    observe("analysis_duration_ms", 200);
    observe("analysis_duration_ms", 30);

    const snap = snapshot();
    expect(snap.histograms).toHaveLength(1);
    const hist = snap.histograms[0];
    expect(hist.name).toBe("analysis_duration_ms");
    expect(hist.count).toBe(3);
    expect(hist.sum).toBe(240);
    expect(hist.min).toBe(10);
    expect(hist.max).toBe(200);
    expect(hist.avg).toBe(80);
    // p50 approché : borné et cohérent avec la distribution.
    expect(hist.p50).toBeGreaterThan(0);
    expect(hist.p50).toBeLessThanOrEqual(hist.max);
  });
});

describe("metrics — bornage de cardinalité (anti-fuite)", () => {
  beforeEach(() => {
    reset();
  });

  it("le plafond MAX_SERIES_PER_METRIC agrège le surplus dans une série overflow", () => {
    // 150 valeurs de label distinctes pour UN même nom : 100 séries normales
    // + 1 série « overflow » agrégeant les 50 observations suivantes.
    for (let i = 0; i < MAX_SERIES_PER_METRIC + 50; i += 1) {
      increment("bounded_metric", { userId: `u-${i}` });
    }

    const snap = snapshot();
    expect(snap.series).toBeLessThanOrEqual(MAX_SERIES_PER_METRIC + 1);

    const overflow = snap.counters.find(
      (c) => c.labels.cardinality === "overflow"
    );
    expect(overflow).toBeDefined();
    expect(overflow?.value).toBe(50); // les 50 appels excédentaires agrégés
  });

  it("au-delà de MAX_SERIES séries globales, le plafond est respecté (pas de fuite)", () => {
    // 11 noms × 101 séries (100 + overflow) = 1111 séries demandées > 1000.
    const metricNames = 11;
    for (let m = 0; m < metricNames; m += 1) {
      for (let i = 0; i <= MAX_SERIES_PER_METRIC; i += 1) {
        increment(`card_metric_${m}`, { label: `v-${i}` });
      }
    }

    const snap = snapshot();
    expect(snap.series).toBe(MAX_SERIES); // plafond exact, jamais au-delà
    expect(snap.series).toBeLessThanOrEqual(snap.maxSeries);
  });
});

describe("metrics — reset", () => {
  beforeEach(() => {
    reset();
  });

  it("reset() vide tout l'état", () => {
    increment("emails_sent");
    observe("analysis_duration_ms", 42);
    expect(snapshot().series).toBe(2);

    reset();

    const snap = snapshot();
    expect(snap.series).toBe(0);
    expect(snap.counters).toHaveLength(0);
    expect(snap.histograms).toHaveLength(0);
  });
});
