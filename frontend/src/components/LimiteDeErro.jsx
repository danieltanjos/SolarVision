import { Component } from "react";

// Se uma tela quebra (um dado fora do formato esperado, por exemplo), mostra um aviso no lugar dela em vez
// de deixar o app inteiro em branco.
export default class LimiteDeErro extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro ao mostrar a tela.", erro, info);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="sv-page">
        <section className="card sv-empty" role="alert">
          <i className="bi bi-exclamation-triangle" />
          <p>{this.props.mensagem ?? "Não foi possível mostrar esta tela."}</p>
          <span>Recarregue a página. Se continuar, os dados exportados podem estar num formato antigo.</span>
        </section>
      </div>
    );
  }
}
