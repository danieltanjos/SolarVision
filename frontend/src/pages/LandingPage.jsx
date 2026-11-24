import { useState } from "react";
import { Link } from "react-router-dom";
import SimulacaoSolar from "../components/SimulacaoSolar";
import "../styles/landing.css";
import logo from "../../img/logo.png";
import fotoCasa from "../../img/landing/casa.jpg";
import fotoLimpeza from "../../img/landing/limpeza-rodo.jpg";
import fotoTelhado from "../../img/landing/telhado.jpg";

// Dia de exemplo do painel, hora a hora (5h às 19h): sol firme com uma nuvem leve no começo da tarde.
// A estimada soma 20,0 kWh e a real 18,4 kWh (92%), os mesmos números dos cartões acima do gráfico.
const ESTIMADA = [0, 0.05, 0.5, 1.1, 1.75, 2.35, 2.6, 2.8, 2.75, 2.2, 2, 1.2, 0.6, 0.1, 0];
const REAL = [0, 0.04, 0.46, 1.02, 1.62, 2.17, 2.38, 2.59, 2.54, 2.03, 1.81, 1.1, 0.55, 0.09, 0];
const G = { w: 440, h: 210, esq: 34, dir: 8, topo: 10, base: 26, max: 3 };
const gx = (hora) => G.esq + ((hora - 5) / 14) * (G.w - G.esq - G.dir);
const gy = (kw) => G.topo + (1 - kw / G.max) * (G.h - G.topo - G.base);

// Curva suave pelos pontos de cada hora (Catmull-Rom convertida em Bézier), sem passar abaixo do zero.
function curva(valores) {
  const p = valores.map((kw, i) => [gx(i + 5), gy(kw)]);
  const em = (i) => p[Math.min(p.length - 1, Math.max(0, i))];
  const n = (v) => v.toFixed(1);
  const chao = gy(0);
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b, c, e] = [em(i - 1), em(i), em(i + 1), em(i + 2)];
    d += `C${n(b[0] + (c[0] - a[0]) / 6)} ${n(Math.min(chao, b[1] + (c[1] - a[1]) / 6))} ${n(c[0] - (e[0] - b[0]) / 6)} ${n(Math.min(chao, c[1] - (e[1] - b[1]) / 6))} ${n(c[0])} ${n(c[1])}`;
  }
  return d;
}
const CURVA_ESTIMADA = curva(ESTIMADA);
const CURVA_REAL = curva(REAL);
const kw = (valor) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function GraficoExemplo() {
  const [hora, setHora] = useState(12);
  const estimada = ESTIMADA[hora - 5];
  const real = REAL[hora - 5];

  function apontar(event) {
    const h = 5 + ((event.nativeEvent.offsetX / event.currentTarget.clientWidth) * G.w - G.esq) / (G.w - G.esq - G.dir) * 14;
    setHora(Math.min(18, Math.max(6, Math.round(h))));
  }

  return (
    <>
      <div className="plot">
        <svg
          className="chart"
          viewBox={`0 0 ${G.w} ${G.h}`}
          role="img"
          aria-label="Potência estimada e real ao longo de ontem, hora a hora das 6h às 18h, com pico perto de 3 kW ao meio-dia e uma queda leve à tarde"
        >
          {[0, 1, 2, 3].map((p) => (
            <g key={p}>
              <line className="grid" x1={G.esq} x2={G.w - G.dir} y1={gy(p)} y2={gy(p)} />
              <text x={G.esq - 6} y={gy(p) + 4} textAnchor="end">{p}</text>
            </g>
          ))}
          {[6, 9, 12, 15, 18].map((h) => <text key={h} x={gx(h)} y={G.h - 6} textAnchor="middle">{h}h</text>)}
          <text x={G.esq + 4} y={G.topo + 10}>kW</text>
          <path className="area" d={`${CURVA_REAL}L${gx(19)} ${gy(0)}L${gx(5)} ${gy(0)}Z`} />
          <path className="est" fill="none" d={CURVA_ESTIMADA} />
          <path className="real" fill="none" d={CURVA_REAL} />
          <line className="mira" x1={gx(hora)} x2={gx(hora)} y1={G.topo} y2={gy(0)} />
          <circle className="p-est" r="4" cx={gx(hora)} cy={gy(estimada)} />
          <circle className="p-real" r="5" cx={gx(hora)} cy={gy(real)} />
        </svg>
        <div className="hit" onPointerMove={apontar} />
      </div>
      <div className="under">
        <div className="legend"><span><i />Real</span><span><i className="dash" />Estimada pelo clima</span></div>
        <output className="leitura">{hora}h00 · estimada {kw(estimada)} kW · real {kw(real)} kW</output>
      </div>
    </>
  );
}

// Inclinação 3D: o filho lê --rx/--ry, que seguem o ponteiro (só com mouse e sem "reduzir movimento").
function Inclina({ graus, className, children }) {
  function mover(event) {
    if (!window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    const el = event.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--ry", `${((event.clientX - r.left) / r.width - 0.5) * graus}deg`);
    el.style.setProperty("--rx", `${(0.5 - (event.clientY - r.top) / r.height) * graus}deg`);
  }
  function soltar(event) {
    event.currentTarget.style.removeProperty("--rx");
    event.currentTarget.style.removeProperty("--ry");
  }
  return <div className={className} onPointerMove={mover} onPointerLeave={soltar}>{children}</div>;
}

const FOTOS = [
  { foto: fotoCasa, alt: "Casa com placas solares no telhado", titulo: "Estimativa pelo clima do seu endereço", texto: "Informe o local, a potência, a inclinação e a orientação. O app carrega 5 anos de clima horário e calcula a geração esperada de cada placa." },
  { foto: fotoLimpeza, alt: "Trabalhador limpando uma fileira de placas solares com um rodo", titulo: "A hora certa de limpar", texto: "A recomendação considera a perda atual, a chuva prevista e em quantos dias a limpeza se paga." },
  { foto: fotoTelhado, alt: "Fileiras de placas solares sobre um telhado metálico", titulo: "Ranking das placas", texto: "Compara kWh por kWp e aponta a placa que rende mais de 10 pontos abaixo da mediana do grupo, sinal de sombra, defeito ou sujeira." }
];

const RECURSOS = [
  { titulo: "Real ao lado do estimado", texto: "Importe as leituras do inversor em CSV. Nas horas sem leitura, o app simula a geração descontando a sujeira acumulada." },
  { titulo: "Economia em reais", texto: "Com a tarifa do grupo, a energia gerada vira economia e a perda por sujeira vira o valor que você deixou de economizar." },
  { titulo: "Previsão de 7 dias", texto: "Veja a geração esperada para a semana e, depois, quanto a previsão acertou." }
];

const PASSOS = [
  { titulo: "Cadastre o grupo", texto: "Cole as coordenadas do Google Maps e informe a tarifa da sua conta de luz." },
  { titulo: "Adicione as placas", texto: "Potência em Wp, inclinação e orientação. A data de instalação é opcional." },
  { titulo: "Acompanhe", texto: "Em cerca de um minuto o histórico de 5 anos e a previsão da semana estão prontos." }
];

// ponytail: planos só de vitrine; o app ainda não cobra nem limita placas ou grupos (ver docs/FEATURES-INCOMPLETAS.md).
const PLANOS = [
  {
    nome: "Casa", para: "Para o telhado da sua casa.", mensal: 0, limite: "Até 12 placas · 1 grupo", botao: "Criar conta grátis",
    itens: ["Estimativa pelo clima real", "Previsão de 7 dias", "Recomendação de limpeza", "Economia em reais"]
  },
  {
    nome: "Comércio", para: "Para lojas, sítios e pequenas empresas.", mensal: 30, limite: "Até 60 placas · 5 grupos", botao: "Escolher Comércio", popular: true,
    itens: ["Tudo do plano Casa", "Importação de leituras do inversor (CSV)", "Ranking das placas com aviso de anomalia", "Alertas diários de limpeza e desempenho", "Relatório do período"]
  },
  {
    nome: "Usina", para: "Para integradores e usinas de solo.", mensal: 120, limite: "Até 500 placas · 50 grupos", botao: "Escolher Usina",
    itens: ["Tudo do plano Comércio", "Média histórica de 5 anos e calendário de geração", "Acerto da previsão dia a dia", "Alerta de previsão baixa para amanhã"]
  }
];

function Planos() {
  const [anual, setAnual] = useState(false);
  return (
    <section className="wrap planos" id="planos">
      <div className="planos-head">
        <div>
          <h2>Planos e preços</h2>
          <p>O plano acompanha o tamanho da sua instalação. Comece grátis e troque quando passar do limite de placas.</p>
        </div>
        <div className="ciclo" role="group" aria-label="Ciclo de cobrança">
          <button type="button" aria-pressed={!anual} onClick={() => setAnual(false)}>Mensal</button>
          <button type="button" aria-pressed={anual} onClick={() => setAnual(true)}>Anual <small>· 2 meses grátis</small></button>
        </div>
      </div>
      <div className="plan-grid">
        {PLANOS.map((plano) => {
          // Anual = 10 mensalidades cobradas de uma vez.
          const porMes = anual ? (plano.mensal * 10) / 12 : plano.mensal;
          const cobranca = !plano.mensal ? "Grátis para sempre" : anual ? `R$ ${(plano.mensal * 10).toLocaleString("pt-BR")} cobrados uma vez por ano` : "Cobrado todo mês";
          return (
            <Inclina key={plano.nome} graus={8} className={`plano3d${plano.popular ? " top" : ""}`}>
              <article className="plano">
                {plano.popular ? <span className="selo">Mais popular</span> : null}
                <h3>{plano.nome}</h3>
                <p className="para">{plano.para}</p>
                <p className="preco"><b>R$ {porMes}</b>{plano.mensal ? <span>/mês</span> : null}</p>
                <p className="cobranca">{cobranca}</p>
                <p className="limite">{plano.limite}</p>
                <ul>{plano.itens.map((item) => <li key={item}>{item}</li>)}</ul>
                <Link className={`lp-btn${plano.popular ? "" : " ghost"}`} to="/register">{plano.botao}</Link>
              </article>
            </Inclina>
          );
        })}
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="lp" id="top">
      <header className="wrap lp-nav">
        <a className="brand" href="#top"><img src={logo} alt="" width="36" height="36" />SolarVision</a>
        <nav aria-label="Seções">
          <a href="#recursos">Recursos</a>
          <a href="#como">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#simulacao">Simulação</a>
        </nav>
        <div className="lp-navcta">
          <Link className="lp-btn ghost" to="/login">Entrar</Link>
          <Link className="lp-btn" to="/register">Criar conta</Link>
        </div>
      </header>

      <main>
        <section className="wrap hero">
          <div className="hero-copy">
            <p className="eyebrow">Monitoramento de energia solar</p>
            <h1>Saiba quanto suas placas deveriam gerar. E quanto geraram.</h1>
            <p className="lp-lead">
              O SolarVision estima a geração de cada placa com o clima real do seu endereço, compara com o que foi medido e avisa quando a sujeira começa a custar dinheiro.
            </p>
            <div className="actions">
              <Link className="lp-btn" to="/register">Criar conta</Link>
              <a className="lp-btn ghost" href="#como">Ver como funciona</a>
            </div>
            <p className="fine">5 anos de clima horário e previsão de 7 dias para cada placa.</p>
          </div>

          <Inclina graus={16} className="stage">
            <figure className="panel">
              <figcaption>Exemplo ilustrativo · grupo “Casa”, 8 placas de 550 Wp</figcaption>
              <div className="tiles">
                <div><span>Gerado ontem</span><b>18,4 kWh</b><small>92% do estimado</small></div>
                <div><span>Economia no mês</span><b>R$ 412</b><small>tarifa de R$ 0,85/kWh</small></div>
                <div><span>Perda por sujeira</span><b>8,4%</b><small>42 dias sem limpar</small></div>
              </div>
              <GraficoExemplo />
              <p className="reco"><strong>Limpeza:</strong> chuva prevista para quinta (12 mm). Espere.</p>
            </figure>
          </Inclina>
        </section>

        <section className="wrap fotos" id="recursos">
          <h2>Do telhado ao painel</h2>
          <div className="cards">
            {FOTOS.map((item) => (
              <Inclina key={item.titulo} graus={12} className="card3d">
                <figure>
                  <img src={item.foto} alt={item.alt} loading="lazy" />
                  <figcaption><h3>{item.titulo}</h3><p>{item.texto}</p></figcaption>
                </figure>
              </Inclina>
            ))}
          </div>
        </section>

        <section className="wrap features">
          <div className="grid">
            {RECURSOS.map((item) => <article key={item.titulo}><h3>{item.titulo}</h3><p>{item.texto}</p></article>)}
          </div>
        </section>

        <section className="wrap steps" id="como">
          <h2>Como funciona</h2>
          <ol>{PASSOS.map((item) => <li key={item.titulo}><h3>{item.titulo}</h3><p>{item.texto}</p></li>)}</ol>
        </section>

        <Planos />

        <section className="wrap sim" id="simulacao">
          <div className="sim-head">
            <h2>Simulação</h2>
            <p>Mude a hora do dia e os dias sem limpar para ver quanto uma casa com quatro placas gera. Arraste a maquete para girar.</p>
          </div>
          <SimulacaoSolar />
        </section>

        <section className="cta">
          <div className="wrap">
            <h2>Cadastre a primeira placa e veja 5 anos de clima em cerca de um minuto.</h2>
            <Link className="lp-btn" to="/register">Criar conta</Link>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <span>SolarVision · Projeto Aplicado IV, SENAI</span>
          <span>
            Clima: <a href="https://open-meteo.com/">Open-Meteo</a> (CC BY 4.0) · Fotos: Wikimedia Commons (CC0), USDA (domínio público) e Deo photographer (CC BY-SA 4.0)
          </span>
        </div>
      </footer>
    </div>
  );
}
