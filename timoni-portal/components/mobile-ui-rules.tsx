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
function configureMobileChat(root:ParentNode){root.querySelectorAll<HTMLElement>('div[role="dialog"][aria-modal="true"]').forEach(dialog=>{const section=dialog.querySelector<HTMLElement>('section[title^="Arraste a borda esquerda"]');if(!section)return;if(window.innerWidth<640){dialog.style.top="4rem";dialog.style.bottom="0";dialog.style.height="auto";section.style.height="calc(100% - 0.5rem)";section.style.maxHeight="calc(100% - 0.5rem)";section.style.borderTopLeftRadius=".75rem";section.style.borderTopRightRadius="0"}else{dialog.style.removeProperty("top");dialog.style.removeProperty("bottom");dialog.style.removeProperty("height");section.style.removeProperty("height");section.style.removeProperty("max-height");section.style.removeProperty("border-top-left-radius");section.style.removeProperty("border-top-right-radius")}})}
function applyRules(){const root=document.querySelector("main");if(root){hideExplanatoryText(root);forceGeneralView(root);configureStockCards(root);configureMeetingCards(root)}configureMobileChat(document)}
export default function MobileUiRules(){useEffect(()=>{applyRules();const observer=new MutationObserver(()=>applyRules());const onResize=()=>applyRules();observer.observe(document.body,{childList:true,subtree:true});window.addEventListener("resize",onResize);return()=>{observer.disconnect();window.removeEventListener("resize",onResize)}},[]);return null}
