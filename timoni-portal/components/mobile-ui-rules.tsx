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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hideExplanatoryText(root: ParentNode) {
  const pathname = window.location.pathname;
  const fragments = [...commonHiddenTextFragments];
  if (pathname.includes("/dashboard/motorista")) fragments.push("casa timoni");

  root.querySelectorAll<HTMLElement>("p, h2, h3, span").forEach((element) => {
    const text = normalizeText(element.textContent || "");
    if (!text) return;
    const shouldHide = fragments.some((fragment) => text.includes(normalizeText(fragment)));
    if (shouldHide) element.dataset.ctHiddenCopy = "true";
  });
}

function forceGeneralView(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("div").forEach((container) => {
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(":scope > button"));
    if (buttons.length !== 3) return;
    const labels = buttons.map((button) => normalizeText(button.textContent || ""));
    if (labels.join("|") !== "todas|rio claro|araras") return;
    const allButton = buttons[0];
    if (!container.dataset.ctGeneralApplied) {
      container.dataset.ctGeneralApplied = "true";
      allButton.click();
    }
    container.dataset.ctStoreFilter = "true";
  });
}

function makeClickable(card: HTMLElement, detailElements: HTMLElement[]) {
  if (card.dataset.ctCollapsible === "true") return;
  card.dataset.ctCollapsible = "true";
  card.dataset.ctExpanded = "false";
  detailElements.forEach((element) => element.dataset.ctCardDetail = "true");

  card.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, label")) return;
    card.dataset.ctExpanded = card.dataset.ctExpanded === "true" ? "false" : "true";
  });
}

function configureStockCards(root: ParentNode) {
  if (!window.location.pathname.includes("/dashboard/estoque")) return;

  root.querySelectorAll<HTMLElement>("article").forEach((card) => {
    const cardText = normalizeText(card.textContent || "");
    const hasOperationalButtons = [
      "relacao de compra",
      "pedido feito",
      "salvar observacao",
      "produto chegou",
      "consulta",
    ].some((label) => cardText.includes(label));
    if (!hasOperationalButtons) return;

    const details: HTMLElement[] = [];
    Array.from(card.children).forEach((child, index) => {
      if (!(child instanceof HTMLElement) || index === 0) return;
      if (child.matches("p")) details.push(child);
      child.querySelectorAll<HTMLElement>("label, textarea").forEach((element) => details.push(element.closest("label") || element));
    });

    makeClickable(card, Array.from(new Set(details)));
  });
}

function configureMeetingCards(root: ParentNode) {
  if (!window.location.pathname.includes("/dashboard/reunioes")) return;

  root.querySelectorAll<HTMLElement>("article").forEach((card) => {
    const text = normalizeText(card.textContent || "");
    if (!text.includes("editar") && !text.includes("concluir") && !text.includes("excluir")) return;
    if (!text.includes("rio claro") && !text.includes("araras")) return;

    const details: HTMLElement[] = [];
    const directChildren = Array.from(card.children).filter((child): child is HTMLElement => child instanceof HTMLElement);

    directChildren.forEach((child, index) => {
      if (index === 0) {
        child.querySelectorAll<HTMLElement>("span").forEach((element) => details.push(element));
        return;
      }

      if (index === 1 && child.className.includes("grid-cols-2")) {
        const dateBoxes = Array.from(child.children).filter((element): element is HTMLElement => element instanceof HTMLElement);
        dateBoxes.slice(1).forEach((element) => details.push(element));
        return;
      }

      const hasManagementButtons = Boolean(child.querySelector("button"));
      if (!hasManagementButtons) details.push(child);
    });

    makeClickable(card, details);
  });
}

function applyRules() {
  const root = document.body;
  if (!root) return;
  hideExplanatoryText(root);
  forceGeneralView(root);
  configureStockCards(root);
  configureMeetingCards(root);
}

export default function MobileUiRules() {
  useEffect(() => {
    applyRules();
    const observer = new MutationObserver(() => applyRules());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
