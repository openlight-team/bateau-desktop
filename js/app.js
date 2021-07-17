const homepage = "https://www.google.com/";
const ipc = require('electron').ipcRenderer;
const fs = require('fs');

function bateau_browse(url) {
    document.getElementById('browser').src = (url)
}

const webview = document.querySelector('webview');
var justgotback = false;

webview.addEventListener("did-finish-load", () => {
	if(justgotback !== true) {
        document.getElementById('forward').style.opacity = 0.5;
    }
    justgotback = false;


    document.getElementById('search').value = webview.getURL();
});

webview.addEventListener("page-title-updated", () => {
    document.getElementById('search').value = webview.getURL();
    document.title = webview.getTitle();
});

webview.addEventListener("page-favicon-updated", (favicons) => {
    document.getElementById('favicon').src = favicons.favicons[0];
});

webview.addEventListener('did-start-loading', () => {
    fs.readdir('user/css', (err, files) => {
        files.forEach(fdr => {
            if (fdr.includes(webview.url)) {
                fs.readdir("user/css"+fdr, (err, files) => {
                    files.forEach(file => {
                        if (file.includes(".css")) {
                            jQuery.get("user/css"+fdr+"/"+file, function(data) {
                                webview.insertCSS(data);
                            });
                        }
                    });
                });
            }
        });
    });
});

const isAbsoluteUrl = url => /^[a-z][a-z0-9+.-]*:/.test(url);
const isAbsoluteDomain = url => /^((?!-))(xn--)?[a-z0-9][a-z0-9-_]{0,61}[a-z0-9]{0,1}\.(xn--)?([a-z0-9\-]{1,61}|[a-z0-9-]{1,30}\.[a-z]{2,})$/.test(url);
var nextURL;

document.getElementById('search').addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        isFocusing = false;

        nextURL = document.getElementById('search').value;

        if(isAbsoluteUrl(nextURL)) {
            bateau_browse(nextURL);
        }
        else if(isAbsoluteDomain(nextURL)) {
            bateau_browse("http://"+nextURL);
        }
        else {
            bateau_browse("https://www.google.com/search?q="+nextURL+"&source=bateau");
        }
    }
})

var isFocusing = false;
var currentURL;

document.getElementById('search').addEventListener("focus", (event) => {
    currentURL = document.getElementById('search').value;
    isFocusing = true;
    document.getElementById('search').value = "";
})

document.getElementById('search').addEventListener("focusout", (event) => {
    if(isFocusing) {
        document.getElementById('search').value = currentURL;
    }
})

webview.addEventListener('new-window', (e) => {
    bateau_browse(e.url);
})

function bateau_back() {
    webview.goBack();
    justgotback = true;
    document.getElementById('forward').style.opacity = 1;
}

function bateau_forward() {
    webview.goForward();
    document.getElementById('forward').style.opacity = 0.5;
}

function bateau_devtools() {
    webview.openDevTools();
}

function bateau_reload() {
    webview.reload();
}

function bateau_copy() {
    navigator.clipboard.writeText(document.getElementById('search').value);
}

bateau_browse(homepage);

ipc.send('vibe');