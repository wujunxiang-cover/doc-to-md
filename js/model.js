export const defaults = { theme:'clean', pageMode:'continuous', fonts:{body:'Microsoft YaHei',heading:'Microsoft YaHei',latin:'Arial',code:'Menlo'}, sizes:{body:16,h1:32,h2:24,h3:19,code:13}, paragraph:{lineHeight:1.7,spacing:16}, page:{size:'A4',orientation:'portrait',margin:'normal'} };
export const themes={clean:'简洁文档',business:'商务报告',academic:'学术文档',notion:'Notion 风格',github:'GitHub 风格'};
export function emptyDocument(){return {blocks:[]};}
export function clone(value){return JSON.parse(JSON.stringify(value));}
