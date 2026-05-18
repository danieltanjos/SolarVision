const STORAGE_KEY = "solarVisionTheme";

export function getInitialTheme() {
  return localStorage.getItem(STORAGE_KEY) === "dark";
}

export function applyTheme(isDark) {
  document.documentElement.classList.toggle("dark-mode", isDark);
  document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
  document.body.classList.toggle("dark-mode", isDark);
  localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
}
