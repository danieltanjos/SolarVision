// Maquete 3D da simulação da landing page. Fica num módulo próprio para a three só entrar no chunk carregado sob demanda.
import * as THREE from "three";
import { INCLINACAO } from "../lib/simulacao";

// Textura da placa: células azuis; a sujeira (0 a 1) clareia o fundo e espalha poeira.
function pintaPlaca(tela, sujeira) {
  const c = tela.getContext("2d");
  const mix = (a, b) => Math.round(a + (b - a) * sujeira * 0.75);
  c.fillStyle = `rgb(${mix(23, 168)},${mix(54, 150)},${mix(92, 118)})`;
  c.fillRect(0, 0, 144, 240);
  c.strokeStyle = "rgba(255,255,255,.4)";
  c.lineWidth = 1.5;
  for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(i * 24, 0); c.lineTo(i * 24, 240); c.stroke(); }
  for (let j = 0; j <= 10; j++) { c.beginPath(); c.moveTo(0, j * 24); c.lineTo(144, j * 24); c.stroke(); }
  let seed = 7; // pseudoaleatório fixo: a poeira não pula de lugar a cada redesenho
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.fillStyle = "rgba(196,176,138,.55)";
  for (let i = 0; i < sujeira * 700; i++) c.fillRect(rnd() * 144, rnd() * 240, 2.5, 2.5);
}

// Maquete: casa com quatro placas no telhado, jardim e sol. Devolve como atualizar (hora/sujeira) e como desmontar.
export function montaCena(palco, canvas) {
  const parado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd9dccb, 1.7);
  const luz = new THREE.DirectionalLight(0xfff1d6, 2.4);
  luz.castShadow = true;
  luz.shadow.mapSize.set(2048, 2048);
  luz.shadow.bias = -0.0006;
  luz.shadow.normalBias = 0.02;
  Object.assign(luz.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 32 });
  scene.add(hemi, luz);

  const textura = (largura, altura, pinta) => {
    const cv = document.createElement("canvas");
    cv.width = largura;
    cv.height = altura;
    pinta(cv.getContext("2d"));
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const add = (geo, m, x, y, z, pai = scene) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    pai.add(o);
    return o;
  };
  const caixa = (w, h, d, m, x, y, z, pai) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, pai);
  const bola = (r, m, x, y, z) => add(new THREE.IcosahedronGeometry(r, 1), m, x, y, z);
  const parede = mat(0xf8eedc);
  const branco = mat(0xffffff);
  const pedra = mat(0xd3ccbe);
  const vidro = mat(0xa6d2ee, { roughness: 0.25 });
  const folha = mat(0x5a9a5f, { flatShading: true });
  const folha2 = mat(0x7db56a, { flatShading: true });

  add(new THREE.CylinderGeometry(5.5, 5.5, 0.5, 72), mat(0xb4d294), 0, -0.25, 0); // terreno
  caixa(0.9, 0.04, 3.3, mat(0xe8dcc0), -1.3, 0.02, 3.65); // caminho até a porta
  caixa(5.3, 0.16, 3.7, pedra, 0, 0.08, 0); // base
  caixa(5, 2.2, 3.4, parede, 0, 1.1, 0); // paredes
  // Empena: prisma triangular (cilindro de 3 lados deitado) achatado até 22°.
  const empena = new THREE.CylinderGeometry(1.963, 1.963, 5, 3, 1, false, Math.PI / 2).rotateZ(Math.PI / 2);
  add(empena, mat(0xf8eedc, { flatShading: true }), 0, 2.2 + 0.229, 0).scale.y = 0.2333;
  // Telhado: duas águas com beiral, telha em fiadas.
  const telhas = textura(64, 64, (c) => {
    c.fillStyle = "#c96a42"; c.fillRect(0, 0, 64, 64);
    c.fillStyle = "#a9512f"; c.fillRect(0, 56, 64, 8);
    c.fillStyle = "#d98058"; c.fillRect(0, 0, 64, 6);
    c.fillStyle = "#b25a36"; c.fillRect(30, 0, 3, 64);
  });
  telhas.wrapS = telhas.wrapT = THREE.RepeatWrapping;
  telhas.repeat.set(14, 6);
  const telha = new THREE.MeshStandardMaterial({ map: telhas, roughness: 0.85 });
  for (const lado of [1, -1]) caixa(5.8, 0.12, 2.25, telha, 0, 2.53, lado * 1.047).rotation.x = lado * INCLINACAO;
  caixa(5.8, 0.12, 0.3, mat(0xa9512f), 0, 2.98, 0); // cumeeira
  caixa(0.55, 1.1, 0.55, mat(0xb86a4c), 1.7, 2.9, -0.9); // chaminé
  caixa(0.72, 0.1, 0.72, pedra, 1.7, 3.48, -0.9);
  // Porta com moldura, maçaneta e degrau.
  caixa(1, 1.7, 0.06, branco, -1.3, 1.01, 1.71);
  caixa(0.8, 1.55, 0.08, mat(0x3b7197), -1.3, 0.935, 1.73);
  add(new THREE.SphereGeometry(0.05, 10, 8), mat(0xe8a317), -1.02, 0.92, 1.79);
  caixa(1.3, 0.12, 0.5, pedra, -1.3, 0.06, 2);
  // Janelas com moldura, travessas e peitoril (frente, fundos e laterais).
  for (const [x, z, ry] of [[1.1, 1.71, 0], [-1.2, -1.71, Math.PI], [1.2, -1.71, Math.PI], [2.51, 0, Math.PI / 2], [-2.51, 0, -Math.PI / 2]]) {
    const j = new THREE.Group();
    j.position.set(x, 1.3, z);
    j.rotation.y = ry;
    scene.add(j);
    caixa(1.25, 1, 0.06, branco, 0, 0, 0, j);
    caixa(1.05, 0.8, 0.08, vidro, 0, 0, 0, j);
    caixa(0.06, 0.8, 0.1, branco, 0, 0, 0, j);
    caixa(1.05, 0.06, 0.1, branco, 0, 0, 0, j);
    caixa(1.35, 0.07, 0.2, branco, 0, -0.53, 0.06, j);
  }
  // Jardim: árvores, arbustos e nuvens.
  for (const [x, z, e] of [[-3.9, -2, 1], [3.9, -2.6, 0.8]]) {
    add(new THREE.CylinderGeometry(0.13 * e, 0.17 * e, 1.1 * e, 10), mat(0x8a6a4a), x, 0.55 * e, z);
    bola(e, folha, x, 1.9 * e, z);
    bola(0.65 * e, folha2, x + 0.55 * e, 1.5 * e, z + 0.3 * e);
  }
  for (const [x, z, r] of [[2.1, 2.05, 0.42], [2.75, 2, 0.3], [-2.9, 2, 0.38], [-3.4, 2.2, 0.26]]) bola(r, folha2, x, r * 0.7, z);
  const nuvem = mat(0xffffff, { flatShading: true });
  for (const [x, y, z] of [[-4.6, 6, -3], [5.6, 4.6, -3]]) {
    for (const [dx, r] of [[0, 0.7], [0.8, 0.5], [-0.75, 0.45]]) bola(r, nuvem, x + dx, y, z).castShadow = false;
  }

  const tela = document.createElement("canvas");
  tela.width = 144;
  tela.height = 240;
  pintaPlaca(tela, 0);
  const tex = new THREE.CanvasTexture(tela);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const placas = new THREE.Group();
  placas.position.set(0, 2.63, 1.09);
  placas.rotation.x = INCLINACAO;
  scene.add(placas);
  const celula = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.15 });
  const aluminio = mat(0xdfe5ea, { roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const px = (i - 1.5) * 1.15;
    caixa(1.1, 0.05, 1.75, aluminio, px, -0.015, 0, placas);
    caixa(1.04, 0.06, 1.69, celula, px, 0, 0, placas);
  }

  const sol = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf5b82e }));
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({
    depthWrite: false,
    map: textura(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 8, 64, 64, 64);
      g.addColorStop(0, "rgba(255,226,140,.95)");
      g.addColorStop(1, "rgba(255,226,140,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    })
  }));
  brilho.scale.set(4.2, 4.2, 1);
  sol.add(brilho);
  scene.add(sol);

  // Girar: arrastar na horizontal muda o azimute da câmera; na vertical a página rola (touch-action: pan-y no CSS).
  let az = 0.65;
  let arrasta = null;
  let visivel = true;
  let quadroId = 0;
  const ouvintes = new AbortController();
  const ouvir = (tipo, fn) => canvas.addEventListener(tipo, fn, { signal: ouvintes.signal });
  ouvir("pointerdown", (e) => { arrasta = { x: e.clientX, az }; canvas.setPointerCapture(e.pointerId); });
  ouvir("pointermove", (e) => { if (arrasta) az = arrasta.az - (e.clientX - arrasta.x) * 0.008; });
  ouvir("pointerup", () => { arrasta = null; });
  ouvir("pointercancel", () => { arrasta = null; });
  const tamanho = new ResizeObserver(() => {
    const w = palco.clientWidth;
    const h = palco.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  });
  tamanho.observe(palco);
  const naTela = new IntersectionObserver((entradas) => { visivel = entradas[0].isIntersecting; });
  naTela.observe(palco);
  (function quadro() {
    quadroId = requestAnimationFrame(quadro);
    if (!visivel) return;
    if (!arrasta && !parado) az += 0.0014;
    const raio = cam.aspect < 1.4 ? 17.5 : 14.5;
    cam.position.set(Math.sin(az) * raio, 5, Math.cos(az) * raio);
    cam.lookAt(0, 2.1, 0);
    renderer.render(scene, cam);
  })();

  return {
    atualiza({ sol: s, dia, perda, altura }) {
      sol.position.set(s[0] * 7, s[1] * 7, s[2] * 7);
      sol.visible = dia;
      luz.position.set(s[0] * 14, s[1] * 14, s[2] * 14);
      // Intensidades em unidades físicas (three sem luzes legadas): os valores do desenho vezes π.
      luz.intensity = dia ? 2.45 * altura ** 0.4 : 0;
      hemi.intensity = dia ? 1.57 + 0.25 * altura : 1.32;
      pintaPlaca(tela, perda / 0.2);
      tex.needsUpdate = true;
    },
    desmonta() {
      cancelAnimationFrame(quadroId);
      ouvintes.abort();
      tamanho.disconnect();
      naTela.disconnect();
      renderer.dispose();
    }
  };
}
