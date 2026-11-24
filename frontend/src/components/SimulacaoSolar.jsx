import { useEffect, useRef, useState } from "react";
import { TIME_ZONE } from "../lib/periodo";
import { simular } from "../lib/simulacao";

// Abre na hora atual de São Paulo; à noite fica nas 10h para o sol aparecer.
function horaInicial() {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  const agora = Number(p.hour) + Math.round(p.minute / 15) / 4;
  return agora > 7 && agora < 17 ? agora : 10;
}

const mistura = (a, b, k) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
const decimal = (valor, casas) => valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export default function SimulacaoSolar() {
  const [hora, setHora] = useState(horaInicial);
  const [dias, setDias] = useState(30);
  const [sem3d, setSem3d] = useState(false);
  const palco = useRef(null);
  const canvas = useRef(null);
  const cena = useRef(null);
  const sim = simular(hora, dias);
  const atual = useRef(sim);
  atual.current = sim;

  // A maquete (e a three) só é baixada aqui; sem WebGL, ou se o download falhar, fica a foto no lugar e a conta continua valendo.
  useEffect(() => {
    let vivo = true;
    import("./cenaSolar")
      .then(({ montaCena }) => {
        if (!vivo) return;
        cena.current = montaCena(palco.current, canvas.current);
        cena.current.atualiza(atual.current);
      })
      .catch(() => setSem3d(true));
    return () => {
      vivo = false;
      cena.current?.desmonta();
      cena.current = null;
    };
  }, []);

  useEffect(() => {
    cena.current?.atualiza(atual.current);
  }, [hora, dias]);

  const hh = Math.floor(hora);
  const rotulo = `${hh}h${String(Math.round((hora - hh) * 60)).padStart(2, "0")}`;
  const sujeira = sim.perda ? `−${(sim.perda * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% por sujeira` : "placas limpas";
  const leitura = sim.dia ? `${rotulo} · ${decimal(sim.watts / 1000, 2)} kW · ${sujeira}` : `${rotulo} · sem sol, sem geração`;
  const k = sim.altura ** 0.6;
  const ceu = `linear-gradient(${mistura([176, 196, 232], [140, 200, 245], k)}, ${mistura([255, 226, 196], [236, 246, 252], k)})`;

  return (
    <>
      <div className={`palco${sem3d ? " sem3d" : ""}`} ref={palco} style={sem3d ? undefined : { background: ceu }}>
        <canvas
          className="c3d"
          ref={canvas}
          role="img"
          aria-label="Maquete 3D de uma casa com quatro placas solares no telhado e o sol na hora escolhida"
        />
        <output className="sim-leitura" htmlFor="lp-hora lp-dias">{leitura}</output>
        <span className="dica">Arraste para girar</span>
      </div>
      <div className="controls">
        <div className="ctl">
          <label htmlFor="lp-hora">Hora do dia <span>{rotulo}</span></label>
          <input id="lp-hora" type="range" min="5" max="19" step="0.25" value={hora} onChange={(event) => setHora(Number(event.target.value))} />
          <div className="ticks" aria-hidden="true">
            {[6, 9, 12, 15, 18].map((h) => <span key={h} style={{ left: `${((h - 5) / 14) * 100}%` }}>{h}h</span>)}
          </div>
        </div>
        <div className="ctl">
          <label htmlFor="lp-dias">Dias sem limpar <span>{dias} {dias === 1 ? "dia" : "dias"}</span></label>
          <input id="lp-dias" type="range" min="0" max="100" step="1" value={dias} onChange={(event) => setDias(Number(event.target.value))} />
          <div className="ticks" aria-hidden="true">
            <span style={{ left: "4%" }}>0</span><span style={{ left: "50%" }}>50</span><span style={{ left: "95%" }}>100</span>
          </div>
        </div>
        <button type="button" className="lp-btn" onClick={() => setDias(0)}>Limpar placas</button>
      </div>
      <p className="note">
        Exemplo com quatro placas de 550 Wp voltadas para o norte, em dia de céu limpo. No app a curva vem do clima real e a sujeira zera com limpeza ou chuva forte.
      </p>
    </>
  );
}
