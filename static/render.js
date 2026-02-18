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
    document.getElementById('content').innerHTML = render(markdown);
}

loadPage();