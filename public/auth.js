// Portão de acesso client-side. NÃO é segurança real: o front-end é 100% estático
// (GitHub Pages não tem servidor), então usuário/senha e o próprio data.json ficam
// sempre visíveis a quem inspecionar o código ou acessar a URL de data.json direto.
// Serve só para impedir acesso casual de quem tiver o link.
const AUTH_USER = "medidaincorreta";
const AUTH_PASS = "nocaminhocerto";
const AUTH_STORAGE_KEY = "cme-auth-ok";

function grantAccess() {
  document.getElementById("auth-gate").style.display = "none";
  document.getElementById("app-content").classList.remove("app-hidden");
  window.startDashboard();
}

function initAuthGate() {
  if (localStorage.getItem(AUTH_STORAGE_KEY) === "1") {
    grantAccess();
    return;
  }

  const form = document.getElementById("auth-form");
  const errorEl = document.getElementById("auth-error");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const user = document.getElementById("auth-user").value.trim();
    const pass = document.getElementById("auth-pass").value;

    if (user === AUTH_USER && pass === AUTH_PASS) {
      localStorage.setItem(AUTH_STORAGE_KEY, "1");
      errorEl.hidden = true;
      grantAccess();
    } else {
      errorEl.hidden = false;
      document.getElementById("auth-pass").value = "";
    }
  });
}

initAuthGate();
