document.addEventListener('DOMContentLoaded', function () {
  // Configurações do Gridstack
  const options = {
    // 12 colunas de grid
    column: 12, 
    // Espaçamento entre os widgets
    margin: 10, 
    // Desabilitar o redimensionamento/movimentação para visualização
    disableResize: false,
    disableDrag: false,
  };

  // Inicializa o grid na div .grid-stack
  const grid = GridStack.init(options);

  // Função para carregar os widgets do JSON
  const loadWidgets = async () => {
    try {
      // Busca o arquivo de configuração
      const response = await fetch('dashboard-config.json');
      const widgets = await response.json();

      // Limpa o grid antes de adicionar novos itens
      grid.removeAll(); 

      // Adiciona cada widget definido no JSON ao grid
      widgets.forEach(widget => {
        grid.addWidget({
          x: widget.x,
          y: widget.y,
          w: widget.w, // 'w' para width no Gridstack 10+
          h: widget.h, // 'h' para height
          content: widget.content
        });
      });
    } catch (error) {
      console.error('Erro ao carregar a configuração do dashboard:', error);
    }
  };

  // Carrega os widgets quando a página é aberta
  loadWidgets();
});