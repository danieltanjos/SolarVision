import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { carregarMapaCalor, cliquesDaTela, corDoCalor, pct, rolagemDaTela } from "../lib/bi";

// Mapa de calor da tela atual (só ADMIN): pinta os elementos data-heat com a intensidade de cliques da Gold
// do datalake (R11) e mostra até onde as sessões rolam. Porta do botão "Mapa de calor" do site do
// projeto-modelo. O overlay não recebe cliques (pointer-events: none) e não gera eventos.
export default function MapaCalor() {
  const { pathname } = useLocation();
  const [ligado, setLigado] = useState(false);
  const [mapa, setMapa] = useState(null);
  const [aviso, setAviso] = useState("");
  const [manchas, setManchas] = useState([]);

  async function alternar() {
    if (ligado) {
      setLigado(false);
      return;
    }
    const carregado = mapa ?? (await carregarMapaCalor());
    if (!carregado) {
      setAviso("Ainda não há mapa: rode o datalake (pipeline/rodar_tudo.py) para gerar frontend/public/bi/mapa_calor.js.");
      setTimeout(() => setAviso(""), 6000);
      return;
    }
    setMapa(carregado);
    setLigado(true);
  }

  useEffect(() => {
    if (!ligado || !mapa) {
      setManchas([]);
      return undefined;
    }
    const linhas = cliquesDaTela(mapa, pathname);
    // Redesenha ao rolar, ao redimensionar e de tempos em tempos (a tela carrega dados depois de montar).
    function desenhar() {
      setManchas(linhas.flatMap((linha) =>
        [...document.querySelectorAll(`[data-heat="${CSS.escape(linha.element_id)}"]`)]
          .map((elemento) => ({ linha, caixa: elemento.getBoundingClientRect() }))
          .filter(({ caixa }) => caixa.width > 0 && caixa.height > 0)));
    }
    desenhar();
    const intervalo = setInterval(desenhar, 1000);
    window.addEventListener("scroll", desenhar, true);
    window.addEventListener("resize", desenhar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("scroll", desenhar, true);
      window.removeEventListener("resize", desenhar);
    };
  }, [ligado, mapa, pathname]);

  const rolagem = ligado ? rolagemDaTela(mapa, pathname) : [];
  const principais = ligado ? cliquesDaTela(mapa, pathname).slice(0, 5) : [];

  return (
    <>
      <button
        type="button"
        className={`sv-icon-btn ${ligado ? "is-ativo" : ""}`}
        onClick={alternar}
        aria-pressed={ligado}
        aria-label={ligado ? "Desligar o mapa de calor" : "Ligar o mapa de calor"}
        title="Mapa de calor (datalake de uso)"
      >
        <i className="bi bi-fire" />
      </button>
      {aviso ? <div className="sv-calor-aviso" role="status">{aviso}</div> : null}
      {ligado
        ? createPortal(
          <div className="sv-calor" aria-hidden="true">
            {manchas.map(({ linha, caixa }, i) => (
              <div
                key={`${linha.element_id}-${i}`}
                className="sv-calor-mancha"
                style={{ left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height,
                  background: corDoCalor(linha.intensidade) }}
              />
            ))}
            <div className="sv-calor-painel">
              <strong>Mapa de calor · {pathname}</strong>
              {principais.length ? (
                <ol>
                  {principais.map((linha) => (
                    <li key={linha.element_id}>
                      <span className="sv-calor-cor" style={{ background: corDoCalor(linha.intensidade) }} />
                      {linha.element_id} · {linha.cliques} cliques · {pct(linha.taxa_clique)} das sessões
                    </li>
                  ))}
                </ol>
              ) : <small>Sem cliques registrados nesta tela.</small>}
              {rolagem.length ? (
                <small>Rolagem: {rolagem.filter((m) => m.marco > 0).map((m) => `${m.marco}% → ${pct(m.pct_sessoes)}`).join(" · ")}</small>
              ) : null}
            </div>
          </div>,
          document.body
        )
        : null}
    </>
  );
}
