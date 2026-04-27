(function () {
    const STORAGE_KEY = 'solarVisionTheme';

    function temaEscuroAtivo() {
        return localStorage.getItem(STORAGE_KEY) === 'dark';
    }

    function aplicarTema(escuro) {
        document.documentElement.classList.toggle('dark-mode', escuro);
        document.documentElement.setAttribute('data-bs-theme', escuro ? 'dark' : 'light');

        if (document.body) {
            document.body.classList.toggle('dark-mode', escuro);
        }

        const checkbox = document.getElementById('modoEscuro');
        if (checkbox) {
            checkbox.checked = escuro;
        }
    }

    aplicarTema(temaEscuroAtivo());

    document.addEventListener('DOMContentLoaded', function () {
        aplicarTema(temaEscuroAtivo());

        const checkbox = document.getElementById('modoEscuro');
        if (!checkbox) return;

        checkbox.addEventListener('change', function () {
            const escuro = checkbox.checked;
            localStorage.setItem(STORAGE_KEY, escuro ? 'dark' : 'light');
            aplicarTema(escuro);
        });
    });
})();
