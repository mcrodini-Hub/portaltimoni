"use client";

import { useEffect } from "react";

const commonHiddenTextFragments = [
  "módulo operacional",
  "escolha o fornecedor uma vez, filtre itens quando precisar e finalize o pedido",
  "fluxo rápido",
  "entregas, retiradas e bloqueios de horário em uma agenda única",
  "gestão e acompanhamento",
  "pautas, atas, apresentações e duas datas futuras por loja",
  "sua contribuição ajuda a melhorar nosso dia a dia",
  "use este espaço para enviar sugestões",
  "acesso da gestão",
  "gerencie quem utiliza o portal",
  "uso direto no portal timoni",
  "espelho automático da lista de compras",
];
function normalizeText(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
function hideExplanatoryText(root:ParentNode){const fragments=[...commonHiddenTextFragments];if(window.location.pathname.includes("/dashboard/motorista"))fragments.push("casa timoni");root.querySelectorAll<HTMLElement>("p,h2,h3,span").forEach(el=>{const text=normalizeText(el.textContent||"");if(text&&fragments.some(f=>text.includes(normalizeText(f))))el.dataset.ctHiddenCopy="true"})}
function forceGeneralView(root:ParentNode){root.querySelectorAll<HTMLElement>("div").forEach(container=>{const buttons=Array.from(container.querySelectorAll<HTMLButtonElement>(":scope > button"));if(buttons.length!==3)return;const labels=buttons.map(b=>normalizeText(b.textContent||""));if(labels.join("|")!=="todas|rio claro|araras")return;if(!container.dataset.ctGeneralApplied){container.dataset.ctGeneralApplied="true";buttons[0].click()}container.dataset.ctStoreFilter="true"})}
function makeClickable(card:HTMLElement,details:HTMLElement[]){if(card.dataset.ctCollapsible==="true")return;card.dataset.ctCollapsible="true";card.dataset.ctExpanded="false";details.forEach(el=>el.dataset.ctCardDetail="true");card.addEventListener("click",event=>{const target=event.target as HTMLElement|null;if(target?.closest("button,a,input,textarea,select,label"))return;card.dataset.ctExpanded=card.dataset.ctExpanded==="true"?"false":"true"})}
function configureStockCards(root:ParentNode){if(!window.location.pathname.includes("/dashboard/estoque"))return;root.querySelectorAll<HTMLElement>("article").forEach(card=>{const text=normalizeText(card.textContent||"");if(!["relacao de compra","pedido feito","salvar observacao","produto chegou","consulta"].some(x=>text.includes(x)))return;const details:HTMLElement[]=[];Array.from(card.children).forEach((child,index)=>{if(!(child instanceof HTMLElement)||index===0)return;if(child.matches("p"))details.push(child);child.querySelectorAll<HTMLElement>("label,textarea").forEach(el=>details.push(el.closest("label")||el))});makeClickable(card,Array.from(new Set(details)))})}
function configureMeetingCards(root:ParentNode){if(!window.location.pathname.includes("/dashboard/reunioes"))return;root.querySelectorAll<HTMLElement>("article").forEach(card=>{const text=normalizeText(card.textContent||"");if(!text.includes("editar")&&!text.includes("concluir")&&!text.includes("excluir"))return;if(!text.includes("rio claro")&&!text.includes("araras"))return;const details:HTMLElement[]=[];Array.from(card.children).filter((x):x is HTMLElement=>x instanceof HTMLElement).forEach((child,index)=>{if(index===0){child.querySelectorAll<HTMLElement>("span").forEach(el=>details.push(el));return}if(index===1&&child.className.includes("grid-cols-2")){Array.from(child.children).filter((x):x is HTMLElement=>x instanceof HTMLElement).slice(1).forEach(el=>details.push(el));return}const links=Array.from(child.querySelectorAll<HTMLAnchorElement>("a"));const fileLinks=links.filter(a=>["pauta","ata","apresentacao","apresentação"].some(label=>normalizeText(a.textContent||"").includes(normalizeText(label))));if(fileLinks.length){fileLinks.forEach(a=>{a.dataset.ctAlwaysVisible="true"});return}if(!child.querySelector("button"))details.push(child)});makeClickable(card,details)})}
function applyRules(){const root=document.body;if(!root)return;hideExplanatoryText(root);forceGeneralView(root);configureStockCards(root);configureMeetingCards(root)}
export default function MobileUiRules(){useEffect(()=>{applyRules();const observer=new MutationObserver(()=>applyRules());observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);return null}
