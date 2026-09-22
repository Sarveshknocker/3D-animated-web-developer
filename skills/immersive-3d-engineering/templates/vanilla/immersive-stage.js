// Framework-free immersive stage (static sites, WordPress, Django/Laravel templates, Angular).
// Same guarantees as the React ImmersiveStage: poster-first, lazy three.js, tiers,
// reduced motion, offscreen pause, context loss, cleanup.
//
// HTML:
//   <div class="stage" data-immersive aria-hidden="true">
//     <img class="stage__poster" src="/hero-poster.avif" alt="" fetchpriority="high">
//   </div>
//   <button type="button" data-motion-toggle aria-pressed="false">Pause motion</button>
//   <script type="module" src="/js/immersive-stage.js"></script>

const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
const isPaused = () => reducedMQ.matches || localStorage.getItem('motion-paused') === '1';

function detectTier() {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
  if (!gl) return 'static';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  if (navigator.connection?.saveData) return 'static';
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = navigator.deviceMemory ?? 4;
  if (cores <= 4 || mem <= 2) return 'low';
  if (matchMedia('(pointer: coarse)').matches || cores < 8) return 'mid';
  return 'high';
}
const DPR = { high: 2, mid: 1.5, low: 1 };

async function mount(host) {
  const tier = detectTier();
  if (tier === 'static' || reducedMQ.matches) return; // poster stays

  const THREE = await import('three'); // lazy: not in the critical path
  const renderer = new THREE.WebGLRenderer({ antialias: tier !== 'low', alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, DPR[tier]));
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', opacity: '0', transition: 'opacity .6s ease' });
  host.style.position ||= 'relative';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 5);

  // --- Replace with the project's signature scene ---
  const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand-500').trim() || '#3b5bfd';
  const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.32, tier === 'high' ? 256 : 96, 24), new THREE.MeshStandardMaterial({ color: brand, roughness: 0.3, metalness: 0.4 }));
  scene.add(mesh, new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 4, 5); scene.add(key);
  // ---------------------------------------------------

  const pointer = new THREE.Vector2();
  const onPointer = (e) => pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  addEventListener('pointermove', onPointer, { passive: true });

  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  const clock = new THREE.Clock();
  let inView = true;
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!isPaused()) {
      mesh.rotation.y += dt * 0.3;
      mesh.rotation.x += (pointer.y * 0.3 - mesh.rotation.x) * Math.min(dt * 3, 1);
    }
    renderer.render(scene, camera);
  };
  const updateLoop = () => renderer.setAnimationLoop(inView && !document.hidden ? tick : null);
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; updateLoop(); }, { rootMargin: '200px' });
  io.observe(host);
  document.addEventListener('visibilitychange', updateLoop);

  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); destroy(); });
  requestAnimationFrame(() => { renderer.domElement.style.opacity = '1'; });
  updateLoop();

  function destroy() {
    renderer.setAnimationLoop(null);
    io.disconnect(); ro.disconnect();
    removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', updateLoop);
    scene.traverse((o) => { o.geometry?.dispose(); [].concat(o.material ?? []).forEach((m) => m.dispose()); });
    renderer.dispose();
    renderer.domElement.remove(); // poster underneath becomes visible again
  }
  return destroy;
}

// Pause toggle (WCAG 2.2.2)
document.querySelectorAll('[data-motion-toggle]').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(isPaused()));
  btn.addEventListener('click', () => {
    const next = !(localStorage.getItem('motion-paused') === '1');
    localStorage.setItem('motion-paused', next ? '1' : '0');
    btn.setAttribute('aria-pressed', String(next));
  });
});

const start = () => document.querySelectorAll('[data-immersive]').forEach(mount);
('requestIdleCallback' in window ? requestIdleCallback : setTimeout)(start);
