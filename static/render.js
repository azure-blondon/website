import init, { render } from './renderer.js';

async function loadPage() {
    await init();
    
    const path = window.location.pathname;
    const mdPath = path.endsWith('/') ? path + 'index.md' : path + '.md';
    
    const response = await fetch(mdPath);
    if (!response.ok) {
        document.body.innerHTML = '<p>Page not found</p>';
        return;
    }
    
    const markdown = await response.text();
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = render(markdown);

    await executeScripts(contentEl);
}

async function executeScripts(container) {
    const scripts = container.querySelectorAll('script');
    
    for (const oldScript of scripts) {
        const newScript = document.createElement('script');
        
        for (const attr of oldScript.attributes) {
            newScript.setAttribute(attr.name, attr.value);
        }
        
        if (oldScript.src) {
            await new Promise((resolve, reject) => {
                newScript.onload = resolve;
                newScript.onerror = reject;
                oldScript.replaceWith(newScript);
            });
        } else {
            newScript.textContent = oldScript.textContent;
            oldScript.replaceWith(newScript);
        }
    }
}

loadPage();