const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");
const metaTheme = document.querySelector('meta[name="theme-color"]');

function resolvedTheme() {
  if (root.dataset.theme === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return root.dataset.theme;
}

function updateThemeLabel() {
  if (!toggle) return;
  const current = resolvedTheme();
  toggle.setAttribute("aria-label", current === "dark" ? "밝은 화면으로 바꾸기" : "어두운 화면으로 바꾸기");
  metaTheme?.setAttribute("content", current === "dark" ? "#171713" : "#f4f0e8");
}

toggle?.addEventListener("click", () => {
  root.dataset.theme = resolvedTheme() === "dark" ? "light" : "dark";
  localStorage.setItem("theme", root.dataset.theme);
  updateThemeLabel();
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updateThemeLabel);
updateThemeLabel();
