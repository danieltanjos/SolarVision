// Mapa de calor do datalake de uso: o algoritmo do site do projeto-modelo do professor (site/index.html),
// portado para o app. A Gold é por elemento (gold/mapa_calor_cliques): cada elemento data-heat vira alguns
// pontos de calor espalhados pela área dele; cada ponto soma uma mancha difusa num canvas (só alfa) e,
// no fim, o alfa acumulado vira cor da paleta azul → ciano → verde → amarelo → vermelho, por cima de um
// véu azul-escuro. Aqui ficam as contas (testáveis sem navegador); o desenho fica em MapaCalor.jsx.

// escala clássica de mapa de calor, as mesmas paradas do site do professor
export const PARADAS_CALOR = [[0, "#0000ff"], [0.3, "#00c8ff"], [0.5, "#00ff40"], [0.72, "#ffff00"], [1, "#ff0000"]];
export const ESCALA_CALOR = 0.25;          // desenha a 1/4 e estica: mais leve, e o calor já fica difuso
export const VEU = [18, 24, 110];          // azul escuro por cima da tela toda
export const LARGURA_FAIXA = 72;           // faixa de rolagem na lateral direita do conteúdo

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// As 256 cores da paleta em RGBA (o mesmo que o createLinearGradient + getImageData do site, sem canvas).
export const PALETA_CALOR = (() => {
  const dados = new Uint8ClampedArray(256 * 4);
  const paradas = PARADAS_CALOR.map(([pos, cor]) => [pos, rgb(cor)]);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    const j = Math.max(0, paradas.findIndex(([pos]) => pos >= t) - 1);
    const [p0, c0] = paradas[j];
    const [p1, c1] = paradas[Math.min(j + 1, paradas.length - 1)];
    const f = p1 === p0 ? 0 : (t - p0) / (p1 - p0);
    for (let k = 0; k < 3; k += 1) dados[i * 4 + k] = Math.round(c0[k] + (c1[k] - c0[k]) * f);
    dados[i * 4 + 3] = 255;
  }
  return dados;
})();

// Um elemento (caixa da tela) vira de 1 a 24 pontos, com raio proporcional ao tamanho dele. O peso
// vem da intensidade da Gold (0 a 1), com um mínimo para o elemento pouco clicado ainda aparecer.
export function pontosDoElemento(caixa, intensidade) {
  const colunas = Math.max(1, Math.min(6, Math.round(caixa.width / 60)));
  const linhas = Math.max(1, Math.min(4, Math.round(caixa.height / 50)));
  const raio = Math.max(60, Math.min(190, Math.min(caixa.width, caixa.height) * 0.9 + 50));
  const peso = (Math.max(0.12, Number(intensidade) || 0) * 0.85) / Math.sqrt(colunas * linhas);
  const pontos = [];
  for (let i = 0; i < colunas; i += 1) {
    for (let j = 0; j < linhas; j += 1) {
      pontos.push({
        x: caixa.left + (caixa.width * (i + 0.5)) / colunas,
        y: caixa.top + (caixa.height * (j + 0.5)) / linhas,
        raio,
        peso
      });
    }
  }
  return pontos;
}

// Quanto multiplicar o alfa acumulado: o ponto mais quente vira a cor da maior intensidade da Gold
// entre os elementos desenhados (o vermelho só aparece onde a Gold diz 1).
export function ganho(maximoAlfa, teto) {
  return maximoAlfa ? (255 * Math.max(0.12, Math.min(1, teto))) / maximoAlfa : 1;
}

// A cor de um pixel a partir do alfa acumulado (0 a 255), com o véu: perto de zero fica o azul-escuro,
// e a paleta entra aos poucos (t vai de 0 a 1 nos primeiros 40 de alfa).
export function corDoPixel(alfa) {
  const a = Math.min(255, Math.max(0, Math.round(alfa)));
  const o = a * 4;
  const t = Math.min(1, a / 40);
  return [
    Math.round(VEU[0] + (PALETA_CALOR[o] - VEU[0]) * t),
    Math.round(VEU[1] + (PALETA_CALOR[o + 1] - VEU[1]) * t),
    Math.round(VEU[2] + (PALETA_CALOR[o + 2] - VEU[2]) * t),
    Math.min(235, 150 + a)
  ];
}

// Onde fica o marco m% da rolagem, em coordenadas do documento: quem rolou m% do percurso viu até
// m/100 × (altura − janela) + janela.
export function marcoY(marco, altura, janela) {
  return Math.min(altura, (marco / 100) * Math.max(0, altura - janela) + janela);
}

// O fundo da faixa de rolagem: mais escuro onde menos sessões chegaram.
export function gradienteDaFaixa(rolagem, altura, janela) {
  const paradas = rolagem.map((linha) => {
    const opacidade = (0.75 * (1 - (linha.pct_sessoes || 0))).toFixed(3);
    const posicao = ((marcoY(linha.marco, altura, janela) / altura) * 100).toFixed(2);
    return `rgba(5,8,40,${opacidade}) ${posicao}%`;
  });
  return `linear-gradient(to bottom, ${paradas.join(", ")})`;
}

// Pinta os pontos num canvas do tamanho da tela (já com ESCALA_CALOR aplicada pelo chamador).
// 1º passo: cada ponto soma uma mancha difusa (só alfa). 2º passo: o alfa acumulado vira cor.
// Sem ponto nenhum o canvas fica limpo: tela sem clique na Gold não ganha véu.
export function pintarCalor(canvas, largura, altura, pontos, teto) {
  const w = Math.max(1, Math.ceil(largura * ESCALA_CALOR));
  const h = Math.max(1, Math.ceil(altura * ESCALA_CALOR));
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, w, h);
  if (!pontos.length) return;
  for (const p of pontos) {
    const x = p.x * ESCALA_CALOR;
    const y = p.y * ESCALA_CALOR;
    const raio = p.raio * ESCALA_CALOR;
    const grad = g.createRadialGradient(x, y, 0, x, y, raio);
    grad.addColorStop(0, `rgba(0,0,0,${Math.min(1, p.peso)})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(x - raio, y - raio, raio * 2, raio * 2);
  }
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  let maximo = 0;
  for (let m = 3; m < d.length; m += 4) if (d[m] > maximo) maximo = d[m];
  const fator = ganho(maximo, teto);
  for (let k = 0; k < d.length; k += 4) {
    const [r, gg, b, a] = corDoPixel(d[k + 3] * fator);
    d[k] = r;
    d[k + 1] = gg;
    d[k + 2] = b;
    d[k + 3] = a;
  }
  g.putImageData(img, 0, 0);
}
