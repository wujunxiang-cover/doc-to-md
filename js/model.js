export const defaults = {
  theme:'clean', pageMode:'continuous',
  fonts:{body:'Microsoft YaHei',heading:'Microsoft YaHei',latin:'Arial',code:'Menlo'},
  sizes:{body:16,h1:32,h2:24,h3:19,code:13},
  paragraph:{lineHeight:1.7,spacing:16,before:0,firstLineIndent:0,letterSpacing:0},
  headings:{
    h1:{font:'',bold:true,align:'left',before:28,after:14},
    h2:{font:'',bold:true,align:'left',before:22,after:11},
    h3:{font:'',bold:true,align:'left',before:17,after:9}
  },
  list:{indent:28,spacing:6,numbering:'source'},
  page:{size:'A4',orientation:'portrait',margin:'normal'}
};
export const themes={clean:'简洁文档',business:'商务报告',academic:'学术论文',study:'学习笔记',report:'正式报告',modern:'现代文档',official:'中文公文',notion:'Notion 风格',github:'GitHub 风格'};
export function emptyDocument(){return {blocks:[]};}
export function clone(value){return JSON.parse(JSON.stringify(value));}
function alphabetic(index,uppercase=false){let value='',number=index+1;while(number){number--;value=String.fromCharCode((uppercase?65:97)+(number%26))+value;number=Math.floor(number/26)}return value}
function roman(index){let number=index+1;if(number>3999)return String(number);let value='';for(const [amount,symbol] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(number>=amount){value+=symbol;number-=amount}return value}
export function formatListNumber(index,style='source',sourceNumber=''){
  if(style==='source'&&sourceNumber)return sourceNumber;
  if(style==='decimal-paren')return `(${index+1})`;
  if(style==='lower-alpha')return `${alphabetic(index)}.`;
  if(style==='upper-alpha')return `${alphabetic(index,true)}.`;
  if(style==='lower-roman')return `${roman(index).toLowerCase()}.`;
  if(style==='upper-roman')return `${roman(index)}.`;
  return `${index+1}.`;
}
