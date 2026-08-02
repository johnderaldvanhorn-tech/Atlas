const APP_VERSION='8.5.3';
window.APP_VERSION = APP_VERSION;
document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-app-version]').forEach(el=>el.textContent=`v${APP_VERSION}`);document.title=`ATLAS | Engineering & Innovation Management`;});
