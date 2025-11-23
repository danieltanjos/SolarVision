document.addEventListener('DOMContentLoaded', function () {
  // Configurações do Gridstack para um dashboard travado (read-only)
  const options = {
    column: 12,
    margin: 15,
    disableDrag: true,   // Impede que o usuário arraste os widgets
    disableResize: true, // Impede que o usuário redimensione os widgets
  };

  const grid = GridStack.init(options);

  // --- FUNÇÕES DE RENDERIZAÇÃO DE WIDGETS ---

  // Gera o HTML para um card de KPI
  const renderKpi = (widget) => {
    return `
      <div class="kpi-body">
        <i class="kpi-icon ${widget.options.icon}"></i>
        <span class="kpi-value">${widget.options.value}</span>
      </div>
      <p class="kpi-title mt-auto mb-0">${widget.options.title}</p>
    `;
  };

  // Gera o container HTML para um gráfico
  const renderChartContainer = (widget) => {
    return `
      <h5 class="chart-title">${widget.options.title}</h5>
      <div class="chart-container" id="${widget.id}-chart"></div>
    `;
  };

  // Renderiza um gráfico ApexCharts dentro do container especificado
  const renderApexChart = (widget) => {
    const chartOptions = {
      series: widget.options.series,
      chart: {
        height: '100%',
        type: 'area',
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: widget.options.categories },
      yaxis: { labels: { offsetX: -10 } },
      grid: {
        borderColor: '#f1f1f1',
        padding: { left: 10, right: 0 }
      },
      tooltip: {
        x: { format: 'dd/MM/yy HH:mm' },
      },
    };

    const chart = new ApexCharts(document.querySelector(`#${widget.id}-chart`), chartOptions);
    chart.render();
  };

  // --- FUNÇÃO PRINCIPAL ---

  // Carrega e constrói o dashboard a partir do arquivo de configuração
  const loadDashboard = async () => {
    try {
      const response = await fetch('monitoramento-config.json');
      const widgets = await response.json();

      grid.removeAll(); // Limpa o grid para garantir que não haja duplicatas

      widgets.forEach(widget => {
        let content = '';
        
        // Decide qual função de renderização usar com base no 'type' do widget
        switch (widget.type) {
          case 'kpi':
            content = renderKpi(widget);
            break;
          case 'lineChart':
            content = renderChartContainer(widget);
            break;
          default:
            content = 'Tipo de widget desconhecido';
        }

        // Adiciona o widget ao grid do Gridstack
        grid.addWidget({
            x: widget.x, y: widget.y, w: widget.w, h: widget.h,
            content: content,
            id: widget.id
        });

        // Se o widget for um gráfico, chama a função para renderizá-lo
        if (widget.type === 'lineChart') {
            renderApexChart(widget);
        }
      });
    } catch (error) {
      console.error('Erro ao carregar a configuração do dashboard:', error);
    }
  };

  // Inicia o carregamento do dashboard
  loadDashboard();
});