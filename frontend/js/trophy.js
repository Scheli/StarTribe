const token = localStorage.getItem("token");

async function loadTrophy() {
  if (!token) return;
  const res = await fetch("http://localhost:8080/api/trophy", {
    headers: { Authorization: "Bearer " + token }
  });
  const data = await res.json();
  if (!data.success) return;

  placeMilestones(data.milestones);
  moveRocket(data.progress.absolute);

  document.querySelectorAll(".milestone.claimable").forEach(node => {
    node.addEventListener("click", async () => {
      const id = node.dataset.mid;
      const r = await fetch("http://localhost:8080/api/trophy/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ milestoneId: id })
      });
      const jr = await r.json();
      if (jr.success) {
        await loadTrophy();
      } else {
        alert(jr.message || "Impossibile riscattare");
      }
    });
  });
}

function svgPointAt(t) {
  const path = document.getElementById("trophyPath");
  const len = path.getTotalLength();
  const tt = Math.max(0, Math.min(1, t));
  const p = path.getPointAtLength(len * tt);
  const p2 = path.getPointAtLength(Math.min(len, len * tt + 1));
  const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
  return { x: p.x, y: p.y, angle };
}

function placeMilestones(milestones) {
  const layer = document.getElementById("milestonesLayer");
  while (layer.firstChild) layer.removeChild(layer.firstChild);
  const lastPts = milestones[milestones.length - 1].points;

  milestones.forEach(m => {
    const t = m.points / lastPts;
    const { x, y } = svgPointAt(t);
    const el = document.createElement("div");
    el.className = `milestone ${m.status}`;
    el.style.left = x + "px";
    el.style.top  = y + "px";
    el.dataset.mid = m.id;

    const img = document.createElement("img");
    img.src = m.type === "ticket"
      ? "/frontend/assets/ticket.png"
      : `/frontend/assets/border-${m.payload.borderKey}.png`;
    el.appendChild(img);

    layer.appendChild(el);
  });
}

function moveRocket(progress01) {
  const rocket = document.getElementById("rocket");
  const { x, y, angle } = svgPointAt(progress01);
  rocket.style.left = x + "px";
  rocket.style.top  = y + "px";
  rocket.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
}

loadTrophy();