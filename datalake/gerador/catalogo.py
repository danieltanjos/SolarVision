"""Catálogo do uso do SolarVision.

Tudo o que é regra de negócio do gerador mora aqui: eventos, telas, canais,
dispositivos, buscas e opções que o usuário escolhe. jornadas.py só
descreve o comportamento do usuário.
"""

from __future__ import annotations

EVENTOS = (
    # engajamento
    "page_view", "scroll", "click", "site_search", "select_content",
    "view_alerts", "view_cleaning_recommendation", "file_download", "change_settings",
    # ativação
    "create_group", "create_panel", "view_monitoring", "import_readings",
    "register_cleaning", "generate_report", "delete_panel", "delete_group",
    # conta
    "sign_up", "login", "logout",
)

# a jornada de ativação, na ordem do funil (enunciado 5.3)
FUNIL_ATIVACAO = (
    "sign_up", "create_group", "create_panel", "view_monitoring",
    "import_readings", "register_cleaning", "generate_report",
)

BASE_URL = "https://solarvision-senai.vercel.app"
CAMINHOS = {
    "login": "/login",
    "register": "/register",
    "home": "/app/home",
    "monitoramento": "/app/monitoramento",
    "relatorio": "/app/relatorio",
    "limpeza": "/app/limpeza",
    "cadastro": "/app/cadastro",
    "configuracoes": "/app/configuracoes",
}
PAGINAS = {tela: BASE_URL + caminho for tela, caminho in CAMINHOS.items()}
TITULOS = {
    "login": "Entrar", "register": "Criar conta", "home": "Início", "monitoramento": "Monitoramento",
    "relatorio": "Relatório", "limpeza": "Limpeza", "cadastro": "Cadastro", "configuracoes": "Configurações",
}
# telas do menu lateral: o link_id do clique é nav_<tela>
MENU = ("home", "monitoramento", "relatorio", "limpeza", "cadastro", "configuracoes")

# peso: participação nos novos usuários; fator_ativacao: multiplica a chance de cadastrar a primeira placa;
# fator_retencao: multiplica a chance de voltar outro dia
CANAIS = (
    {"source": "direct", "medium": "(none)", "campaign": None, "referrer": None,
     "peso": 0.18, "fator_ativacao": 1.0, "fator_retencao": 1.1},
    {"source": "google", "medium": "organic", "campaign": None, "referrer": "https://www.google.com/",
     "peso": 0.22, "fator_ativacao": 1.1, "fator_retencao": 1.2},
    {"source": "google", "medium": "cpc", "campaign": "monitoramento_solar", "referrer": "https://www.google.com/",
     "peso": 0.20, "fator_ativacao": 0.9, "fator_retencao": 0.8},
    {"source": "instagram", "medium": "social", "campaign": "energia_limpa", "referrer": "https://l.instagram.com/",
     "peso": 0.18, "fator_ativacao": 0.55, "fator_retencao": 0.6},
    {"source": "linkedin", "medium": "social", "campaign": None, "referrer": "https://www.linkedin.com/",
     "peso": 0.07, "fator_ativacao": 1.0, "fator_retencao": 1.0},
    {"source": "indicacao", "medium": "referral", "campaign": "integradores", "referrer": "https://integrador-parceiro.com.br/",
     "peso": 0.10, "fator_ativacao": 1.5, "fator_retencao": 1.4},
    {"source": "newsletter", "medium": "email", "campaign": "dicas_limpeza", "referrer": None,
     "peso": 0.05, "fator_ativacao": 1.2, "fator_retencao": 1.3},
)
DIRETO = CANAIS[0]

# o cadastro tem formulários longos: no celular, menos gente chega à primeira placa
DISPOSITIVOS = (
    {"category": "mobile", "os": "Android", "browser": "Chrome", "peso": 0.30, "fator_ativacao": 0.7, "fator_scroll": 1.1},
    {"category": "mobile", "os": "iOS", "browser": "Safari", "peso": 0.15, "fator_ativacao": 0.8, "fator_scroll": 1.1},
    {"category": "desktop", "os": "Windows", "browser": "Chrome", "peso": 0.33, "fator_ativacao": 1.15, "fator_scroll": 0.95},
    {"category": "desktop", "os": "Windows", "browser": "Edge", "peso": 0.05, "fator_ativacao": 1.1, "fator_scroll": 0.95},
    {"category": "desktop", "os": "macOS", "browser": "Safari", "peso": 0.12, "fator_ativacao": 1.2, "fator_scroll": 0.95},
    {"category": "tablet", "os": "iOS", "browser": "Safari", "peso": 0.05, "fator_ativacao": 0.95, "fator_scroll": 1.0},
)

# termo buscado no seletor de usinas -> quantas usinas ele acha (0 = o usuário procura algo que não existe)
BUSCAS_SELETOR = (
    ("casa", 1), ("sitio", 1), ("galpao", 1), ("leste", 2), ("norte", 2), ("oeste", 1),
    ("inversor", 0), ("bateria", 0), ("fazenda", 0), ("cliente", 0), ("consumo", 0),
)
SAIDAS = (("Open-Meteo", "https://open-meteo.com/"),)

VISOES = ("dia", "semana", "mes", "ano")
PESOS_VISAO = (0.35, 0.25, 0.30, 0.10)
CONFIGURACOES = ("perfil", "senha", "tema", "alertas", "limpeza", "cadastro", "rastreamento")
PESOS_CONFIGURACAO = (0.20, 0.10, 0.30, 0.15, 0.10, 0.10, 0.05)
POTENCIAS_WP = (330, 400, 450, 550, 580, 610)
PESOS_POTENCIA = (0.08, 0.12, 0.20, 0.35, 0.15, 0.10)

# ids das usinas que já existiam antes do rastreamento (usuários antigos); as novas começam em 1000
ID_INICIAL_NOVOS = 1000

# peso de cada hora do dia (UTC) no início de uma sessão: horário comercial de São Paulo (UTC-3)
PESOS_HORA = (3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 4, 7, 9, 9, 8, 8, 9, 9, 8, 7, 6, 5, 4)
