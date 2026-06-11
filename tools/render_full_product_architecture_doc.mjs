import { readFileSync, writeFileSync } from "node:fs";
import { marked } from "../03-frontend/node_modules/marked/lib/marked.esm.js";

const sourcePath =
  "docs/ARCHITOKEN_FULL_PRODUCT_APP_BOM_DATABASE_AGENT_WORKFLOW_TECH_ARCHITECTURE_2026.md";
const markdown = readFileSync(sourcePath, "utf8");
const html = marked.parse(markdown, { gfm: true });
const storageKey = "architoken-full-product-architecture-doc-v21-technical-review-20260610";

const documentHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ArchIToken 全产品应用、BOM、数据库、智能体、工作流与技术架构</title>
<style>
:root { --green:#07c160; --text:#14221a; --muted:#66756c; --line:#d9e5de; --bg:#f4f7f5; --panel:#fff; }
* { box-sizing:border-box; }
body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif; color:var(--text); background:var(--bg); }
header { position:sticky; top:0; z-index:10; background:rgba(255,255,255,.96); border-bottom:1px solid var(--line); backdrop-filter:blur(8px); }
.bar { max-width:1760px; margin:0 auto; padding:14px 20px; display:grid; grid-template-columns:1fr auto; gap:16px; align-items:center; }
.title { font-size:19px; font-weight:800; }
.sub { margin-top:4px; color:var(--muted); font-size:13px; }
.actions { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; align-items:center; }
button { border:1px solid var(--line); background:white; color:var(--text); padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:650; }
button.primary { background:var(--green); border-color:var(--green); color:white; }
main { max-width:1760px; margin:0 auto; padding:18px 20px 48px; display:grid; grid-template-columns:300px minmax(0,1fr); gap:18px; align-items:start; }
.doc { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:24px 28px 60px; box-shadow:0 10px 30px rgba(0,0,0,.04); line-height:1.72; outline:none; overflow-x:auto; }
.toc-panel { position:sticky; top:88px; max-height:calc(100vh - 108px); overflow:auto; background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:14px; box-shadow:0 10px 30px rgba(0,0,0,.04); }
.toc-title { font-weight:800; margin:0 0 10px; padding-bottom:8px; border-bottom:1px solid var(--line); }
.toc-list { list-style:none; margin:0; padding:0; display:grid; gap:2px; }
.toc-list li { margin:0; }
.toc-list a { display:block; color:var(--text); text-decoration:none; border-radius:5px; padding:5px 7px; line-height:1.35; font-size:13px; }
.toc-list a:hover { background:#eef5f1; color:#08702f; }
.toc-list .toc-h3 a { padding-left:18px; color:#415049; font-size:12px; }
.toc-list .toc-h4 a { padding-left:30px; color:#66756c; font-size:12px; }
.toc-list a.active { background:#e7f8ee; color:#08702f; font-weight:700; }
h1 { font-size:30px; margin:0 0 16px; padding-bottom:12px; border-bottom:2px solid var(--green); }
h2 { font-size:23px; margin-top:34px; padding-bottom:8px; border-bottom:1px solid var(--line); }
h3 { font-size:18px; margin-top:24px; }
h4 { font-size:16px; margin-top:20px; }
p { margin:10px 0; }
ul { margin:10px 0 18px 22px; padding:0; }
li { margin:4px 0; }
table { width:100%; border-collapse:collapse; margin:12px 0 22px; font-size:13px; }
th,td { border:1px solid var(--line); padding:8px 10px; vertical-align:top; }
th { background:#eef5f1; text-align:left; }
code { font-family:SFMono-Regular,Consolas,"Liberation Mono",monospace; background:#eef5f1; color:#08702f; padding:2px 5px; border-radius:4px; }
pre { background:#102016; color:#d9f7e5; padding:14px; border-radius:8px; overflow:auto; line-height:1.55; }
pre code { background:transparent; color:inherit; padding:0; }
hr { border:0; border-top:1px solid var(--line); margin:26px 0; }
.status { color:var(--muted); font-size:12px; margin-left:10px; }
@media (max-width:1100px) { main { grid-template-columns:1fr; } .toc-panel { position:relative; top:auto; max-height:320px; order:-1; } }
@media (max-width:900px) { .bar { grid-template-columns:1fr; } .actions { justify-content:flex-start; } main { padding:12px; } .doc { padding:18px; } }
@page { size:A4; margin:18mm 14mm 22mm; @bottom-center { content:"第 " counter(page) " 页 / 共 " counter(pages) " 页"; color:#66756c; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif; font-size:10pt; } }
@media print { header,.toc-panel { display:none; } body { background:#fff; } main { max-width:none; padding:0; display:block; } .doc { border:0; box-shadow:none; border-radius:0; padding:0; overflow:visible; } h2,h3,h4 { break-after:avoid; } table,pre { break-inside:avoid; } }
</style>
</head>
<body>
<header><div class="bar"><div><div class="title">ArchIToken 全产品应用、BOM、数据库、智能体、工作流与技术架构</div><div class="sub">16 模块 · BOM 主线 · 数据库 · Agent · Workflow · 技术栈 · 硬件预算 · 可在线编辑</div></div><div class="actions"><button class="primary" id="saveBtn">保存</button><button id="exportHtmlBtn">导出 HTML</button><button id="exportMdBtn">导出 Markdown</button><button id="resetBtn">恢复初稿</button><button id="printBtn">打印 / PDF</button><span class="status" id="state">未保存</span></div></div></header>
<main><aside class="toc-panel"><div class="toc-title">目录</div><nav id="toc"></nav></aside><article id="doc" class="doc" contenteditable="true"></article></main>
<script>
const storageKey=${JSON.stringify(storageKey)};
const initialHtml=${JSON.stringify(html)};
const initialMd=${JSON.stringify(markdown)};
const doc=document.getElementById("doc");
const state=document.getElementById("state");
const toc=document.getElementById("toc");
doc.innerHTML=localStorage.getItem(storageKey)||initialHtml;
let tocHeadings=[];
let tocLinks=[];
function headingId(text,index){return "sec-"+index+"-"+text.trim().toLowerCase().replace(/[^a-z0-9\\u4e00-\\u9fa5]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);}
function scrollToHeading(heading,mode="smooth"){
  const header=document.querySelector("header");
  const headerHeight=header?header.getBoundingClientRect().height:0;
  const offset=headerHeight+18;
  const top=window.scrollY+heading.getBoundingClientRect().top-offset;
  window.scrollTo({top:Math.max(0,top),behavior:mode});
  history.replaceState(null,"","#"+heading.id);
  setTimeout(syncTocWithScroll,mode==="smooth"?260:0);
}
function buildToc(){
  const headings=[...doc.querySelectorAll("h2,h3,h4")];
  const seen=new Set();
  const list=document.createElement("ul");
  list.className="toc-list";
  tocHeadings=[];
  tocLinks=[];
  headings.forEach((heading,index)=>{
    const text=heading.textContent.trim();
    if(!text)return;
    let id=heading.id||headingId(text,index);
    let unique=id;
    let suffix=2;
    while(seen.has(unique)){unique=id+"-"+suffix++;}
    seen.add(unique);
    heading.id=unique;
    const item=document.createElement("li");
    item.className="toc-"+heading.tagName.toLowerCase();
    const link=document.createElement("a");
    link.href="#"+unique;
    link.dataset.targetId=unique;
    link.textContent=text;
    link.onclick=(event)=>{event.preventDefault();scrollToHeading(heading,"smooth");};
    item.appendChild(link);
    list.appendChild(item);
    tocHeadings.push(heading);
    tocLinks.push(link);
  });
  toc.replaceChildren(list);
  syncTocWithScroll();
}
function syncTocWithScroll(){
  if(!tocHeadings.length)return;
  const activationTop=120;
  let active=tocHeadings[0];
  for(const heading of tocHeadings){
    if(heading.getBoundingClientRect().top<=activationTop)active=heading;
    else break;
  }
  let activeLink=null;
  for(const link of tocLinks){
    const isActive=link.dataset.targetId===active.id;
    link.classList.toggle("active",isActive);
    if(isActive)activeLink=link;
  }
  if(!activeLink)return;
  const panel=toc.closest(".toc-panel");
  const top=activeLink.offsetTop;
  const bottom=top+activeLink.offsetHeight;
  const viewTop=panel.scrollTop;
  const viewBottom=viewTop+panel.clientHeight;
  if(top<viewTop+28||bottom>viewBottom-28){
    panel.scrollTo({top:Math.max(0,top-panel.clientHeight/2+activeLink.offsetHeight/2),behavior:"smooth"});
  }
}
let tocTimer=0;
function scheduleBuildToc(){clearTimeout(tocTimer);tocTimer=setTimeout(buildToc,300);}
doc.addEventListener("input",()=>{state.textContent="未保存";scheduleBuildToc();});
window.addEventListener("scroll",syncTocWithScroll,{passive:true});
window.addEventListener("resize",syncTocWithScroll);
window.addEventListener("hashchange",()=>{
  const id=decodeURIComponent(location.hash.slice(1));
  const heading=id&&document.getElementById(id);
  if(heading)scrollToHeading(heading,"auto");
});
document.getElementById("saveBtn").onclick=()=>{localStorage.setItem(storageKey,doc.innerHTML);state.textContent="已保存到 localStorage";};
function tableToMarkdown(table){
  const rows=[...table.querySelectorAll("tr")].map(row=>[...row.children].map(cell=>cell.textContent.trim().replace(/\\s+/g," ")));
  if(!rows.length)return "";
  const width=Math.max(...rows.map(row=>row.length));
  const normalized=rows.map(row=>Array.from({length:width},(_,index)=>row[index]||""));
  const head=normalized[0];
  const body=normalized.slice(1);
  return "| "+head.join(" | ")+" |\\n| "+head.map(()=>"---").join(" | ")+" |\\n"+body.map(row=>"| "+row.join(" | ")+" |").join("\\n");
}
function htmlToMarkdown(root){
  const lines=[];
  const emit=(node)=>{
    if(node.nodeType!==1)return;
    const tag=node.tagName.toLowerCase();
    const text=node.textContent.trim().replace(/\\s+/g," ");
    if(!text&&tag!=="hr")return;
    if(tag==="h1")lines.push("# "+text);
    else if(tag==="h2")lines.push("## "+text);
    else if(tag==="h3")lines.push("### "+text);
    else if(tag==="h4")lines.push("#### "+text);
    else if(tag==="p")lines.push(text);
    else if(tag==="hr")lines.push("---");
    else if(tag==="pre"){const fence=String.fromCharCode(96,96,96);lines.push(fence+"\\n"+node.textContent.trim()+"\\n"+fence);}
    else if(tag==="ul")lines.push([...node.querySelectorAll(":scope > li")].map(li=>"- "+li.textContent.trim()).join("\\n"));
    else if(tag==="ol")lines.push([...node.querySelectorAll(":scope > li")].map((li,index)=>(index+1)+". "+li.textContent.trim()).join("\\n"));
    else if(tag==="table")lines.push(tableToMarkdown(node));
  };
  [...root.children].forEach(emit);
  return lines.join("\\n\\n")+"\\n";
}
function download(name,text,type){const b=new Blob([text],{type});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
const exportedPrintCss="<style>@page { size:A4; margin:18mm 14mm 22mm; @bottom-center { content:\\"第 \\" counter(page) \\" 页 / 共 \\" counter(pages) \\" 页\\"; color:#66756c; font-family:-apple-system,BlinkMacSystemFont,\\"Segoe UI\\",\\"Microsoft YaHei\\",Arial,sans-serif; font-size:10pt; } } @media print { body { background:#fff; } article { margin:0; padding:0; } table,pre { break-inside:avoid; } h2,h3,h4 { break-after:avoid; } }</style>";
document.getElementById("exportHtmlBtn").onclick=()=>download("ARCHITOKEN_FULL_PRODUCT_APP_BOM_DATABASE_AGENT_WORKFLOW_TECH_ARCHITECTURE_2026.html","<!doctype html><html lang=zh-CN><meta charset=utf-8><title>ArchIToken Full Product Architecture</title>"+exportedPrintCss+"<article>"+doc.innerHTML+"</article></html>","text/html;charset=utf-8");
document.getElementById("exportMdBtn").onclick=()=>download("ARCHITOKEN_FULL_PRODUCT_APP_BOM_DATABASE_AGENT_WORKFLOW_TECH_ARCHITECTURE_2026.md",htmlToMarkdown(doc),"text/markdown;charset=utf-8");
document.getElementById("resetBtn").onclick=()=>{if(confirm("恢复初稿会清除本页编辑缓存。继续？")){localStorage.removeItem(storageKey);doc.innerHTML=initialHtml;state.textContent="已恢复初稿";}};
document.getElementById("printBtn").onclick=()=>window.print();
buildToc();
if(location.hash){
  setTimeout(()=>{
    const id=decodeURIComponent(location.hash.slice(1));
    const heading=id&&document.getElementById(id);
    if(heading)scrollToHeading(heading,"auto");
  },0);
}
</script>
</body>
</html>
`;

const outputs = [
  "docs/ARCHITOKEN_FULL_PRODUCT_APP_BOM_DATABASE_AGENT_WORKFLOW_TECH_ARCHITECTURE_EDITABLE_2026.html",
  "docs/ARCHITOKEN_BOM_APP_DATABASE_AGENT_TECH_ARCHITECTURE_2026.html",
  "docs/ARCHITOKEN_COMPONENT_MATERIAL_BOM_ARCHITECTURE_EDITABLE_2026.html",
];

for (const output of outputs) {
  writeFileSync(output, documentHtml, "utf8");
}

const componentMaterialAlias = `# ArchIToken Component Material BOM Architecture

This file is a compatibility alias, not a separate source of truth.

Canonical document:

- [ARCHITOKEN_FULL_PRODUCT_APP_BOM_DATABASE_AGENT_WORKFLOW_TECH_ARCHITECTURE_2026.md](./ARCHITOKEN_FULL_PRODUCT_APP_BOM_DATABASE_AGENT_WORKFLOW_TECH_ARCHITECTURE_2026.md)

Reason: this file previously duplicated the canonical full-product architecture document byte-for-byte. Keeping one canonical Markdown prevents drift between BOM, database, agent and workflow architecture records.
`;

writeFileSync(
  "docs/ARCHITOKEN_COMPONENT_MATERIAL_BOM_ARCHITECTURE_2026.md",
  componentMaterialAlias,
  "utf8",
);
