export const defaults = {
  theme:'clean', pageMode:'continuous',
  fonts:{body:'Microsoft YaHei',heading:'Microsoft YaHei',latin:'Arial',code:'Menlo'},
  sizes:{body:16,h1:32,h2:24,h3:19,code:13},
  paragraph:{lineHeight:1.7,spacing:16,firstLineIndent:0,letterSpacing:0},
  headings:{
    h1:{bold:true,align:'left',before:28,after:14},
    h2:{bold:true,align:'left',before:22,after:11},
    h3:{bold:true,align:'left',before:17,after:9}
  },
  list:{indent:28,spacing:6},
  page:{size:'A4',orientation:'portrait',margin:'normal'}
};
export const themes={clean:'简洁文档',business:'商务报告',academic:'学术论文',study:'学习笔记',report:'正式报告',modern:'现代文档',official:'中文公文',notion:'Notion 风格',github:'GitHub 风格'};
export function emptyDocument(){return {blocks:[]};}
export function clone(value){return JSON.parse(JSON.stringify(value));}
