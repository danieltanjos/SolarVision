// Conta da simulação da landing: quatro placas de 550 Wp num telhado a 22° voltado para o norte, em dia de céu limpo.
// ponytail: sol num arco fixo (equinócio, ~27° S) em vez do clima real; serve à demonstração, o app usa o Open-Meteo.

export const INCLINACAO = 0.384; // 22° em radianos
const LATITUDE = 0.47;
const POTENCIA_WP = 4 * 550;
const PR = 0.82; // mesmo performance ratio do app

export function simular(hora, dias) {
  const angulo = (Math.PI * (hora - 6)) / 12;
  const dia = hora > 6 && hora < 18;
  // Direção do sol: nasce a leste (+x), culmina ao norte (+z) e se põe a oeste.
  const sol = [Math.cos(angulo), Math.sin(angulo) * Math.cos(LATITUDE), Math.sin(angulo) * Math.sin(LATITUDE)];
  const incidencia = Math.max(0, sol[1] * Math.cos(INCLINACAO) + sol[2] * Math.sin(INCLINACAO));
  const perda = Math.min(0.002 * dias, 0.2); // mesmo modelo de sujeira do app: 0,2% ao dia, até 20%
  const watts = dia ? POTENCIA_WP * PR * incidencia * sol[1] ** 0.25 * (1 - perda) : 0;
  return { sol, dia, perda, watts, altura: dia ? sol[1] : 0 };
}
