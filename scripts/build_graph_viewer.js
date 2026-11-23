const fs = require('fs');
const path = require('path');

const dataRaw = fs.readFileSync(path.resolve(__dirname, '../graphify-out/viewer_data.json'), 'utf8')
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Grafo de Arquitectura - TikTok Sticker Bot</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: #0b0f19; color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    canvas { display: block; width: 100%; height: 100%; cursor: grab; }
    canvas:active { cursor: grabbing; }
    .glass-panel { background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(51, 65, 85, 0.6); }
    .badge-pill { transition: all 0.2s ease; cursor: pointer; }
    .badge-pill:hover { transform: translateY(-1px); filter: brightness(1.2); }
    .badge-pill.active { ring: 2px solid #38bdf8; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.6); }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  </style>
</head>
<body class="h-screen flex flex-col">
  <!-- Header Bar -->
  <header class="h-14 glass-panel border-b border-slate-800 px-5 flex items-center justify-between shrink-0 z-20">
    <div class="flex items-center gap-3">
      <div class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
      <h1 class="text-sm font-semibold tracking-wide text-slate-100 flex items-center gap-2">
        TikTok Sticker Bot
        <span class="text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Arquitectura Modular (Ponytail)</span>
      </h1>
    </div>

    <!-- Quick Stats -->
    <div class="hidden md:flex items-center gap-6 text-xs text-slate-400">
      <div class="flex items-center gap-1.5"><span class="text-slate-200 font-semibold" id="stat-nodes">206</span> nodos</div>
      <div class="flex items-center gap-1.5"><span class="text-slate-200 font-semibold" id="stat-edges">285</span> relaciones</div>
      <div class="flex items-center gap-1.5"><span class="text-emerald-400 font-semibold">0</span> ciclos</div>
      <div class="flex items-center gap-1.5"><span class="text-indigo-400 font-semibold">10</span> módulos</div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <input id="search-input" type="text" placeholder="Buscar nodo o símbolo..." class="bg-slate-900/90 border border-slate-700 text-xs text-slate-200 px-3 py-1.5 rounded-lg w-48 focus:w-64 transition-all focus:outline-none focus:border-indigo-500">
      <button id="btn-reset" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">Centrar</button>
      <button id="btn-toggle-core" class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors shadow-sm">Solo Core (src/)</button>
    </div>
  </header>

  <!-- Community Filters Bar -->
  <div class="h-11 bg-slate-950/80 border-b border-slate-800/80 px-4 flex items-center gap-2 overflow-x-auto shrink-0 z-10 text-xs" id="filters-bar">
    <span class="text-slate-500 font-medium mr-1 uppercase text-[10px] tracking-wider">Módulos:</span>
  </div>

  <!-- Workspace: Canvas & Inspector -->
  <div class="flex-1 relative overflow-hidden">
    <canvas id="graph-canvas"></canvas>

    <!-- Side Inspector Panel -->
    <aside id="inspector" class="absolute top-4 right-4 w-80 glass-panel rounded-xl p-4 shadow-2xl z-20 flex flex-col gap-3 max-h-[calc(100%-2rem)] overflow-y-auto transition-transform duration-300 translate-x-[340px]">
      <div class="flex items-start justify-between border-b border-slate-800 pb-2.5">
        <div>
          <span id="node-badge" class="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">Módulo</span>
          <h2 id="node-title" class="text-sm font-bold text-slate-100 mt-1 break-words">Nombre del Nodo</h2>
        </div>
        <button id="close-inspector" class="text-slate-400 hover:text-slate-200 text-lg leading-none p-1">&times;</button>
      </div>

      <div class="text-xs space-y-2">
        <div>
          <span class="text-slate-500 block">Archivo de origen:</span>
          <code id="node-file" class="text-indigo-300 bg-slate-900/80 px-1.5 py-0.5 rounded text-[11px] block mt-0.5 truncate">-</code>
        </div>
        <div>
          <span class="text-slate-500 block">Conectividad (Grado):</span>
          <span id="node-degree" class="text-slate-200 font-semibold">0</span> conexiones directas
        </div>
        <div>
          <span class="text-slate-500 block mb-1">Conexiones directas:</span>
          <div id="node-neighbors" class="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1 text-[11px]">
          </div>
        </div>
      </div>
    </aside>

    <!-- Floating Mini Legend & Navigation Hint -->
    <div class="absolute bottom-4 left-4 glass-panel rounded-lg px-3 py-2 text-[11px] text-slate-400 flex items-center gap-3 z-10">
      <span>🖱️ <b>Arrastrar:</b> Mover</span>
      <span>🔍 <b>Rueda:</b> Zoom</span>
      <span>👆 <b>Click:</b> Inspeccionar</span>
    </div>
  </div>

  <script>
    const GRAPH_DATA = ${dataRaw};

    // Canvas setup
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight - 95;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight - 95;
    });

    // Camera transform
    let camera = { x: width / 2, y: height / 2, zoom: 0.85 };
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let hoveredNode = null;
    let selectedNode = null;
    let activeFilter = 'all';
    let onlyCore = false;

    // Build nodes and adjacency
    const nodeMap = new Map();
    const adjMap = new Map();

    const rawNodes = GRAPH_DATA.nodes;
    const rawLinks = GRAPH_DATA.links;

    rawNodes.forEach((n, idx) => {
      const angle = (idx / rawNodes.length) * Math.PI * 2;
      const radius = 250 + Math.random() * 200;
      nodeMap.set(n.id, {
        ...n,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        radius: Math.max(5, Math.min(18, (n.degree || 1) * 2.2))
      });
      adjMap.set(n.id, []);
    });

    const links = rawLinks.map(l => {
      const s = nodeMap.get(l.source);
      const t = nodeMap.get(l.target);
      if (s && t) {
        adjMap.get(s.id).push({ target: t, kind: l.kind });
        adjMap.get(t.id).push({ target: s, kind: l.kind });
      }
      return { source: s, target: t, kind: l.kind };
    }).filter(l => l.source && l.target);

    // Initialize community filter buttons
    const filtersBar = document.getElementById('filters-bar');
    const allBtn = document.createElement('button');
    allBtn.className = 'badge-pill active px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 border border-slate-700';
    allBtn.textContent = 'Todos (' + rawNodes.length + ')';
    allBtn.onclick = () => setFilter('all');
    filtersBar.appendChild(allBtn);

    Object.entries(GRAPH_DATA.communityMeta).forEach(([commKey, meta]) => {
      const count = rawNodes.filter(n => n.community === commKey).length;
      if (count === 0) return;
      const btn = document.createElement('button');
      btn.className = 'badge-pill px-2.5 py-1 rounded-md border flex items-center gap-1.5';
      btn.style.borderColor = meta.color + '55';
      btn.style.color = '#e2e8f0';
      btn.style.background = meta.color + '15';
      const dot = document.createElement('span');
      dot.className = 'w-2 h-2 rounded-full';
      dot.style.background = meta.color;
      btn.appendChild(dot);
      btn.appendChild(document.createTextNode(meta.label + ' (' + count + ')'));
      btn.onclick = () => setFilter(commKey);
      btn.dataset.comm = commKey;
      filtersBar.appendChild(btn);
    });

    function setFilter(comm) {
      activeFilter = comm;
      document.querySelectorAll('#filters-bar .badge-pill').forEach(b => {
        if (b.dataset.comm === comm || (comm === 'all' && !b.dataset.comm)) {
          b.classList.add('active', 'ring-2', 'ring-indigo-400');
        } else {
          b.classList.remove('active', 'ring-2', 'ring-indigo-400');
        }
      });
    }

    // Toggle Core button
    const btnToggleCore = document.getElementById('btn-toggle-core');
    btnToggleCore.onclick = () => {
      onlyCore = !onlyCore;
      btnToggleCore.textContent = onlyCore ? 'Ver Todos (inc. Tests)' : 'Solo Core (src/)';
      btnToggleCore.classList.toggle('bg-emerald-600', onlyCore);
      btnToggleCore.classList.toggle('bg-indigo-600', !onlyCore);
    };

    // Reset Zoom / Center
    document.getElementById('btn-reset').onclick = () => {
      camera = { x: width / 2, y: height / 2, zoom: 0.85 };
    };

    // Force simulation step
    function updatePhysics() {
      const nodes = Array.from(nodeMap.values());
      const visibleNodes = nodes.filter(isNodeVisible);

      // Repulsion
      for (let i = 0; i < visibleNodes.length; i++) {
        const a = visibleNodes[i];
        for (let j = i + 1; j < visibleNodes.length; j++) {
          const b = visibleNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy || 1;
          if (distSq < 40000) {
            const force = 400 / distSq;
            const fx = (dx / Math.sqrt(distSq)) * force;
            const fy = (dy / Math.sqrt(distSq)) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      // Spring attraction on links
      links.forEach(l => {
        if (!isNodeVisible(l.source) || !isNodeVisible(l.target)) return;
        const dx = l.target.x - l.source.x;
        const dy = l.target.y - l.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = 90;
        const force = (dist - targetDist) * 0.035;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        l.source.vx += fx;
        l.source.vy += fy;
        l.target.vx -= fx;
        l.target.vy -= fy;
      });

      // Gravity towards center & velocity damping
      visibleNodes.forEach(n => {
        n.vx -= n.x * 0.005;
        n.vy -= n.y * 0.005;
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;
      });
    }

    function isNodeVisible(n) {
      if (!n) return false;
      if (onlyCore) {
        if (n.file.startsWith('tests/') || n.file.includes('test') || n.file.includes('legacy')) return false;
      }
      if (activeFilter === 'all') return true;
      return n.community === activeFilter;
    }

    // Render loop
    function render() {
      updatePhysics();

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      // Draw links
      links.forEach(l => {
        if (!isNodeVisible(l.source) || !isNodeVisible(l.target)) return;
        const isHighlighted = selectedNode && (l.source.id === selectedNode.id || l.target.id === selectedNode.id);
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.strokeStyle = isHighlighted ? '#38bdf8' : 'rgba(71, 85, 105, 0.35)';
        ctx.lineWidth = isHighlighted ? 2.5 : 0.8;
        ctx.stroke();
      });

      // Draw nodes
      Array.from(nodeMap.values()).forEach(n => {
        if (!isNodeVisible(n)) return;
        const isSelected = selectedNode && selectedNode.id === n.id;
        const isHovered = hoveredNode && hoveredNode.id === n.id;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + (isHovered || isSelected ? 4 : 0), 0, Math.PI * 2);
        ctx.fillStyle = n.color || '#6366f1';
        ctx.fill();

        if (isSelected || isHovered) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Draw node labels for significant nodes or when zoomed in
        if (camera.zoom > 0.75 || n.degree >= 5 || isSelected || isHovered) {
          ctx.fillStyle = '#f8fafc';
          ctx.font = Math.max(10, Math.min(14, 11 / camera.zoom)) + "px -apple-system, sans-serif";
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y + n.radius + 13);
        }
      });

      ctx.restore();
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    // Mouse & Touch Interaction
    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        camera.x += e.clientX - dragStart.x;
        camera.y += e.clientY - dragStart.y;
        dragStart = { x: e.clientX, y: e.clientY };
      } else {
        // Hit test for hover
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - camera.x) / camera.zoom;
        const mouseY = (e.clientY - rect.top - camera.y) / camera.zoom;

        hoveredNode = null;
        for (const n of nodeMap.values()) {
          if (!isNodeVisible(n)) continue;
          const dx = n.x - mouseX;
          const dy = n.y - mouseY;
          if (dx * dx + dy * dy <= n.radius * n.radius + 25) {
            hoveredNode = n;
            break;
          }
        }
      }
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      camera.zoom = Math.max(0.2, Math.min(3.5, camera.zoom * zoomFactor));
    }, { passive: false });

    // Click to select & inspect
    canvas.addEventListener('click', (e) => {
      if (hoveredNode) {
        selectNode(hoveredNode);
      }
    });

    function selectNode(node) {
      selectedNode = node;
      const inspector = document.getElementById('inspector');
      inspector.classList.remove('translate-x-[340px]');

      document.getElementById('node-badge').textContent = node.communityLabel || node.community;
      document.getElementById('node-badge').style.color = node.color;
      document.getElementById('node-title').textContent = node.label;
      document.getElementById('node-file').textContent = node.file || 'Raíz / package';
      document.getElementById('node-degree').textContent = node.degree;

      const neighborsEl = document.getElementById('node-neighbors');
      neighborsEl.textContent = '';
      const direct = adjMap.get(node.id) || [];
      if (direct.length === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.className = 'text-slate-500 italic';
        emptyMsg.textContent = 'Sin conexiones directas';
        neighborsEl.appendChild(emptyMsg);
      } else {
        direct.forEach(({ target, kind }) => {
          const item = document.createElement('div');
          item.className = 'p-1.5 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors';
          const labelSpan = document.createElement('span');
          labelSpan.className = 'font-medium text-slate-200';
          labelSpan.textContent = target.label;
          const kindSpan = document.createElement('span');
          kindSpan.className = 'text-[10px] text-slate-500';
          kindSpan.textContent = kind;
          item.append(labelSpan, kindSpan);
          item.onclick = () => {
            selectNode(target);
            camera.x = width / 2 - target.x * camera.zoom;
            camera.y = height / 2 - target.y * camera.zoom;
          };
          neighborsEl.appendChild(item);
        });
      }
    }

    document.getElementById('close-inspector').onclick = () => {
      document.getElementById('inspector').classList.add('translate-x-[340px]');
      selectedNode = null;
    };

    // Search bar functionality
    document.getElementById('search-input').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) return;
      for (const n of nodeMap.values()) {
        if (n.label.toLowerCase().includes(q) || (n.file && n.file.toLowerCase().includes(q))) {
          selectNode(n);
          camera.x = width / 2 - n.x * camera.zoom;
          camera.y = height / 2 - n.y * camera.zoom;
          break;
        }
      }
    });
  </script>
</body>
</html>`;

const outPath = path.resolve(__dirname, '../graphify-out/architecture_graph.html');
fs.writeFileSync(outPath, htmlContent);
console.log('Successfully written to', outPath);
