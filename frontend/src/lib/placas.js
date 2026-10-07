// Azimute em graus a partir do Norte, no sentido horário (no Brasil, placas costumam olhar para o Norte).
export const ORIENTACOES = [
  ["0", "Norte"],
  ["45", "Nordeste"],
  ["90", "Leste"],
  ["135", "Sudeste"],
  ["180", "Sul"],
  ["225", "Sudoeste"],
  ["270", "Oeste"],
  ["315", "Noroeste"]
];

export function orientacao(azimute) {
  return ORIENTACOES.find(([graus]) => Number(graus) === azimute)?.[1] ?? `${azimute}°`;
}

export function climaStatus(panel) {
  if (panel.latitude == null || panel.potenciaWp == null || panel.inclinacao == null || panel.azimute == null) {
    return { texto: "Sem local/especificações", sincronizando: false, ok: false };
  }
  return panel.climaHistoricoEm
    ? { texto: "5 anos + previsão", sincronizando: false, ok: true }
    : { texto: "Sincronizando (~1 min)", sincronizando: true, ok: false };
}

// Soma da potência de pico (Wp) das placas.
export function potenciaInstalada(panels) {
  return panels.reduce((total, panel) => total + (Number(panel.potenciaWp) || 0), 0);
}
