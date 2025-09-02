export const TIERS = [
    { key: "bronzo",   label: "Bronzo",   minPoints: 50  },
    { key: "argento",  label: "Argento",  minPoints: 300 },
    { key: "oro",      label: "Oro",      minPoints: 900 },
    { key: "platino",  label: "Platino",  minPoints: 1300 },
    { key: "rubino",   label: "Rubino",   minPoints: 1700 },
    { key: "diamante", label: "Diamante", minPoints: 2300 },
    { key: "universo", label: "Universo", minPoints: 3500 }
  ];

  export const MILESTONES = [
    { id: "tier-bronzo",   type: "tier",   payload: { borderKey: "bronzo"   }, points: 50  },
    { id: "ticket-1",      type: "ticket", payload: { amount: 1 },           points: 300 },
    { id: "tier-argento",  type: "tier",   payload: { borderKey: "argento"  }, points: 500 },
    { id: "ticket-2",      type: "ticket", payload: { amount: 2 },           points: 700 },
    { id: "tier-oro",      type: "tier",   payload: { borderKey: "oro"      }, points: 900 },
    { id: "ticket-3",      type: "ticket", payload: { amount: 3 },           points: 1100 },
    { id: "tier-platino",  type: "tier",   payload: { borderKey: "platino"  }, points: 1300 },
    { id: "ticket-4",      type: "ticket", payload: { amount: 4 },           points: 1500 },
    { id: "tier-rubino",   type: "tier",   payload: { borderKey: "rubino"   }, points: 1700 },
    { id: "ticket-5",      type: "ticket", payload: { amount: 5 },           points: 2000 },
    { id: "tier-diamante", type: "tier",   payload: { borderKey: "diamante" }, points: 2300 },
    { id: "ticket-6",      type: "ticket", payload: { amount: 6 },           points: 3000 },
    { id: "tier-universo", type: "tier",   payload: { borderKey: "universo" }, points: 3500 }
  ];

  export function unlockedBorders(points) {
    return TIERS.filter(t => points >= t.minPoints).map(t => t.key);
  }

  export function computeProgress(points) {
    const last = [...MILESTONES].reverse().find(m => points >= m.points);
    const next = MILESTONES.find(m => m.points > (last?.points ?? 0));
    const startPts = last?.points ?? 0;
    const endPts = next?.points ?? startPts + 1;
    const segmentProgress = (points - startPts) / Math.max(1, (endPts - startPts));
    const absolute = points / MILESTONES[MILESTONES.length - 1].points;
    return {
      segmentStart: startPts,
      segmentEnd: endPts,
      segmentProgress: Math.max(0, Math.min(1, segmentProgress)),
      absolute: Math.max(0, Math.min(1, absolute))
    };
  }

