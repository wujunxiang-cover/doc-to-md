import {cp,mkdir,readFile,readdir,writeFile,copyFile} from 'node:fs/promises';
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
await mkdir(join(root,'vendor'),{recursive:true});
await mkdir(join(root,'vendor/katex'),{recursive:true});
await Promise.all([
  copyFile(join(root,'node_modules/html2canvas/dist/html2canvas.min.js'),join(root,'vendor/html2canvas.min.js')),
  copyFile(join(root,'node_modules/docx/build/index.umd.js'),join(root,'vendor/docx.umd.js')),
  copyFile(join(root,'node_modules/katex/dist/katex.min.js'),join(root,'vendor/katex/katex.min.js')),
  copyFile(join(root,'node_modules/katex/dist/katex.min.css'),join(root,'vendor/katex/katex.min.css'))
]);
const katexFontSource=join(root,'node_modules/katex/dist/fonts'),katexFontTarget=join(root,'vendor/katex/fonts');
await mkdir(katexFontTarget,{recursive:true});
await Promise.all((await readdir(katexFontSource)).filter(name=>name.endsWith('.woff2')).map(name=>copyFile(join(katexFontSource,name),join(katexFontTarget,name))));
console.log('Built app.bundle.js and local export libraries for web and direct file:// use.');
