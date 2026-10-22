import * as vscode from "vscode";

export function nonce() {
  let s = "";
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export function editorHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const media = vscode.Uri.joinPath(extensionUri, "media");
  const js = webview.asWebviewUri(vscode.Uri.joinPath(media, "editor.js"));
  const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "editor.css"));
  const n = nonce();
  // img-src data:/blob: is needed for html-to-image (SVG foreignObject → data URL → canvas)
  // fonts.googleapis.com / fonts.gstatic.com: document font tokens load via Google Fonts CSS2
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data: blob: https:`,
    `style-src ${webview.cspSource} 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src ${webview.cspSource} data: https://fonts.gstatic.com`,
    // cspSource allows ES module chunks under media/ (editor.js → chunks/*)
    `script-src 'nonce-${n}' ${webview.cspSource}`,
    `connect-src ${webview.cspSource}`,
  ].join("; ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="${css}" />
<title>Cursor Design</title>
</head>
<body>
<div id="root"></div>
<script type="module" nonce="${n}" src="${js}"></script>
</body>
</html>`;
}
