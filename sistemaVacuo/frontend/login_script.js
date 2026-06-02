// =============================================
//  LOGIN — TSEA Energy
//  Valida ID na API, determina papel e
//  envia postMessage para o WebView2 (C#)
// =============================================

const API_URL = "http://localhost:5000/api";

// Fallback local caso a API esteja offline
const FALLBACK_USUARIOS = {
    "ENG-01": { nome: "Carlos Silva", papel: "engenheiro" },
    "ENG-001": { nome: "Carlos Silva", papel: "engenheiro" },
    "OP-001": { nome: "João Souza", papel: "operador" },
    "OP-002": { nome: "Ana Lima", papel: "engenheiro" },
    "SUP-01": { nome: "Marcos Admin", papel: "supervisor" },
    "SUP-001": { nome: "Marcos Admin", papel: "supervisor" }
};

// Mapa de papel → arquivo HTML
const TELA_POR_PAPEL = {
    "operador": "dashboard_operador.html",
    "engenheiro": "dashboard.html",
    "supervisor": "dashboard.html"
};

// =============================================
//  TEMA
// =============================================
function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem('tema', tema); } catch { }
    const lbl = document.getElementById('themeLabel');
    if (lbl) lbl.textContent = tema === 'dark' ? 'ESCURO' : 'CLARO';
}

function getTema() {
    try { return localStorage.getItem('tema') || 'dark'; } catch { return 'dark'; }
}

document.getElementById('themeToggle')?.addEventListener('click', () => {
    const atual = document.documentElement.getAttribute('data-theme') || 'dark';
    aplicarTema(atual === 'dark' ? 'light' : 'dark');
});

// =============================================
//  INICIALIZAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    aplicarTema(getTema());
    const inp = document.getElementById('inputId');
    if (inp) {
        inp.focus();
        inp.addEventListener('keypress', e => { if (e.key === 'Enter') confirmar(); });
    }
    document.getElementById('btnConfirmar')?.addEventListener('click', confirmar);
});

// =============================================
//  LOADING STATE
// =============================================
function setLoading(on) {
    const btn = document.getElementById('btnConfirmar');
    const inp = document.getElementById('inputId');
    if (!btn) return;
    if (on) {
        btn.disabled = true;
        btn.setAttribute('data-orig', btn.textContent);
        btn.innerHTML = '<span class="btn-spinner"></span>VERIFICANDO...';
        if (inp) inp.disabled = true;
    } else {
        btn.disabled = false;
        btn.textContent = btn.getAttribute('data-orig') || 'ENTRAR';
        if (inp) inp.disabled = false;
    }
}

function mostrarErro(msg) {
    const el = document.getElementById('errorMsg');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
}

// =============================================
//  CONFIRMAR LOGIN
// =============================================
async function confirmar() {
    const inp = document.getElementById('inputId');
    const id = inp?.value.trim().toUpperCase();
    if (!id) { mostrarErro('Digite um identificador válido.'); return; }

    setLoading(true);
    document.getElementById('errorMsg')?.classList.remove('show');

    let papel = null;
    let nome = null;

    // 1. Tenta API — busca por coluna "identificador" (o código de login ex: OP-001)
    //    A API deve retornar { id, nome, identificador, papel }
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        // Busca pelo campo identificador (codigo de login)
        const res = await fetch(`${API_URL}/operadores?identificador=${encodeURIComponent(id)}`, { signal: ctrl.signal });
        clearTimeout(timer);

        if (res.ok) {
            const data = await res.json();
            const reg = Array.isArray(data) ? data[0] : data;
            if (reg?.id) {
                // Normaliza: remove acentos, lowercase, aceita variações do campo
                const raw = (reg.papel || reg.cargo || reg.role || reg.tipo || '').toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                // Mapeia variações para os valores esperados
                if (raw.includes('eng')) papel = 'engenheiro';
                else if (raw.includes('sup')) papel = 'supervisor';
                else if (raw.includes('op') || raw.includes('oper')) papel = 'operador';
                else papel = raw; // tenta usar direto
                nome = reg.nome || reg.name || id;
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            setLoading(false);
            mostrarErro('Tempo de resposta excedido. Verifique a conexão.');
            return;
        }
        // API offline → cai no fallback
    }

    // 2. Fallback local
    if (!papel && FALLBACK_USUARIOS[id]) {
        papel = FALLBACK_USUARIOS[id].papel;
        nome = FALLBACK_USUARIOS[id].nome;
    }

    // 3. Não encontrado
    if (!papel) {
        setLoading(false);
        mostrarErro('Identificador não encontrado.');
        if (inp) { inp.value = ''; inp.focus(); }
        return;
    }

    // 4. Papel não mapeado
    const tela = TELA_POR_PAPEL[papel];
    if (!tela) {
        setLoading(false);
        mostrarErro('Papel de usuário não reconhecido. Contate o administrador.');
        return;
    }

    // 5. Salva contexto
    try {
        localStorage.setItem('usuarioId', id);
        localStorage.setItem('usuarioNome', nome);
        localStorage.setItem('usuarioPapel', papel);
    } catch { }

    // 6. Manda pro C# navegar
    const msg = `navegar:${tela}|${id}|${nome}|${papel}`;
    if (window.chrome?.webview) {
        window.chrome.webview.postMessage(msg);
    } else {
        // Fallback para testes direto no browser
        window.location.href = tela;
    }
}