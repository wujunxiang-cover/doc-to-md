import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root=dirname(fileURLToPath(import.meta.url));
const read=path=>readFile(join(root,path),'utf8');
const stripExports=source=>source.replace(/^export\s+/gm,'');

const model=stripExports(await read('js/model.js'));
const parser=stripExports((await read('js/parser.js')).replace(/^import \{ emptyDocument \} from '\.\/model\.js';\s*/m,''));
const exporters=stripExports((await read('js/exporters.js')).replace(/^import \{ toMarkdown \} from '\.\/parser\.js';\s*/m,''));
const app=(await read('web.js')).replace(/^import .*;\s*/gm,'');
const vendorPaths=['markdown-it/dist/browser/markdown-it.umd.min.js','markdown-it-mark/dist/markdown-it-mark.min.js','markdown-it-sub/dist/markdown-it-sub.min.js','markdown-it-sup/dist/markdown-it-sup.min.js'];
const vendor=(await Promise.all(vendorPaths.map(path=>readFile(join(root,'node_modules',path),'utf8')))).join('\n');
const bundle=`${vendor}\n(()=>{\n${model}\n${parser}\n${exporters}\nconst out={markdown,png,pdf,docx};\n${app}\n})();\n`;
await writeFile(join(root,'app.bundle.js'),bundle);
console.log('Built app.bundle.js for web and direct file:// use.');
