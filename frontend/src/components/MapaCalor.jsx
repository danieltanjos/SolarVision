import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { carregarMapaCalor, cliquesDaTela, corDoCalor, pct, rolagemDaTela } from "../lib/bi";
import { LARGURA_FAIXA, gradienteDaFaixa, marcoY, pintarCalor, pontosDoElemento } from "../lib/mapaCalor";

// Mapa de calor da tela atual (só ADMIN), do jeito do site do projeto-modelo do professor: os elementos
// data-heat viram manchas difusas num canvas (paleta azul → vermelho por cima de um véu escuro), cada um com
// a etiqueta da taxa de clique, e a faixa da direita mostra até onde as sessões rolam. No app o menu e o
// cabeçalho são fixos na tela, então o canvas fica preso à janela e é redesenhado ao rolar.
// O overlay não recebe cliques (pointer-events: none) e não gera eventos.
const AVISO_SEM_MAPA = "Ainda não há mapa. Rode o job de exportação do mapa de calor (R11) para gerar "
  + "frontend/public/bi/mapa_calor.js e recarregue a página.";
const AVISO_SEM_CLIQUES = "O mapa não tem cliques: a landing foi gerada antes do element_id. Rode o gerador "
  + "de novo e o pipeline inteiro.";

export default function MapaCalor() {
  const { pathname } = useLocation();
  const [ligado, setLigado] = useState(false);
  const [mapa, setMapa] = useState(null);
  const [aviso, setAviso] = useState("");
  const [etiquetas, setEtiquetas] = useState([]);
  const [faixa, setFaixa] = useState(null);
  const canvasRef = useRef(null);
  const quadro = useRef(0);

  function avisar(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 6000);
  }

  async function alternar() {
    if (ligado) {
      setLigado(false);
      return;
    }
    const carregado = mapa ?? (await carregarMapaCalor());
    if (!carregado) {
      avisar(AVISO_SEM_MAPA);
      return;
    }
    setMapa(carregado);
    setLigado(true);
    avisar((carregado.cliques ?? []).length ? `Mapa de calor gerado em ${carregado.gerado_em}` : AVISO_SEM_CLIQUES);
  }

  const desenharCalor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!ligado || !mapa || !canvas) return;
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    const porElemento = new Map(cliquesDaTela(mapa, pathname).map((linha) => [linha.element_id, linha]));
    const pontos = [];
    const novas = [];
    let teto = 0;
    document.querySelectorAll("[data-heat]").forEach((elemento) => {
      const linha = porElemento.get(elemento.getAttribute("data-heat"));
      const caixa = elemento.getBoundingClientRect();
      // sem dado, escondido ou fora da janela
      if (!linha || !caixa.width || !caixa.height || caixa.bottom < 0 || caixa.top > altura) return;
      pontos.push(...pontosDoElemento(caixa, linha.intensidade));
      teto = Math.max(teto, Number(linha.intensidade) || 0);
      novas.push({ chave: `${linha.element_id}-${novas.length}`, left: caixa.left, top: caixa.bottom + 2,
        texto: pct(linha.taxa_clique, 1) });
    });
    pintarCalor(canvas, largura, altura, pontos, teto);
    setEtiquetas(novas);

    const rolagem = rolagemDaTela(mapa, pathname);
    const conteudo = document.querySelector(".sv-main");
    const doc = document.documentElement;
    if (!rolagem.length || !conteudo) {
      setFaixa(null);
      return;
    }
    const alturaDoc = doc.scrollHeight;
    setFaixa({
      left: conteudo.getBoundingClientRect().right - LARGURA_FAIXA,
      top: -window.scrollY,
      height: alturaDoc,
      fundo: gradienteDaFaixa(rolagem, alturaDoc, altura),
      marcos: rolagem.filter((linha) => linha.marco > 0)
        .map((linha) => ({ marco: linha.marco, y: marcoY(linha.marco, alturaDoc, altura), texto: pct(linha.pct_sessoes, 1) }))
    });
  }, [ligado, mapa, pathname]);

  useEffect(() => {
    if (!ligado || !mapa) {
      setEtiquetas([]);
      setFaixa(null);
      return undefined;
    }
    // redesenha no próximo quadro: rolar, redimensionar, trocar de tela ou o conteúdo mudar de tamanho
    function redesenharCalorDepois() {
      cancelAnimationFrame(quadro.current);
      quadro.current = requestAnimationFrame(desenharCalor);
    }
    redesenharCalorDepois();
    const tardio = setTimeout(redesenharCalorDepois, 800);      // a tela carrega dados depois de montar
    window.addEventListener("scroll", redesenharCalorDepois, true);
    window.addEventListener("resize", redesenharCalorDepois);
    const observador = "ResizeObserver" in window ? new ResizeObserver(redesenharCalorDepois) : null;
    const principal = document.querySelector(".sv-main");
    if (observador && principal) observador.observe(principal);
    // garantia extra: toda interação (clique, digitação, troca de opção) agenda um redesenho
    const interacoes = ["click", "input", "change"];
    interacoes.forEach((tipo) => document.addEventListener(tipo, redesenharCalorDepois, true));
    return () => {
      cancelAnimationFrame(quadro.current);
      clearTimeout(tardio);
      window.removeEventListener("scroll", redesenharCalorDepois, true);
      window.removeEventListener("resize", redesenharCalorDepois);
      observador?.disconnect();
      interacoes.forEach((tipo) => document.removeEventListener(tipo, redesenharCalorDepois, true));
    };
  }, [ligado, mapa, desenharCalor]);

  const principais = ligado ? cliquesDaTela(mapa, pathname).slice(0, 5) : [];

  return (
    <>
      <button
        type="button"
        id="mapa-calor"
        className={`sv-icon-btn ${ligado ? "is-ativo" : ""}`}
        onClick={alternar}
        aria-pressed={ligado}
        aria-label={ligado ? "Desligar o mapa de calor" : "Ligar o mapa de calor"}
        title="Liga/desliga o mapa de calor da Gold (frontend/public/bi/mapa_calor.js)"
      >
        <i className="bi bi-fire" />
      </button>
      {aviso ? <div className="sv-calor-aviso" role="status">{aviso}</div> : null}
      {ligado
        ? createPortal(
          <div className="sv-calor" aria-hidden="true">
            <canvas ref={canvasRef} className="sv-calor-canvas" />
            {etiquetas.map((e) => (
              <span key={e.chave} className="sv-calor-etiqueta" style={{ left: e.left, top: e.top }}>{e.texto}</span>
            ))}
            {faixa ? (
              <div className="sv-calor-faixa"
                style={{ left: faixa.left, top: faixa.top, height: faixa.height, background: faixa.fundo }}>
                {faixa.marcos.map((m) => (
                  <span key={m.marco} className="sv-calor-marco" style={{ top: m.y }}>{m.marco}% · {m.texto}</span>
                ))}
              </div>
            ) : null}
            <div className="sv-calor-painel">
              <strong>Mapa de calor · {pathname}</strong>
              {principais.length ? (
                <ol>
                  {principais.map((linha) => (
                    <li key={linha.element_id}>
                      <span className="sv-calor-cor" style={{ background: corDoCalor(linha.intensidade) }} />
                      {linha.element_id} · {linha.cliques} cliques · {pct(linha.taxa_clique, 1)} das sessões
                    </li>
                  ))}
                </ol>
              ) : <small>Sem cliques registrados nesta tela.</small>}
              <small>Gerado em {mapa?.gerado_em ?? "—"}</small>
            </div>
          </div>,
          document.body
        )
        : null}
    </>
  );
}
