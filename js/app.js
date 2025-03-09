const { ipcRenderer } = require('electron');
const fs = require('fs');

const HOMEPAGE = 'https://www.google.com/';
const SEARCH_ENGINE = 'https://www.google.com/search';

const elements = {
    tabBar: document.getElementById('tab-bar'),
    newTabButton: document.getElementById('new-tab-button'),
    urlInput: document.getElementById('url-input'),
    forwardButton: document.getElementById('forward-button'),
    backButton: document.getElementById('back-button'),
    reloadButton: document.getElementById('reload-button'),
    devtoolsButton: document.getElementById('devtools-button'),
    minimizeButton: document.getElementById('minimize-button'),
    maximizeButton: document.getElementById('maximize-button'),
    closeButton: document.getElementById('close-button'),
    browserContainer: document.querySelector('.browser-container')
};

let tabs = {
    count: 0,
    active: null,
    list: {}
};

let navigationState = {
    isNavigatingBack: false,
    currentURL: '',
    isAddressBarFocused: false
};

const urlPatterns = {
    absolute: /^[a-z][a-z0-9+.-]*:/,
    domain: /^((?!-))(xn--)?[a-z0-9][a-z0-9-_]{0,61}[a-z0-9]{0,1}\.(xn--)?([a-z0-9\-]{1,61}|[a-z0-9-]{1,30}\.[a-z]{2,})$/
};

const getActiveWebview = () => {
    return document.querySelector(`.webview-container[data-tab-id="${tabs.active}"] .webview`);
};

const adjustTabSizes = () => {
    const tabBar = elements.tabBar;
    const tabElements = document.querySelectorAll('.tab');
    const newTabButton = elements.newTabButton;
    const tabCount = tabElements.length;
    
    const availableWidth = tabBar.offsetWidth - newTabButton.offsetWidth - 20;
    
    let tabWidth = Math.floor(availableWidth / tabCount);
    const minTabWidth = 100;
    const maxTabWidth = 240;
    
    tabWidth = Math.min(Math.max(tabWidth, minTabWidth), maxTabWidth);
    
    tabElements.forEach(tab => {
        tab.style.width = `${tabWidth}px`;
        tab.style.minWidth = `${minTabWidth}px`;
        tab.style.maxWidth = `${maxTabWidth}px`;
    });
    
    if (tabWidth * tabCount > availableWidth) {
        tabBar.style.overflowX = 'auto';
    } else {
        tabBar.style.overflowX = 'hidden';
    }
};

const updateAddressBar = (url) => {
    if (!navigationState.isAddressBarFocused && url) {
        elements.urlInput.value = url;
    }
};

const updateTabInfo = (tabId, { title, url, favicon } = {}) => {
    if (!tabs.list[tabId]) return;
    
    if (title) {
        tabs.list[tabId].title = title;
        const titleElement = document.querySelector(`#tab-title-${tabId}`);
        if (titleElement) titleElement.textContent = title;
    }
    
    if (url) {
        tabs.list[tabId].url = url;

        if (tabId === tabs.active) {
            updateAddressBar(url);
        }
    }
    
    if (favicon) {
        tabs.list[tabId].favicon = favicon;
        const faviconElement = document.querySelector(`#tab-favicon-${tabId}`);
        if (faviconElement) faviconElement.src = favicon;
    }
};

const attachWebviewListeners = (webview, tabId) => {
    webview.addEventListener('page-title-updated', () => {
        const title = webview.getTitle();
        updateTabInfo(tabId, { title });
        
        if (tabId === tabs.active) {
            document.title = title || 'Bateau Desktop';
        }
    });
    
    webview.addEventListener('page-favicon-updated', ({ favicons }) => {
        if (favicons && favicons[0]) {
            const faviconElement = document.querySelector(`#tab-favicon-${tabId}`);
            if (faviconElement && !faviconElement.classList.contains('loading')) {
                updateTabInfo(tabId, { favicon: favicons[0] });
            } else if (faviconElement) {
                faviconElement.dataset.originalSrc = favicons[0];
            }
        }
    });
    
    webview.addEventListener('did-finish-load', () => {
        const url = webview.getURL();
        updateTabInfo(tabId, { url });
        
        if (!navigationState.isNavigatingBack && tabId === tabs.active) {
            elements.forwardButton.style.opacity = '0.5';
        }
        navigationState.isNavigatingBack = false;
        
        const faviconElement = document.querySelector(`#tab-favicon-${tabId}`);
        if (faviconElement) {
            faviconElement.classList.remove('loading');

            if (faviconElement.dataset.originalSrc) {
                faviconElement.src = faviconElement.dataset.originalSrc;
                delete faviconElement.dataset.originalSrc;
            }
        }
    });
    
    webview.addEventListener('did-start-loading', () => {
        // injectCustomCSS(webview);
        
        const faviconElement = document.querySelector(`#tab-favicon-${tabId}`);
        if (faviconElement) {
            faviconElement.classList.add('loading');

            if (faviconElement.src && !faviconElement.dataset.originalSrc) {
                faviconElement.dataset.originalSrc = faviconElement.src;
            }

            faviconElement.src = '';
        }

        elements.reloadButton.innerHTML = '<span class="material-icons">close</span>';
        elements.reloadButton.setAttribute('aria-label', 'Stop loading');
        elements.reloadButton.removeEventListener('click', browserActions.reload);
        elements.reloadButton.addEventListener('click', browserActions.stop);
    });

    webview.addEventListener('did-stop-loading', () => {
        const faviconElement = document.querySelector(`#tab-favicon-${tabId}`);
        if (faviconElement) {
            faviconElement.classList.remove('loading');
            if (faviconElement.dataset.originalSrc) {
                faviconElement.src = faviconElement.dataset.originalSrc;
                delete faviconElement.dataset.originalSrc;
            }
        }

        elements.reloadButton.innerHTML = '<span class="material-icons">refresh</span>';
        elements.reloadButton.setAttribute('aria-label', 'Reload page');
        elements.reloadButton.removeEventListener('click', browserActions.stop);
        elements.reloadButton.addEventListener('click', browserActions.reload);
    });    
    
    webview.addEventListener('new-window', (e) => {
        const newTabId = browserActions.createTab();
        browserActions.switchTab(newTabId);
        browserActions.navigate(e.url);
    });
    
    webview.addEventListener('did-navigate', () => {
        const url = webview.getURL();
        updateTabInfo(tabId, { url });
    });
    
    webview.addEventListener('did-navigate-in-page', () => {
        const url = webview.getURL();
        updateTabInfo(tabId, { url });
    });
};

// const injectCustomCSS = (webview) => {
//     try {
//         const targetWebview = webview || getActiveWebview();
//         if (!targetWebview || !targetWebview.getURL()) return;
        
//         const webviewUrl = targetWebview.getURL();
        
//         fs.readdir('user/css', (err, files) => {
//             if (err) return;
//             files.forEach(fdr => {
//                 if (fdr.includes(webviewUrl)) {
//                     fs.readdir(`user/css/${fdr}`, (err, cssFiles) => {
//                         if (err) return;
//                         cssFiles.forEach(file => {
//                             if (file.endsWith('.css')) {
//                                 fs.readFile(`user/css/${fdr}/${file}`, 'utf8', (err, data) => {
//                                     if (!err) targetWebview.insertCSS(data);
//                                 });
//                             }
//                         });
//                     });
//                 }
//             });
//         });
//     } catch (error) {
//         console.error('Error injecting custom CSS:', error);
//     }
// };

const browserActions = {
    navigate(url) {
        if (!url) return;
        const webview = getActiveWebview();
        if (webview) {
            webview.src = url;
            updateTabInfo(tabs.active, { url });
        }
    },

    goBack() {
        const webview = getActiveWebview();
        if (webview) {
            webview.goBack();
            navigationState.isNavigatingBack = true;
            elements.forwardButton.style.opacity = '1';
        }
    },

    goForward() {
        const webview = getActiveWebview();
        if (webview) {
            webview.goForward();
            elements.forwardButton.style.opacity = '0.5';
        }
    },

    reload() {
        const webview = getActiveWebview();
        if (webview) webview.reload();
    },

    openDevTools() {
        const webview = getActiveWebview();
        if (webview) webview.openDevTools();
    },

    processURL(input) {
        if (urlPatterns.absolute.test(input)) {
            return input;
        } else if (urlPatterns.domain.test(input)) {
            return `http://${input}`;
        } else {
            const params = new URLSearchParams({
                q: input,
                source: 'bateau'
            });
            return `${SEARCH_ENGINE}?${params.toString()}`;
        }
    },
    
    createTab() {
        tabs.count++;
        const tabId = `tab-${tabs.count}`;
        
        tabs.list[tabId] = {
            id: tabId,
            title: 'New Tab',
            favicon: '',
            url: ''
        };
        
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tabId;
        tabElement.innerHTML = `
            <img class="tab-favicon" id="tab-favicon-${tabId}" src="default-favicon.png" alt="">
            <span class="tab-title" id="tab-title-${tabId}">New Tab</span>
            <div class="tab-close">
                <span class="material-icons">close</span>
            </div>
        `;
        
        tabElement.addEventListener('click', () => browserActions.switchTab(tabId));
    
        const closeButton = tabElement.querySelector('.tab-close');
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            browserActions.closeTab(tabId);
        });
    
        elements.tabBar.insertBefore(tabElement, elements.newTabButton);
        adjustTabSizes();
        
        const webviewContainer = document.createElement('div');
        webviewContainer.className = 'webview-container';
        webviewContainer.dataset.tabId = tabId;
        
        const webview = document.createElement('webview');
        webview.id = `browser-${tabId}`;
        webview.className = 'webview';
        webview.setAttribute('allowpopups', '');
    
        webview.src = HOMEPAGE;
    
        attachWebviewListeners(webview, tabId);
    
        webviewContainer.appendChild(webview);
        elements.browserContainer.appendChild(webviewContainer);
        
        browserActions.switchTab(tabId);
    
        return tabId;
    },     
    
    switchTab(tabId) {
        if (!tabs.list[tabId]) return;
        
        tabs.active = tabId;
        
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tabId === tabId);
        });
        
        document.querySelectorAll('.webview-container').forEach(container => {
            container.classList.toggle('active', container.dataset.tabId === tabId);
        });
        
        const webview = getActiveWebview();
        if (webview) {
            const url = webview.getURL();
            const title = webview.getTitle();
            
            updateAddressBar(url);
            document.title = title || 'Bateau Desktop';
        }
    },
    
    closeTab(tabId) {
        if (!tabs.list[tabId] || Object.keys(tabs.list).length <= 1) return;
        
        const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tabElement) tabElement.remove();
        
        const webviewContainer = document.querySelector(`.webview-container[data-tab-id="${tabId}"]`);
        if (webviewContainer) webviewContainer.remove();
        
        delete tabs.list[tabId];
        
        if (tabs.active === tabId) {
            const newActiveTabId = Object.keys(tabs.list)[0];
            browserActions.switchTab(newActiveTabId);
        }
        
        adjustTabSizes();
    },

    stop() {
        const webview = getActiveWebview();
        if (webview) webview.stop();
    }
};

elements.urlInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        navigationState.isAddressBarFocused = false;
        const url = browserActions.processURL(elements.urlInput.value.trim());
        browserActions.navigate(url);
    }
});

elements.urlInput.addEventListener('focus', () => {
    navigationState.currentURL = elements.urlInput.value;
    navigationState.isAddressBarFocused = true;
    elements.urlInput.select();
});

elements.urlInput.addEventListener('blur', () => {
    if (navigationState.isAddressBarFocused) {
        navigationState.isAddressBarFocused = false;

        const webview = getActiveWebview();
        if (webview) {
            updateAddressBar(webview.getURL());
        }
    }
});

elements.backButton.addEventListener('click', () => browserActions.goBack());
elements.forwardButton.addEventListener('click', () => browserActions.goForward());
elements.reloadButton.addEventListener('click', () => browserActions.reload());
elements.devtoolsButton.addEventListener('click', () => browserActions.openDevTools());

elements.newTabButton.addEventListener('click', () => browserActions.createTab());

elements.minimizeButton.addEventListener('click', () => ipcRenderer.send('min'));
elements.maximizeButton.addEventListener('click', () => ipcRenderer.send('max'));
elements.closeButton.addEventListener('click', () => window.close());

window.addEventListener('DOMContentLoaded', () => {
    browserActions.createTab();
});

window.addEventListener('resize', adjustTabSizes);

adjustTabSizes();

ipcRenderer.send('vibe');