// Modal do Bootstrap controlado pelo React (sem window.confirm): Esc ou clique fora cancelam.
export default function ConfirmarExclusao({ texto, onConfirmar, onCancelar }) {
  return (
    <>
      <div
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-exclusao-titulo"
        onClick={(event) => event.target === event.currentTarget && onCancelar()}
        onKeyDown={(event) => event.key === "Escape" && onCancelar()}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title fs-5" id="confirmar-exclusao-titulo">Confirmar exclusão</h2>
            </div>
            <div className="modal-body">{texto}</div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancelar} autoFocus>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={onConfirmar}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

// Célula com os botões de editar e excluir de uma linha de tabela.
export function AcoesLinha({ nome, onEditar, onExcluir }) {
  return (
    <td className="text-end text-nowrap">
      <button type="button" className="btn btn-sm btn-outline-secondary me-1" title="Editar" aria-label={`Editar ${nome}`} onClick={onEditar}>
        <i className="bi bi-pencil" />
      </button>
      <button type="button" className="btn btn-sm btn-outline-danger" title="Excluir" aria-label={`Excluir ${nome}`} onClick={onExcluir}>
        <i className="bi bi-trash" />
      </button>
    </td>
  );
}
