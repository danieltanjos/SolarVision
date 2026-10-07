// Lê coordenadas nos formatos que o Google Maps entrega:
//   "-27.548, -48.4988"           (clique direito no mapa)
//   27°32'52.8"S 48°29'55.6"W     (painel do lugar; aceita O/L para Oeste/Leste)
// Devolve { latitude, longitude } ou null se não reconhecer.
export function parseCoordenadas(texto) {
  const valor = texto.trim();
  let latitude;
  let longitude;

  if (valor.includes("°")) {
    const partes = [...valor.matchAll(/(\d+(?:[.,]\d+)?)°\s*(?:(\d+(?:[.,]\d+)?)['′]\s*)?(?:(\d+(?:[.,]\d+)?)(?:["″]|'')\s*)?([NSEWLO])/gi)];
    if (partes.length !== 2) return null;
    const decimal = ([, graus, minutos = "0", segundos = "0", hemisferio]) => {
      const numero = (parte) => Number(parte.replace(",", "."));
      const absoluto = numero(graus) + numero(minutos) / 60 + numero(segundos) / 3600;
      return /[SWO]/i.test(hemisferio) ? -absoluto : absoluto;
    };
    if (!/[NS]/i.test(partes[0][4]) || /[NS]/i.test(partes[1][4])) return null;
    [latitude, longitude] = partes.map(decimal);
  } else {
    const numeros = valor.match(/-?\d+(?:\.\d+)?/g);
    if (!numeros || numeros.length !== 2) return null;
    [latitude, longitude] = numeros.map(Number);
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
}
