import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { telaVista, trackClique } from "../lib/tracking";

const TITULOS = {
  "/login": "Entrar",
  "/register": "Criar conta",
  "/app/home": "Início",
  "/app/monitoramento": "Monitoramento",
  "/app/relatorio": "Relatório",
  "/app/limpeza": "Limpeza",
  "/app/cadastro": "Cadastro",
  "/app/configuracoes": "Configurações",
  "/app/uso": "Uso da plataforma"
};

// Sem interface: registra o page_view de cada tela e os cliques em links marcados, como o
// listener de cliques do site do projeto-modelo. Links internos levam data-link-id (o element_id
// é o data-heat); links de saída levam data-saida.
export default function RastreadorDeTelas() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (TITULOS[pathname]) telaVista(`${TITULOS[pathname]} · SolarVision`);
  }, [pathname]);

  useEffect(() => {
    function aoClicar(event) {
      const link = event.target.closest?.("a[data-link-id], a[data-saida]");
      if (!link) return;
      const url = new URL(link.href, window.location.href);
      const saida = link.hasAttribute("data-saida");
      trackClique("click", link, {
        link_url: url.href,
        link_domain: saida ? url.hostname : undefined,
        link_text: link.textContent.trim() || link.getAttribute("aria-label") || undefined,
        link_id: saida ? undefined : link.getAttribute("data-link-id"),
        outbound: saida
      });
    }
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);

  return null;
}
