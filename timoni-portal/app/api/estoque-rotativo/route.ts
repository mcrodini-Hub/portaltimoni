import { createHash, randomUUID } from "node:crypto";
import { google, type sheets_v4 } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess, normalizeEmail } from "@/lib/access-control";
import { createChatMessage, ensureConversation } from "@/lib/internal-chat";
import { recordModuleUpdateSafely } from "@/lib/module-updates";
import { getStoredTrelloCredentials, normalizeTrelloText, trelloFetch, TRELLO_BOARD_SHORT_LINK } from "@/lib/trello";
import {
  ROTATING_STOCK_CENTRAL,
  ROTATING_STOCK_EMAILS,
  acquireRotatingStockLock,
  attachSupplierToWaitingUpdates,
  createRotatingStockUpdate,
  confirmSupplierStandardization,
  deleteCompletedRotatingStockUpdate,
  deleteSupplierStandardization,
  finishConference,
  getRotatingStockUpdate,
  listConferenceItems,
  listExpiredHighlights,
  listRotatingStockData,
  listSupplierCodeLinks,
  markHighlightsCleared,
  prepareSupplierStandardization,
  resolveNotFoundItem,
  correctConferenceItem,
  reopenRotatingStockUpdate,
  saveConference,
  saveSupplierCodeLink,
  saveSupplierMapping,
  type RotatingStockItem,
} from "@/lib/rotating-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGEMENT_EMAILS = new Set<string>([ROTATING_STOCK_EMAILS.cica, ROTATING_STOCK_EMAILS.marcelo]);
const SUPPLIER_SPREADSHEETS = [
  {
    "id": "1UPHFWbuwksxNYUXMFZpLqlpSj_Ebm6Auz4eR-Ni8M6k",
    "name": "ROMPLAS",
    "url": "https://docs.google.com/spreadsheets/d/1UPHFWbuwksxNYUXMFZpLqlpSj_Ebm6Auz4eR-Ni8M6k/edit?usp=drivesdk"
  },
  {
    "id": "1RUVgsbodqUiEM6-vPHIW3i9vWQM2sVBJHs0O1FJKdTI",
    "name": "MINGMORI HAITI EVA",
    "url": "https://docs.google.com/spreadsheets/d/1RUVgsbodqUiEM6-vPHIW3i9vWQM2sVBJHs0O1FJKdTI/edit?usp=drivesdk"
  },
  {
    "id": "1I9IDEOOGxG1C2U7x44e9x7b4a_1eecicEaGQs-z4Ejw",
    "name": "SANKONFORT",
    "url": "https://docs.google.com/spreadsheets/d/1I9IDEOOGxG1C2U7x44e9x7b4a_1eecicEaGQs-z4Ejw/edit?usp=drivesdk"
  },
  {
    "id": "1WhU4TlFxnK4UhjUOIwGCcVC5NvDZlqN6lXhAiIj1i20",
    "name": "PIC CORRENTES-KTELI",
    "url": "https://docs.google.com/spreadsheets/d/1WhU4TlFxnK4UhjUOIwGCcVC5NvDZlqN6lXhAiIj1i20/edit?usp=drivesdk"
  },
  {
    "id": "1dsoQGenSTbg9lKh_RS7emQ3cALydU7S5GYiT6pS_wZ0",
    "name": "MAX EBERHARDT",
    "url": "https://docs.google.com/spreadsheets/d/1dsoQGenSTbg9lKh_RS7emQ3cALydU7S5GYiT6pS_wZ0/edit?usp=drivesdk"
  },
  {
    "id": "1KT5C2hN-K9SEca4Zuf2sIUOtPKVhmfvhQnDrRZrVHXE",
    "name": "KOMLOG",
    "url": "https://docs.google.com/spreadsheets/d/1KT5C2hN-K9SEca4Zuf2sIUOtPKVhmfvhQnDrRZrVHXE/edit?usp=drivesdk"
  },
  {
    "id": "1UX_vj56ikSV7HEKvVJDzbcdNI6CkFRGAuI_R_FfLJy8",
    "name": "CLOPEGA-ALGODAO FIBRA SINTETICA",
    "url": "https://docs.google.com/spreadsheets/d/1UX_vj56ikSV7HEKvVJDzbcdNI6CkFRGAuI_R_FfLJy8/edit?usp=drivesdk"
  },
  {
    "id": "1hSjdl_AJ98n9qJrzMqc32tDFhoidpjEdJSMo63RgLpg",
    "name": "ISOTERM",
    "url": "https://docs.google.com/spreadsheets/d/1hSjdl_AJ98n9qJrzMqc32tDFhoidpjEdJSMo63RgLpg/edit?usp=drivesdk"
  },
  {
    "id": "1nJbfTuQqpbVrLmW6Q1HE6dzijZ78GW2P7HbnDaI1oyg",
    "name": "GIACCHERINI",
    "url": "https://docs.google.com/spreadsheets/d/1nJbfTuQqpbVrLmW6Q1HE6dzijZ78GW2P7HbnDaI1oyg/edit?usp=drivesdk"
  },
  {
    "id": "1SyrWltJISx5jaOoy9mpMm7UiSebAG6-cijuI_nV4bxw",
    "name": "AMYCRON",
    "url": "https://docs.google.com/spreadsheets/d/1SyrWltJISx5jaOoy9mpMm7UiSebAG6-cijuI_nV4bxw/edit?usp=drivesdk"
  },
  {
    "id": "1hMpNRl72MjEewLYwRvhUQnT4ueGyImYMerSjH2hctpw",
    "name": "KUNSTEK/ACETEC",
    "url": "https://docs.google.com/spreadsheets/d/1hMpNRl72MjEewLYwRvhUQnT4ueGyImYMerSjH2hctpw/edit?usp=drivesdk"
  },
  {
    "id": "1hCUd69ZKV9FQpZCo07brFHga-MGDKt_DyewDnUB9F7U",
    "name": "MULTINOVA/FERPEX",
    "url": "https://docs.google.com/spreadsheets/d/1hCUd69ZKV9FQpZCo07brFHga-MGDKt_DyewDnUB9F7U/edit?usp=drivesdk"
  },
  {
    "id": "1_IN9SloDbN-N2qe8NI2ZpEFR3cX-7P773EvsTwSbVjo",
    "name": "MILENE",
    "url": "https://docs.google.com/spreadsheets/d/1_IN9SloDbN-N2qe8NI2ZpEFR3cX-7P773EvsTwSbVjo/edit?usp=drivesdk"
  },
  {
    "id": "1avviv9HPhcpM_OkSGvXXj58hkpAbNozucb5ry8ukNBg",
    "name": "VICK-POLYBRASIL",
    "url": "https://docs.google.com/spreadsheets/d/1avviv9HPhcpM_OkSGvXXj58hkpAbNozucb5ry8ukNBg/edit?usp=drivesdk"
  },
  {
    "id": "1gkFsC5KmO7p6qoXHmVsI1r12JEgpmbih0GZrbaDozV0",
    "name": "OBER-INYLBRA-ETRURIA-CARPETE",
    "url": "https://docs.google.com/spreadsheets/d/1gkFsC5KmO7p6qoXHmVsI1r12JEgpmbih0GZrbaDozV0/edit?usp=drivesdk"
  },
  {
    "id": "1GXI8KPR_x68QLdnrNsT83LNnD0scyyTKvg_j8NakNUQ",
    "name": "CLASSE JL",
    "url": "https://docs.google.com/spreadsheets/d/1GXI8KPR_x68QLdnrNsT83LNnD0scyyTKvg_j8NakNUQ/edit?usp=drivesdk"
  },
  {
    "id": "16phBL86TvyME4SdSGt_lpfP70uAZhUVuTXOpXXuwDQk",
    "name": "SCALTRO IND E COM DE PRODUTOS",
    "url": "https://docs.google.com/spreadsheets/d/16phBL86TvyME4SdSGt_lpfP70uAZhUVuTXOpXXuwDQk/edit?usp=drivesdk"
  },
  {
    "id": "1lyDnvzTOtLLAGKR5sy1IR3gcNv68rnRihfoYwFIS3lw",
    "name": "MAN BOTÕES CARDENAS",
    "url": "https://docs.google.com/spreadsheets/d/1lyDnvzTOtLLAGKR5sy1IR3gcNv68rnRihfoYwFIS3lw/edit?usp=drivesdk"
  },
  {
    "id": "1hakQHFD5Vh2m-jvC3pOz8-pwGOxz2ayKCJgV0RpdB5U",
    "name": "NS LIBANO",
    "url": "https://docs.google.com/spreadsheets/d/1hakQHFD5Vh2m-jvC3pOz8-pwGOxz2ayKCJgV0RpdB5U/edit?usp=drivesdk"
  },
  {
    "id": "124MqSyj3xySZ8wSUG32TLUT_zssQPggbwvfNzuCYGt8",
    "name": "TR NYLON DUBLADO - VIVO",
    "url": "https://docs.google.com/spreadsheets/d/124MqSyj3xySZ8wSUG32TLUT_zssQPggbwvfNzuCYGt8/edit?usp=drivesdk"
  },
  {
    "id": "1qEGywU77BS557_ykFj77NllNP_cRNRy4vpjQ3O2LzKc",
    "name": "MET SAO RAPHAEL-MET VERDADEIRO-FUSI",
    "url": "https://docs.google.com/spreadsheets/d/1qEGywU77BS557_ykFj77NllNP_cRNRy4vpjQ3O2LzKc/edit?usp=drivesdk"
  },
  {
    "id": "1E3JrR2Evg5wjzBl0aseLOAhg2OakxiTgr8m4yUG4smk",
    "name": "THR/CYCLOPACK",
    "url": "https://docs.google.com/spreadsheets/d/1E3JrR2Evg5wjzBl0aseLOAhg2OakxiTgr8m4yUG4smk/edit?usp=drivesdk"
  },
  {
    "id": "1VbGCmnADI-2KNgvGLB7WO_5r5Ws5bl2iXa7e-9H6J7c",
    "name": "COMPLETA",
    "url": "https://docs.google.com/spreadsheets/d/1VbGCmnADI-2KNgvGLB7WO_5r5Ws5bl2iXa7e-9H6J7c/edit?usp=drivesdk"
  },
  {
    "id": "1DCQN0N64GU7xz3XutiZcbGf0gUO-czbafpwdM23z6-Y",
    "name": "NEOPRENE",
    "url": "https://docs.google.com/spreadsheets/d/1DCQN0N64GU7xz3XutiZcbGf0gUO-czbafpwdM23z6-Y/edit?usp=drivesdk"
  },
  {
    "id": "1-HG6VR564V8RECV_D_MtisxpAfruLACIVyKLOL-HNxA",
    "name": "DISTR PREMIUM",
    "url": "https://docs.google.com/spreadsheets/d/1-HG6VR564V8RECV_D_MtisxpAfruLACIVyKLOL-HNxA/edit?usp=drivesdk"
  },
  {
    "id": "1_Lc_STTeOq1tnVzMZVJZ4a-wFP_GduQxXxNzjqHZZ0w",
    "name": "PINCEIS TIGRE",
    "url": "https://docs.google.com/spreadsheets/d/1_Lc_STTeOq1tnVzMZVJZ4a-wFP_GduQxXxNzjqHZZ0w/edit?usp=drivesdk"
  },
  {
    "id": "182WYRKzAVfD5EalonGfTZ1eiKwqaaJAXieWcXF_0muU",
    "name": "TEKBOND - SAINT GOBAIN",
    "url": "https://docs.google.com/spreadsheets/d/182WYRKzAVfD5EalonGfTZ1eiKwqaaJAXieWcXF_0muU/edit?usp=drivesdk"
  },
  {
    "id": "1ncx0_t4g1rAJQ9I-zRDlta3FO6N17e7wnL1g9Co-16s",
    "name": "ADERE",
    "url": "https://docs.google.com/spreadsheets/d/1ncx0_t4g1rAJQ9I-zRDlta3FO6N17e7wnL1g9Co-16s/edit?usp=drivesdk"
  },
  {
    "id": "142DDNk_iH8ewIOqQOFMMnAMMRNzjjX98Xy-bvGtheU0",
    "name": "ACRILEX",
    "url": "https://docs.google.com/spreadsheets/d/142DDNk_iH8ewIOqQOFMMnAMMRNzjjX98Xy-bvGtheU0/edit?usp=drivesdk"
  },
  {
    "id": "1CDilavwDOFX_C5iQ6BJZZ6raUia9pLlGIxOWQLTskUE",
    "name": "MULTIFITAS",
    "url": "https://docs.google.com/spreadsheets/d/1CDilavwDOFX_C5iQ6BJZZ6raUia9pLlGIxOWQLTskUE/edit?usp=drivesdk"
  },
  {
    "id": "1uIGhodo9pX-AbkMtJgQAA3lWQTZnc5DUB07zXhGZCcY",
    "name": "PALMILHAS TOP FLEX",
    "url": "https://docs.google.com/spreadsheets/d/1uIGhodo9pX-AbkMtJgQAA3lWQTZnc5DUB07zXhGZCcY/edit?usp=drivesdk"
  },
  {
    "id": "1u93LiVKCgQWnzNMSQxxEPPNLj_YgMHh7o1GnqDTXjo0",
    "name": "LAHUMAN-NETTEN-MULTITEXTIL",
    "url": "https://docs.google.com/spreadsheets/d/1u93LiVKCgQWnzNMSQxxEPPNLj_YgMHh7o1GnqDTXjo0/edit?usp=drivesdk"
  },
  {
    "id": "1VfyScSZn7luNch9wWdwQlxxyuGDo6Dq6xWKozwz7bmg",
    "name": "FCC",
    "url": "https://docs.google.com/spreadsheets/d/1VfyScSZn7luNch9wWdwQlxxyuGDo6Dq6xWKozwz7bmg/edit?usp=drivesdk"
  },
  {
    "id": "1woobp9-VJVqILchFFFnHIjKNc1Pc9GxVq0ZQMmbHpYY",
    "name": "FITAS DEMARCAÇÃO E ANTIDERRAPANTE",
    "url": "https://docs.google.com/spreadsheets/d/1woobp9-VJVqILchFFFnHIjKNc1Pc9GxVq0ZQMmbHpYY/edit?usp=drivesdk"
  },
  {
    "id": "1EFuzi4QjJhjDd3ZcB8UOvcGgHOPv0LpHfRaDuOZ2HUU",
    "name": "ULTRAFITAS",
    "url": "https://docs.google.com/spreadsheets/d/1EFuzi4QjJhjDd3ZcB8UOvcGgHOPv0LpHfRaDuOZ2HUU/edit?usp=drivesdk"
  },
  {
    "id": "15aL19fJSW2aX5oJGTN68iX3IrxzAvvVA4TptA1CKtFI",
    "name": "YORK",
    "url": "https://docs.google.com/spreadsheets/d/15aL19fJSW2aX5oJGTN68iX3IrxzAvvVA4TptA1CKtFI/edit?usp=drivesdk"
  },
  {
    "id": "11JEa0DCEDqPZcW2xR_NTwnD2WjarX6PYDZZkg94PMOA",
    "name": "BETINA",
    "url": "https://docs.google.com/spreadsheets/d/11JEa0DCEDqPZcW2xR_NTwnD2WjarX6PYDZZkg94PMOA/edit?usp=drivesdk"
  },
  {
    "id": "1kxxjidxagdTs1avLKvWToCKvmul-qlWKOUJDxxAlxrc",
    "name": "CYCLOPAC-FITAR",
    "url": "https://docs.google.com/spreadsheets/d/1kxxjidxagdTs1avLKvWToCKvmul-qlWKOUJDxxAlxrc/edit?usp=drivesdk"
  },
  {
    "id": "1QRDoHEspNONUKHp6XxTql5iCvvaE0HLEY89p08c1qNQ",
    "name": "DAUD-DISNAC",
    "url": "https://docs.google.com/spreadsheets/d/1QRDoHEspNONUKHp6XxTql5iCvvaE0HLEY89p08c1qNQ/edit?usp=drivesdk"
  },
  {
    "id": "1OOuHyN1RaWHX4tGM19fo3Fok6A67NlcBq_dKMYboc3A",
    "name": "HORLLE PAPELAO PARDO",
    "url": "https://docs.google.com/spreadsheets/d/1OOuHyN1RaWHX4tGM19fo3Fok6A67NlcBq_dKMYboc3A/edit?usp=drivesdk"
  },
  {
    "id": "1NeaWMkLkNP0FqwZ-J55GnLz5L5SfFjMaE0LWBxSsFgY",
    "name": "TECNOPLAST  - LONAFORTE",
    "url": "https://docs.google.com/spreadsheets/d/1NeaWMkLkNP0FqwZ-J55GnLz5L5SfFjMaE0LWBxSsFgY/edit?usp=drivesdk"
  },
  {
    "id": "1QGCvINB2vo_dQHTCoXZLuTJBFAmPhJr2iKR41DyFidk",
    "name": "BARIFLEX",
    "url": "https://docs.google.com/spreadsheets/d/1QGCvINB2vo_dQHTCoXZLuTJBFAmPhJr2iKR41DyFidk/edit?usp=drivesdk"
  },
  {
    "id": "1aEovkopomkQHB5N6LjDVlke4LpcvrrQW8gFIiNpL1Ek",
    "name": "VILELA-MANTA ACRILICA",
    "url": "https://docs.google.com/spreadsheets/d/1aEovkopomkQHB5N6LjDVlke4LpcvrrQW8gFIiNpL1Ek/edit?usp=drivesdk"
  },
  {
    "id": "1j6Jt8HvY5a_GMUcnNsajitjLX4YX5Q0N9K4X0W8gtbk",
    "name": "BRASCOLA",
    "url": "https://docs.google.com/spreadsheets/d/1j6Jt8HvY5a_GMUcnNsajitjLX4YX5Q0N9K4X0W8gtbk/edit?usp=drivesdk"
  },
  {
    "id": "16LK_6jtXeYBtJdvDi_8ExaRgxXrO9qLJJSbKbH36ezk",
    "name": "ATCO - BOLHA POP - PLASTBOLHA",
    "url": "https://docs.google.com/spreadsheets/d/16LK_6jtXeYBtJdvDi_8ExaRgxXrO9qLJJSbKbH36ezk/edit?usp=drivesdk"
  },
  {
    "id": "10GCCXJ_ChTtFafJnTYlEs48YSZk5hTZ0Ep7qmiH37Ac",
    "name": "KISAFIX -KILLING",
    "url": "https://docs.google.com/spreadsheets/d/10GCCXJ_ChTtFafJnTYlEs48YSZk5hTZ0Ep7qmiH37Ac/edit?usp=drivesdk"
  },
  {
    "id": "1kfuvTEwlI9uQE1OZf2HfpFdz3Nwu8LF46lt5uOwc-cA",
    "name": "INFINITY",
    "url": "https://docs.google.com/spreadsheets/d/1kfuvTEwlI9uQE1OZf2HfpFdz3Nwu8LF46lt5uOwc-cA/edit?usp=drivesdk"
  },
  {
    "id": "1e_HDbgf7UX3PLHQO64JdXV6bZwjou-7MNHiH0TAuDmY",
    "name": "ADINA",
    "url": "https://docs.google.com/spreadsheets/d/1e_HDbgf7UX3PLHQO64JdXV6bZwjou-7MNHiH0TAuDmY/edit?usp=drivesdk"
  },
  {
    "id": "14MB2RKyO8OLCwPhmuEJaD9CuiVBO_0VJfnvDSVANf9w",
    "name": "CIA CASTANHAL",
    "url": "https://docs.google.com/spreadsheets/d/14MB2RKyO8OLCwPhmuEJaD9CuiVBO_0VJfnvDSVANf9w/edit?usp=drivesdk"
  },
  {
    "id": "1KtgLTEPqbOFmoCBjbFzA1LKiMMjVsBqi1nr8_jGqVfk",
    "name": "PLASTICO BRILHO",
    "url": "https://docs.google.com/spreadsheets/d/1KtgLTEPqbOFmoCBjbFzA1LKiMMjVsBqi1nr8_jGqVfk/edit?usp=drivesdk"
  },
  {
    "id": "13eBS2OuMofkyb9-0ZdtrDRdte7hx60Ab6MjwuDQWfOI",
    "name": "RIOMAR CORDAS",
    "url": "https://docs.google.com/spreadsheets/d/13eBS2OuMofkyb9-0ZdtrDRdte7hx60Ab6MjwuDQWfOI/edit?usp=drivesdk"
  },
  {
    "id": "1n5WeTM-5v3KTRSbKKzCX8YuzfbL0O0Fip6yIq-Q9oTo",
    "name": "STYROFORM - MARCOS C ATUI",
    "url": "https://docs.google.com/spreadsheets/d/1n5WeTM-5v3KTRSbKKzCX8YuzfbL0O0Fip6yIq-Q9oTo/edit?usp=drivesdk"
  },
  {
    "id": "1bEPWPo-Mphg_Ij6LGJSS0Q915Q318VvAfw-thrCeASg",
    "name": "ETHERNA - ETERNITY",
    "url": "https://docs.google.com/spreadsheets/d/1bEPWPo-Mphg_Ij6LGJSS0Q915Q318VvAfw-thrCeASg/edit?usp=drivesdk"
  },
  {
    "id": "1fnVeAhlEJdX28rfhx-8gOyS8ULJxadDJ6FxsbjnxxTQ",
    "name": "BELCHIOR",
    "url": "https://docs.google.com/spreadsheets/d/1fnVeAhlEJdX28rfhx-8gOyS8ULJxadDJ6FxsbjnxxTQ/edit?usp=drivesdk"
  },
  {
    "id": "1dWNzZVIh97N2Q14AAEk7fRNDzrtR9n-1kFC_YVr92zY",
    "name": "RHAMOS BRITO",
    "url": "https://docs.google.com/spreadsheets/d/1dWNzZVIh97N2Q14AAEk7fRNDzrtR9n-1kFC_YVr92zY/edit?usp=drivesdk"
  },
  {
    "id": "13_7JaukGp9bx2Xzpb8vGx-g8k8nIjpEm0148fHI2qMk",
    "name": "CIPATEX",
    "url": "https://docs.google.com/spreadsheets/d/13_7JaukGp9bx2Xzpb8vGx-g8k8nIjpEm0148fHI2qMk/edit?usp=drivesdk"
  },
  {
    "id": "1CgUA69Bg099owf1f4gNiBNdfvM0fBv6M-PpwqNRb0aM",
    "name": "FIBRASCA",
    "url": "https://docs.google.com/spreadsheets/d/1CgUA69Bg099owf1f4gNiBNdfvM0fBv6M-PpwqNRb0aM/edit?usp=drivesdk"
  },
  {
    "id": "1OEPvllkIMswBbMfYpGAgeWcraIXiUE3mqopK8l5iXUA",
    "name": "ALTENBURG",
    "url": "https://docs.google.com/spreadsheets/d/1OEPvllkIMswBbMfYpGAgeWcraIXiUE3mqopK8l5iXUA/edit?usp=drivesdk"
  },
  {
    "id": "1pNGisjSiDjYNv0oq3K-WYYjxn3zHATlaYUiXqaTEhrs",
    "name": "FORT SPUMA",
    "url": "https://docs.google.com/spreadsheets/d/1pNGisjSiDjYNv0oq3K-WYYjxn3zHATlaYUiXqaTEhrs/edit?usp=drivesdk"
  },
  {
    "id": "1n4L8rxuts_dBAhx4AOhOFFf1Z92jdXOG6ibehpoUWnk",
    "name": "VOCÊ RESOLVE - FELTROS TOLFO",
    "url": "https://docs.google.com/spreadsheets/d/1n4L8rxuts_dBAhx4AOhOFFf1Z92jdXOG6ibehpoUWnk/edit?usp=drivesdk"
  },
  {
    "id": "15EgMRAvXUMfQ87Jo-O5iV9MXZz7G6CIEeoy-KWDrhP4",
    "name": "TERUYA",
    "url": "https://docs.google.com/spreadsheets/d/15EgMRAvXUMfQ87Jo-O5iV9MXZz7G6CIEeoy-KWDrhP4/edit?usp=drivesdk"
  },
  {
    "id": "1LFdwuG9uOm0L-uZs3pKON9twRckdezDXLuOqPXS9rsY",
    "name": "METALURGICA GRAM-SERV - ROCAMA",
    "url": "https://docs.google.com/spreadsheets/d/1LFdwuG9uOm0L-uZs3pKON9twRckdezDXLuOqPXS9rsY/edit?usp=drivesdk"
  },
  {
    "id": "126e1GOiKP5uryoSeCeS1IgDnwomMFhcF7vfFsJbx32Q",
    "name": "COLCHONETE HOSPITALAR - ESPUMA EM ROLO",
    "url": "https://docs.google.com/spreadsheets/d/126e1GOiKP5uryoSeCeS1IgDnwomMFhcF7vfFsJbx32Q/edit?usp=drivesdk"
  },
  {
    "id": "1kJpOlf1ylNnfQi-E5_romwLtLzZB7NToZXDh34aY6ok",
    "name": "GRAMPAC-GRAMARC",
    "url": "https://docs.google.com/spreadsheets/d/1kJpOlf1ylNnfQi-E5_romwLtLzZB7NToZXDh34aY6ok/edit?usp=drivesdk"
  },
  {
    "id": "1xjlHB9Mb0Uo6UsHS3L8g2t8ynvhFlPHajCnQWgFAHr8",
    "name": "CORTICEIRA PAULISTA",
    "url": "https://docs.google.com/spreadsheets/d/1xjlHB9Mb0Uo6UsHS3L8g2t8ynvhFlPHajCnQWgFAHr8/edit?usp=drivesdk"
  },
  {
    "id": "1vp-N3vc_xNnWOF-p1tcKFjbhc7IxyPY3Rt373Sr3Qxw",
    "name": "PLASTICO IVONE",
    "url": "https://docs.google.com/spreadsheets/d/1vp-N3vc_xNnWOF-p1tcKFjbhc7IxyPY3Rt373Sr3Qxw/edit?usp=drivesdk"
  },
  {
    "id": "1Wjlb3qIgMqVyGnUvE0gmGMV-zHn2dnoe28dGkKtPw-g",
    "name": "TECNOCAL",
    "url": "https://docs.google.com/spreadsheets/d/1Wjlb3qIgMqVyGnUvE0gmGMV-zHn2dnoe28dGkKtPw-g/edit?usp=drivesdk"
  },
  {
    "id": "155_8gjIb1o9ZlKoDChOlPCnKz6vv8lfs2SS4jmcaqz0",
    "name": "TECNYL",
    "url": "https://docs.google.com/spreadsheets/d/155_8gjIb1o9ZlKoDChOlPCnKz6vv8lfs2SS4jmcaqz0/edit?usp=drivesdk"
  },
  {
    "id": "1it-FsI-Hc3m_ivvgl_BQy2aN2sjz-hZWxPRADjUQzgk",
    "name": "FLEXMAG/NEW IMÃS",
    "url": "https://docs.google.com/spreadsheets/d/1it-FsI-Hc3m_ivvgl_BQy2aN2sjz-hZWxPRADjUQzgk/edit?usp=drivesdk"
  },
  {
    "id": "1z-SNmhHVmdbRefStsHBdQxWjqSzbffhb9AEwewwmAZk",
    "name": "PRALANA",
    "url": "https://docs.google.com/spreadsheets/d/1z-SNmhHVmdbRefStsHBdQxWjqSzbffhb9AEwewwmAZk/edit?usp=drivesdk"
  },
  {
    "id": "1FMZFgLgFSIpJhTM4UTw_XScRc2tlrv7LZ6v8lKOLRko",
    "name": "KAPAZI",
    "url": "https://docs.google.com/spreadsheets/d/1FMZFgLgFSIpJhTM4UTw_XScRc2tlrv7LZ6v8lKOLRko/edit?usp=drivesdk"
  },
  {
    "id": "1V52ZZ-pT0dVuQXPT_Zuj1ODRKGVPbfBQMu3KqCLm1Tc",
    "name": "BAXMANN",
    "url": "https://docs.google.com/spreadsheets/d/1V52ZZ-pT0dVuQXPT_Zuj1ODRKGVPbfBQMu3KqCLm1Tc/edit?usp=drivesdk"
  },
  {
    "id": "1PFTA1-FHwdiH__1OjaRqgGbxwTx0IFGhrO-SdpTVib8",
    "name": "ELASTICOS SÃO JOSÉ",
    "url": "https://docs.google.com/spreadsheets/d/1PFTA1-FHwdiH__1OjaRqgGbxwTx0IFGhrO-SdpTVib8/edit?usp=drivesdk"
  },
  {
    "id": "1wThZKThuK_87brgOk7XfNeA-P571uUsR9s-xPaUs_B4",
    "name": "CIFA",
    "url": "https://docs.google.com/spreadsheets/d/1wThZKThuK_87brgOk7XfNeA-P571uUsR9s-xPaUs_B4/edit?usp=drivesdk"
  },
  {
    "id": "1h2WHGOufvQL0EcxMsUEqFotvfs1YMyNsA2pgLRJUe5M",
    "name": "VONDER",
    "url": "https://docs.google.com/spreadsheets/d/1h2WHGOufvQL0EcxMsUEqFotvfs1YMyNsA2pgLRJUe5M/edit?usp=drivesdk"
  },
  {
    "id": "1xu493hAIGErr_3l6GbGPme9Jsbbff389CVk2XV60ZJc",
    "name": "ZAS TRAS",
    "url": "https://docs.google.com/spreadsheets/d/1xu493hAIGErr_3l6GbGPme9Jsbbff389CVk2XV60ZJc/edit?usp=drivesdk"
  },
  {
    "id": "1tWmRLhKDKWONYXZWKt81_QBx87at7sNLAZu0pKsaAwo",
    "name": "ZDM",
    "url": "https://docs.google.com/spreadsheets/d/1tWmRLhKDKWONYXZWKt81_QBx87at7sNLAZu0pKsaAwo/edit?usp=drivesdk"
  },
  {
    "id": "1SHnjuxSGow0DXODP1DvO7Tyv1Lm7z_n7z2fGvnN0vIk",
    "name": "AZUL PACK",
    "url": "https://docs.google.com/spreadsheets/d/1SHnjuxSGow0DXODP1DvO7Tyv1Lm7z_n7z2fGvnN0vIk/edit?usp=drivesdk"
  },
  {
    "id": "1Ga8LKFuJ8FC7sX2YuzaPzXrKNR199uQUr2NGnIY5EFE",
    "name": "IND TEXTIL BELEM",
    "url": "https://docs.google.com/spreadsheets/d/1Ga8LKFuJ8FC7sX2YuzaPzXrKNR199uQUr2NGnIY5EFE/edit?usp=drivesdk"
  },
  {
    "id": "1PvYuuumWdPQsobgfknx3zlUBi_9LLiq19y6RcWKQ-NA",
    "name": "JET EMBALAGENS",
    "url": "https://docs.google.com/spreadsheets/d/1PvYuuumWdPQsobgfknx3zlUBi_9LLiq19y6RcWKQ-NA/edit?usp=drivesdk"
  },
  {
    "id": "1-2W2WpaREW-sp7pUP3JkNq3FQRTwdeUwgOo56SMnwoY",
    "name": "REIMOLD",
    "url": "https://docs.google.com/spreadsheets/d/1-2W2WpaREW-sp7pUP3JkNq3FQRTwdeUwgOo56SMnwoY/edit?usp=drivesdk"
  },
  {
    "id": "1GDuRNh1Lg5ssqgh1sdAwUdR6FF179M-ObI1NMDB4Sd0",
    "name": "ELISABETH GRAZIANO",
    "url": "https://docs.google.com/spreadsheets/d/1GDuRNh1Lg5ssqgh1sdAwUdR6FF179M-ObI1NMDB4Sd0/edit?usp=drivesdk"
  },
  {
    "id": "1D9JF84FvHm36j02AnuxFS43WRbrfd2dUjQ-eQEFtu3I",
    "name": "FERMACO",
    "url": "https://docs.google.com/spreadsheets/d/1D9JF84FvHm36j02AnuxFS43WRbrfd2dUjQ-eQEFtu3I/edit?usp=drivesdk"
  },
  {
    "id": "1_Jqn1Hcu7wHquaOOezDj-SK6Tw73StfZgkQPQUogyFc",
    "name": "CENTRAL DO ALERGICO - JAMES FROZINO",
    "url": "https://docs.google.com/spreadsheets/d/1_Jqn1Hcu7wHquaOOezDj-SK6Tw73StfZgkQPQUogyFc/edit?usp=drivesdk"
  },
  {
    "id": "1J65faWckekeQMgSfe4H1GsWb_Jsk4h2LFcNjDpeaxGs",
    "name": "LEVI-CAPAS RAVELLE",
    "url": "https://docs.google.com/spreadsheets/d/1J65faWckekeQMgSfe4H1GsWb_Jsk4h2LFcNjDpeaxGs/edit?usp=drivesdk"
  },
  {
    "id": "1hKz-PNtx_p86j9Zo5cuR7oK6uGEUqN7jf0d6kip258o",
    "name": "APAEB",
    "url": "https://docs.google.com/spreadsheets/d/1hKz-PNtx_p86j9Zo5cuR7oK6uGEUqN7jf0d6kip258o/edit?usp=drivesdk"
  },
  {
    "id": "1WsdvLECfE8kUQ-BU67nxOMvrA-8FOdMpurwpmRYd76Q",
    "name": "EDMOND REI DA CUTELARIA",
    "url": "https://docs.google.com/spreadsheets/d/1WsdvLECfE8kUQ-BU67nxOMvrA-8FOdMpurwpmRYd76Q/edit?usp=drivesdk"
  },
  {
    "id": "1EUfnZfp2khgT8Y7slIX-_Klu1SQLFwj2Gz1XQ7ILP14",
    "name": "ORION",
    "url": "https://docs.google.com/spreadsheets/d/1EUfnZfp2khgT8Y7slIX-_Klu1SQLFwj2Gz1XQ7ILP14/edit?usp=drivesdk"
  },
  {
    "id": "1_OJ2P6Z6VV643NIQh48YmRGG0Fgh_wfmnpAWIeBfVUA",
    "name": "FITAS DE VEDACAO - SEALWAY/FZA",
    "url": "https://docs.google.com/spreadsheets/d/1_OJ2P6Z6VV643NIQh48YmRGG0Fgh_wfmnpAWIeBfVUA/edit?usp=drivesdk"
  },
  {
    "id": "1Tikw2QclcyJIVKdC9TvXpRlfq9yUmukJLzfO8TyTFMU",
    "name": "RECIMEC-RODAFORT",
    "url": "https://docs.google.com/spreadsheets/d/1Tikw2QclcyJIVKdC9TvXpRlfq9yUmukJLzfO8TyTFMU/edit?usp=drivesdk"
  },
  {
    "id": "1x4MAQpapIe1JNnQ4o4cl6GuPEP90zsXb96mEioEtCc4",
    "name": "PLASTICO GRETO-CASA KIM",
    "url": "https://docs.google.com/spreadsheets/d/1x4MAQpapIe1JNnQ4o4cl6GuPEP90zsXb96mEioEtCc4/edit?usp=drivesdk"
  },
  {
    "id": "1x1I6aJCqkqUZMHjLLylgP6egj3COjj_OmC0w2XUv00Y",
    "name": "IND FELTRO SANTA FÉ",
    "url": "https://docs.google.com/spreadsheets/d/1x1I6aJCqkqUZMHjLLylgP6egj3COjj_OmC0w2XUv00Y/edit?usp=drivesdk"
  },
  {
    "id": "1gC0n-SJXuZhTbQ-8520aE13jsJjOsm7nVxtRRyL_Qog",
    "name": "CAPATEX",
    "url": "https://docs.google.com/spreadsheets/d/1gC0n-SJXuZhTbQ-8520aE13jsJjOsm7nVxtRRyL_Qog/edit?usp=drivesdk"
  },
  {
    "id": "1NwH6zchB64vCaSpN1DxXNE_DB117L58IrfDkUckF4Gw",
    "name": "ALUMINART - R ANTUNES",
    "url": "https://docs.google.com/spreadsheets/d/1NwH6zchB64vCaSpN1DxXNE_DB117L58IrfDkUckF4Gw/edit?usp=drivesdk"
  },
  {
    "id": "1-BhqnzuRWWmXuT5qQvW96DBwJGkLx9sorRYOaR2UTZs",
    "name": "GMGG-FELTRO MOLETAO",
    "url": "https://docs.google.com/spreadsheets/d/1-BhqnzuRWWmXuT5qQvW96DBwJGkLx9sorRYOaR2UTZs/edit?usp=drivesdk"
  },
  {
    "id": "1MmPBOu8xvH_j2Q-ZnkF2QCF_5fqbxzG3o_Uqob1bfUM",
    "name": "FRIGELAR/TUBOS POLIPEX",
    "url": "https://docs.google.com/spreadsheets/d/1MmPBOu8xvH_j2Q-ZnkF2QCF_5fqbxzG3o_Uqob1bfUM/edit?usp=drivesdk"
  },
  {
    "id": "1yfEdtKF--n9WYmttHBIPbHxtUpOHrJPPRLd1fvHDyvg",
    "name": "FRIGELAR",
    "url": "https://docs.google.com/spreadsheets/d/1yfEdtKF--n9WYmttHBIPbHxtUpOHrJPPRLd1fvHDyvg/edit?usp=drivesdk"
  },
  {
    "id": "19hBQzMOapoxmOFnKbtxf4hO2BjafjZiVrzHwSzLBKas",
    "name": "PERAME",
    "url": "https://docs.google.com/spreadsheets/d/19hBQzMOapoxmOFnKbtxf4hO2BjafjZiVrzHwSzLBKas/edit?usp=drivesdk"
  },
  {
    "id": "1zR0AOBolSdYS5KaqWJmQBMAIUrBvWq1R9hutxwv7I4I",
    "name": "NOVOIL PIRACICABA",
    "url": "https://docs.google.com/spreadsheets/d/1zR0AOBolSdYS5KaqWJmQBMAIUrBvWq1R9hutxwv7I4I/edit?usp=drivesdk"
  }
] as const;

type TrelloList = { id: string; name: string; closed?: boolean };
type TrelloBoard = { lists?: TrelloList[] };
type TrelloCard = { id: string; name: string; closed?: boolean; dueComplete?: boolean };

function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}

async function concludeRotatingStockCard(cardId: string, supplierName: string) {
  const credentials = await getStoredTrelloCredentials();
  if (!credentials) throw new Error("Trello ainda não configurado no Portal.");

  let resolvedCardId = cardId.trim();
  if (!resolvedCardId) {
    const board = await trelloFetch<TrelloBoard>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
      credentials,
      params: { fields: "name", lists: "open", list_fields: "name,closed" },
    });
    const target = (board.lists || []).find(
      (list) => !list.closed && hasAllTokens(list.name, ["estoque", "rotativo", "lucas", "carol"]),
    );
    if (!target) throw new Error("Lista ESTOQUE ROTATIVO LUCAS/CAROL não encontrada no Trello.");
    const cards = await trelloFetch<TrelloCard[]>(`/lists/${target.id}/cards`, {
      credentials,
      params: { fields: "name,closed,dueComplete", filter: "all" },
    });
    const normalizedName = normalizeTrelloText(supplierName);
    resolvedCardId = cards.find((card) => normalizeTrelloText(card.name) === normalizedName)?.id || "";
  }
  if (!resolvedCardId) throw new Error(`Card do Trello não encontrado para ${supplierName}.`);

  await trelloFetch<TrelloCard>(`/cards/${encodeURIComponent(resolvedCardId)}`, {
    method: "PUT",
    credentials,
    params: { dueComplete: true, closed: false },
  });
}

function extractSpreadsheetId(value: string) {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(value.trim()) ? value.trim() : "";
}

function cleanCode(value: unknown) {
  return String(value ?? "").trim();
}

function integerStock(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  const normalized = text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label}: estoque inválido.`);
  const integer = Math.trunc(number);
  if (!Number.isSafeInteger(integer)) throw new Error(`${label}: estoque fora do limite aceito.`);
  return integer;
}

function nullableStock(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  return text === "" ? null : integerStock(value, label);
}

function fingerprint(sourceRows: unknown[][], targetRows: unknown[][]) {
  return createHash("sha256").update(JSON.stringify({ sourceRows, targetRows })).digest("hex");
}

async function context() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !hasModuleAccess(email, "estoque-rotativo", session?.portalUser)) throw new Error("Acesso não autorizado ao Estoque Rotativo.");
  if (!session?.accessToken || session.error === "RefreshAccessTokenError") throw new Error("Sessão expirada. Saia e entre novamente no Portal.");
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: session.accessToken });
  return {
    email,
    sheets: google.sheets({ version: "v4", auth: oauth }),
  };
}

function requireRole(email: string, role: "report" | "conference" | "manage") {
  const manager = MANAGEMENT_EMAILS.has(email);
  if (role === "report" && (manager || email === ROTATING_STOCK_EMAILS.lucas)) return;
  if (role === "conference" && (manager || email === ROTATING_STOCK_EMAILS.carolina)) return;
  if (role === "manage" && manager) return;
  throw new Error("Seu acesso não permite esta ação.");
}

function columnIndex(letter: string) {
  const normalized = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) throw new Error(`Coluna inválida: ${letter}.`);
  let index = 0;
  for (const char of normalized) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

function columnLetter(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function readComparedRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  startRow: number,
  maxSourceColumn: number,
) {
  const [source, target] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A${startRow}:${columnLetter(maxSourceColumn)}`,
      valueRenderOption: "FORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
      range: `${ROTATING_STOCK_CENTRAL.sheetName}!${ROTATING_STOCK_CENTRAL.range}`,
      valueRenderOption: "FORMATTED_VALUE",
    }),
  ]);
  return {
    sourceRows: (source.data.values || []) as unknown[][],
    targetRows: (target.data.values || []) as unknown[][],
  };
}

function normalizeMatch(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function normalizeHeader(value: unknown) {
  return normalizeMatch(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_ALIASES = {
  saleCode: ["cod venda", "codigo venda", "codvenda", "codigo de venda"],
  genericCode: ["codigo", "cod", "cod produto", "codigo produto", "referencia", "ref", "sku"],
  purchaseCode: ["cod compra", "codigo compra", "codcompra", "codigo de compra", "cod fornecedor", "codigo fornecedor", "cod forn"],
  description: ["descricao", "produto", "nome produto", "item produto", "mercadoria"],
  min: ["min", "minimo", "estoque min", "estoque minimo", "est min"],
  max: ["max", "maximo", "estoque max", "estoque maximo", "est max"],
  stock: ["estoque", "quantidade", "qtd", "saldo", "disponivel", "estoque atual", "saldo estoque"],
  itemNumber: ["item", "n", "numero", "num", "0"],
};

function detectHeaderColumn(row: SheetValue[], aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  const matches: number[] = [];
  row.forEach((cell, index) => {
    if (normalizedAliases.has(normalizeHeader(cell))) matches.push(index);
  });
  return matches.length === 1 ? matches[0] : null;
}

type SheetValue = string | number | boolean | null | undefined;

type SupplierSheetDetection = {
  headerRow: number;
  saleCodeColumn: number | null;
  purchaseCodeColumn: number | null;
  descriptionColumn: number | null;
  minColumn: number | null;
  maxColumn: number | null;
  stockColumn: number | null;
  itemNumberColumn: number | null;
  score: number;
};

function analyzeSheetGrid(values: SheetValue[][]): SupplierSheetDetection | null {
  let best: SupplierSheetDetection | null = null;

  for (let index = 0; index < Math.min(values.length, 25); index += 1) {
    const row = values[index] || [];
    const explicitSale = detectHeaderColumn(row, HEADER_ALIASES.saleCode);
    const genericSale = detectHeaderColumn(row, HEADER_ALIASES.genericCode);
    const saleCodeColumn = explicitSale ?? genericSale;
    const purchaseCodeColumn = detectHeaderColumn(row, HEADER_ALIASES.purchaseCode);
    const descriptionColumn = detectHeaderColumn(row, HEADER_ALIASES.description);
    const minColumn = detectHeaderColumn(row, HEADER_ALIASES.min);
    const maxColumn = detectHeaderColumn(row, HEADER_ALIASES.max);
    const stockColumn = detectHeaderColumn(row, HEADER_ALIASES.stock);
    const itemNumberColumn = detectHeaderColumn(row, HEADER_ALIASES.itemNumber);
    const required = [saleCodeColumn, descriptionColumn, stockColumn].filter((value) => value !== null).length;
    const optional = [purchaseCodeColumn, minColumn, maxColumn, itemNumberColumn].filter((value) => value !== null).length;
    const score = required * 10 + optional;
    if (!best || score > best.score) {
      best = {
        headerRow: index + 1,
        saleCodeColumn,
        purchaseCodeColumn,
        descriptionColumn,
        minColumn,
        maxColumn,
        stockColumn,
        itemNumberColumn,
        score,
      };
    }
  }
  return best;
}

function normalizeHistoryHeader(value: SheetValue) {
  if (typeof value === "number" && Number.isFinite(value) && value > 20000) {
    const milliseconds = Math.round((value - 25569) * 86400 * 1000);
    const date = new Date(milliseconds);
    if (!Number.isNaN(date.getTime())) {
      return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCFullYear()).slice(-2)}`;
    }
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(text)) return text;
  const months: Record<string, string> = {
    jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
    jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  };
  const normalized = normalizeMatch(text).replace(/\s+/g, "");
  const match = normalized.match(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[\/.-]?([0-9]{2,4})(.*)$/);
  if (!match) return text;
  const year = match[2].slice(-2);
  const suffix = match[3].replace(/^[-_/]+/, "").trim();
  return `${months[match[1]]}/${year}${suffix ? ` ${suffix.toUpperCase()}` : ""}`;
}

function appendPreservedValue(row: SheetValue[], value: SheetValue, startAt = 5) {
  if (value === "" || value === null || value === undefined) return;
  let index = startAt;
  while (row[index] !== undefined && row[index] !== "") index += 1;
  row[index] = value;
}

async function standardizeSupplierSpreadsheet(
  sheets: sheets_v4.Sheets,
  file: { id: string; name: string; url: string },
) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: file.id,
    fields: "sheets.properties(title,index,sheetId,gridProperties),sheets.merges,sheets.conditionalFormats",
  });
  const candidates = (metadata.data.sheets || [])
    .sort((a, b) => (a.properties?.index || 0) - (b.properties?.index || 0))
    .filter((sheet) => sheet.properties?.title && sheet.properties?.sheetId !== undefined)
    .filter((sheet) => !normalizeHeader(sheet.properties!.title!).includes("bkp"));
  if (!candidates.length) throw new Error(`${file.name}: nenhuma aba principal disponível para padronização.`);

  let selected: {
    title: string;
    sheetId: number;
    rowCount: number;
    columnCount: number;
    detection: SupplierSheetDetection;
    formulas: SheetValue[][];
    formatted: SheetValue[][];
    merges: sheets_v4.Schema$GridRange[];
    conditionalFormatCount: number;
  } | null = null;

  for (const sheet of candidates.slice(0, 8)) {
    const title = sheet.properties!.title!;
    const rowCount = Math.max(1, sheet.properties?.gridProperties?.rowCount || 1000);
    const columnCount = Math.max(5, sheet.properties?.gridProperties?.columnCount || 26);
    const preview = await sheets.spreadsheets.values.get({
      spreadsheetId: file.id,
      range: `'${title.replace(/'/g, "''")}'!A1:${columnLetter(Math.min(columnCount - 1, 51))}25`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const detection = analyzeSheetGrid((preview.data.values || []) as unknown as SheetValue[][]);
    if (!detection || detection.saleCodeColumn === null || detection.descriptionColumn === null || detection.stockColumn === null) continue;

    const lastColumn = columnLetter(columnCount - 1);
    const [formulaResponse, formattedResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: file.id,
        range: `'${title.replace(/'/g, "''")}'!A1:${lastColumn}${rowCount}`,
        valueRenderOption: "FORMULA",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: file.id,
        range: `'${title.replace(/'/g, "''")}'!A1:${lastColumn}${rowCount}`,
        valueRenderOption: "FORMATTED_VALUE",
      }),
    ]);
    selected = {
      title,
      sheetId: sheet.properties!.sheetId!,
      rowCount,
      columnCount,
      detection,
      formulas: (formulaResponse.data.values || []) as unknown as SheetValue[][],
      formatted: (formattedResponse.data.values || []) as unknown as SheetValue[][],
      merges: sheet.merges || [],
      conditionalFormatCount: sheet.conditionalFormats?.length || 0,
    };
    break;
  }

  if (!selected) throw new Error(`${file.name}: não foi possível identificar Código, Produto e Estoque com segurança.`);

  const { detection, formulas, formatted } = selected;
  const headerIndex = detection.headerRow - 1;
  const sourceHeader = formulas[headerIndex] || [];
  const excluded = new Set<number>([
    detection.saleCodeColumn!,
    detection.descriptionColumn!,
    detection.stockColumn!,
  ]);
  for (const optional of [detection.purchaseCodeColumn, detection.minColumn, detection.maxColumn, detection.itemNumberColumn]) {
    if (optional !== null) excluded.add(optional);
  }

  const extraColumns: number[] = [];
  const maxSourceWidth = Math.max(
    sourceHeader.length,
    ...formulas.slice(headerIndex + 1).map((row) => row.length),
    5,
  );
  for (let column = 0; column < maxSourceWidth; column += 1) {
    if (excluded.has(column)) continue;
    const headerValue = sourceHeader[column];
    const hasData = formulas.slice(headerIndex + 1).some((row) => row[column] !== undefined && row[column] !== "");
    if (headerValue !== undefined && headerValue !== "" || hasData) extraColumns.push(column);
  }

  let lastDataIndex = headerIndex;
  for (let rowIndex = headerIndex + 1; rowIndex < formulas.length; rowIndex += 1) {
    const row = formulas[rowIndex] || [];
    const keyValues = [
      row[detection.saleCodeColumn!],
      detection.purchaseCodeColumn === null ? "" : row[detection.purchaseCodeColumn],
      row[detection.descriptionColumn!],
      row[detection.stockColumn!],
    ];
    if (keyValues.some((value) => value !== undefined && value !== "")) lastDataIndex = rowIndex;
  }
  if (lastDataIndex <= headerIndex) throw new Error(`${file.name}: nenhum produto encontrado abaixo do cabeçalho.`);

  const topRows: SheetValue[][] = [[], [], [], []];
  const metadataRows = formulas.slice(0, headerIndex);
  for (let index = 0; index < Math.min(4, metadataRows.length); index += 1) {
    topRows[index] = [...(metadataRows[index] || [])];
  }
  if (metadataRows.length > 4) {
    for (const extraRow of metadataRows.slice(4)) {
      for (const value of extraRow || []) appendPreservedValue(topRows[3], value, 5);
    }
  }

  const standardizedAt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const preservedRotatingStockUpdated = formulas[1]?.[2] ?? "";
  const preservedManualDate = formulas[3]?.[4] ?? "";

  topRows[0][0] = "Fornecedor 1:";
  topRows[0][1] = file.name;
  topRows[0][2] = `Padronizada em ${standardizedAt}`;
  topRows[1] = [];
  topRows[1][2] = preservedRotatingStockUpdated;

  topRows[2][4] = "LUCAS";
  topRows[3] = [];
  topRows[3][4] = preservedManualDate;

  const standardizedHeaders = [
    "COD-VENDA",
    "COD-COMPRA",
    "DESCRIÇÃO",
    "MÍNIMO",
    "ESTOQUE",
    ...extraColumns.map((column) => normalizeHistoryHeader(sourceHeader[column])),
  ];

  const productRows: SheetValue[][] = [];
  for (let rowIndex = headerIndex + 1; rowIndex <= lastDataIndex; rowIndex += 1) {
    const formulaRow = formulas[rowIndex] || [];
    const formattedRow = formatted[rowIndex] || [];
    const saleValue = formattedRow[detection.saleCodeColumn!] ?? formulaRow[detection.saleCodeColumn!] ?? "";
    const purchaseValue = detection.purchaseCodeColumn === null
      ? ""
      : (formattedRow[detection.purchaseCodeColumn] ?? formulaRow[detection.purchaseCodeColumn] ?? "");
    const description = formattedRow[detection.descriptionColumn!] ?? formulaRow[detection.descriptionColumn!] ?? "";
    const minValue = detection.minColumn === null ? "" : (formulaRow[detection.minColumn] ?? "");
    const stockValue = formulaRow[detection.stockColumn!] ?? "";
    if ([saleValue, purchaseValue, description, stockValue].every((value) => value === "" || value === undefined || value === null)) continue;
    productRows.push([
      String(saleValue ?? "").trim(),
      String(purchaseValue ?? "").trim(),
      description,
      minValue,
      stockValue,
      ...extraColumns.map((column) => formulaRow[column] ?? ""),
    ]);
  }

  productRows.sort((left, right) =>
    String(left[2] ?? "").localeCompare(String(right[2] ?? ""), "pt-BR", { sensitivity: "base", numeric: true }),
  );

  const output = [...topRows, standardizedHeaders, ...productRows];
  const outputWidth = Math.max(...output.map((row) => row.length), 5);
  for (const row of output) while (row.length < outputWidth) row.push("");
  const lastProductRow = 5 + productRows.length;
  for (let column = 5; column < outputWidth; column += 1) {
    output[3][column] = `=COUNTA(${columnLetter(column)}6:${columnLetter(column)}${lastProductRow})`;
  }

  const quotedTitle = `'${selected.title.replace(/'/g, "''")}'`;
  const clearLastColumn = columnLetter(Math.max(selected.columnCount - 1, outputWidth - 1));
  await sheets.spreadsheets.values.clear({
    spreadsheetId: file.id,
    range: `${quotedTitle}!A1:${clearLastColumn}${selected.rowCount}`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: file.id,
    range: `${quotedTitle}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: output.map((row) => row.map((value) => value ?? "")) },
  });

  const black = { red: 0, green: 0, blue: 0 };
  const white = { red: 1, green: 1, blue: 1 };
  const blue = { red: 0.075, green: 0.012, blue: 0.553 };
  const orangeLight2 = { red: 0.988, green: 0.91, blue: 0.698 };
  const formattingRequests: sheets_v4.Schema$Request[] = [];

  for (const merge of selected.merges) formattingRequests.push({ unmergeCells: { range: merge } });
  for (let index = selected.conditionalFormatCount - 1; index >= 0; index -= 1) {
    formattingRequests.push({ deleteConditionalFormatRule: { sheetId: selected.sheetId, index } });
  }

  formattingRequests.push(
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 0, endRowIndex: output.length, startColumnIndex: 0, endColumnIndex: outputWidth },
        cell: { userEnteredFormat: { textFormat: { fontFamily: "Calibri", fontSize: 11 } } },
        fields: "userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: {
          backgroundColor: white,
          textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true, foregroundColor: black },
          horizontalAlignment: "LEFT",
          verticalAlignment: "MIDDLE",
        } },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: {
          backgroundColor: white,
          textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true, foregroundColor: { red: 0.831, green: 0.047, blue: 0.051 } },
          horizontalAlignment: "LEFT",
          verticalAlignment: "MIDDLE",
        } },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.82, green: 0.9, blue: 1 },
          textFormat: { fontFamily: "Calibri", fontSize: 12, bold: false, foregroundColor: black },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        } },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.82, green: 0.95, blue: 0.84 },
          textFormat: { fontFamily: "Calibri", fontSize: 12, bold: false, foregroundColor: black },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        } },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: outputWidth },
        cell: { userEnteredFormat: {
          backgroundColor: blue,
          textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true, foregroundColor: white },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        } },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 4, endRowIndex: output.length, startColumnIndex: 0, endColumnIndex: 2 },
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 4, endRowIndex: output.length, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: { horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 4, endRowIndex: output.length, startColumnIndex: 3, endColumnIndex: outputWidth },
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } },
        fields: "userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          textFormat: { fontFamily: "Calibri", fontSize: 12, bold: true, foregroundColor: { red: 0.831, green: 0.047, blue: 0.051 } },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        } },
        fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: black },
          numberFormat: { type: "DATE", pattern: "dd/mm/yy" },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
        } },
        fields: "userEnteredFormat(textFormat,numberFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 5, endRowIndex: output.length, startColumnIndex: 0, endColumnIndex: outputWidth },
        cell: { userEnteredFormat: {
          textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black },
        } },
        fields: "userEnteredFormat.textFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: selected.sheetId, startRowIndex: 5, endRowIndex: output.length, startColumnIndex: 0, endColumnIndex: 2 },
        cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId: selected.sheetId, gridProperties: { frozenRowCount: 5 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: selected.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 2 },
        properties: { pixelSize: 100 },
        fields: "pixelSize",
      },
    },
    {
      autoResizeDimensions: {
        dimensions: { sheetId: selected.sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 },
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: selected.sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: Math.max(selected.columnCount, outputWidth) },
        properties: { pixelSize: 75 },
        fields: "pixelSize",
      },
    },
  );

  const historyEndColumn = Math.max(selected.columnCount, outputWidth);
  if (historyEndColumn > 5) {
    formattingRequests.push(
      {
        repeatCell: {
          range: { sheetId: selected.sheetId, startRowIndex: 5, endRowIndex: selected.rowCount, startColumnIndex: 5, endColumnIndex: historyEndColumn },
          cell: { userEnteredFormat: { backgroundColor: white } },
          fields: "userEnteredFormat.backgroundColor",
        },
      },
      {
        addConditionalFormatRule: {
          index: 0,
          rule: {
            ranges: [{ sheetId: selected.sheetId, startRowIndex: 5, endRowIndex: selected.rowCount, startColumnIndex: 5, endColumnIndex: historyEndColumn }],
            booleanRule: { condition: { type: "NOT_BLANK" }, format: { backgroundColor: orangeLight2 } },
          },
        },
      },
    );
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: file.id,
    requestBody: { requests: formattingRequests },
  });

  return {
    spreadsheetId: file.id,
    supplierName: file.name,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${file.id}/edit#gid=${selected.sheetId}&range=A1`,
    sheetName: selected.title,
    products: productRows.length,
  };
}

async function markSupplierRotatingStockUpdated(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = metadata.data.sheets?.find((item) => item.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return;

  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  }).format(new Date());

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName.replace(/'/g, "''")}'!C2`,
    valueInputOption: "RAW",
    requestBody: { values: [[`Estoque Rotativo atualizado em ${date}`]] },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: 3 },
          cell: { userEnteredFormat: {
            backgroundColor: { red: 0.82, green: 0.95, blue: 0.84 },
            textFormat: {
              fontFamily: "Calibri",
              fontSize: 12,
              bold: false,
              foregroundColor: { red: 0, green: 0, blue: 0 },
            },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          } },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      }],
    },
  });
}

async function clearSupplierReviewHighlight(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title),conditionalFormats)",
  });
  const sheet = metadata.data.sheets?.find((item) => item.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return;

  const rules = sheet?.conditionalFormats || [];
  const reviewIndex = rules.findIndex((rule) => {
    const condition = rule.booleanRule?.condition;
    const color = rule.booleanRule?.format?.backgroundColor;
    const formula = condition?.values?.[0]?.userEnteredValue;
    return condition?.type === "CUSTOM_FORMULA"
      && formula === "=TRUE"
      && Boolean(color)
      && Number(color?.red || 0) > 0.99
      && Number(color?.green || 0) > 0.93
      && Number(color?.blue || 0) > 0.75;
  });
  if (reviewIndex < 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ deleteConditionalFormatRule: { sheetId, index: reviewIndex } }],
    },
  });
}

function buildComparison(
  sourceRows: unknown[][],
  targetRows: unknown[][],
  startRow: number,
  codeColumn: number,
  purchaseCodeColumn: number | null,
  descriptionColumn: number,
  stockColumn: number,
  codeLinks: Map<string, string>,
) {
  const targetByCode = new Map<string, { row: number; code: string; description: string; stock: number | null }>();
  const targetByDescription = new Map<string, { row: number; code: string; description: string; stock: number | null }>();
  const duplicateDescriptions = new Set<string>();

  for (let index = 0; index < targetRows.length; index += 1) {
    const code = cleanCode(targetRows[index]?.[0]);
    const descriptionText = String(targetRows[index]?.[1] ?? "").trim();
    const description = normalizeMatch(descriptionText);
    if (!code && !description) continue;
    const target = {
      row: index + 2,
      code,
      description: descriptionText,
      stock: nullableStock(targetRows[index]?.[2], `Base central, linha ${index + 2}`),
    };
    if (code) targetByCode.set(code, target);
    if (description) {
      if (targetByDescription.has(description)) duplicateDescriptions.add(description);
      else targetByDescription.set(description, target);
    }
  }
  for (const description of duplicateDescriptions) targetByDescription.delete(description);

  const sourceCodes = new Set<string>();
  const items: Omit<RotatingStockItem, "id" | "update_id" | "applied">[] = [];
  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = sourceRows[index] || [];
    const sourceSaleCode = cleanCode(row[codeColumn]);
    const purchaseCode = purchaseCodeColumn === null ? "" : cleanCode(row[purchaseCodeColumn]);
    const description = String(row[descriptionColumn] ?? "").trim();
    const stockValue = row[stockColumn];
    if (!sourceSaleCode && !purchaseCode && !description && String(stockValue ?? "").trim() === "") continue;
    if (!sourceSaleCode && !description) throw new Error(`Linha ${startRow + index}: COD-VENDA e descrição vazios.`);
    if (sourceSaleCode && sourceCodes.has(sourceSaleCode)) throw new Error(`COD-VENDA duplicado na planilha do fornecedor: ${sourceSaleCode}.`);
    if (sourceSaleCode) sourceCodes.add(sourceSaleCode);

    const newStock = integerStock(stockValue, `Linha ${startRow + index}, COD-VENDA ${sourceSaleCode || "vazio"}`);
    const direct = sourceSaleCode ? targetByCode.get(sourceSaleCode) : undefined;

    if (direct) {
      const situation = direct.stock !== null && direct.stock === newStock ? "sem_alteracao" : "encontrado";
      items.push({
        source_row: startRow + index,
        target_row: direct.row,
        code: sourceSaleCode,
        source_sale_code: sourceSaleCode,
        purchase_code: purchaseCode,
        suggested_code: "",
        suggestion_reason: "",
        description,
        old_stock: direct.stock,
        new_stock: newStock,
        situation,
      });
      continue;
    }

    let suggestion: { row: number; code: string; description: string; stock: number | null } | undefined;
    let suggestionReason = "";
    const mappedSaleCode = purchaseCode ? codeLinks.get(purchaseCode) : undefined;
    if (mappedSaleCode) {
      suggestion = targetByCode.get(mappedSaleCode);
      if (suggestion) suggestionReason = "Vínculo já confirmado entre COD-COMPRA e COD-VENDA.";
    }
    if (!suggestion && purchaseCode) {
      const purchaseAsSale = targetByCode.get(purchaseCode);
      if (purchaseAsSale) {
        suggestion = purchaseAsSale;
        suggestionReason = "COD-COMPRA coincide com um COD-VENDA da base central.";
      }
    }
    if (!suggestion && description) {
      const descriptionMatch = targetByDescription.get(normalizeMatch(description));
      if (descriptionMatch) {
        suggestion = descriptionMatch;
        suggestionReason = "Descrição coincide com um único item da base central.";
      }
    }

    items.push({
      source_row: startRow + index,
      target_row: suggestion?.row ?? null,
      code: sourceSaleCode,
      source_sale_code: sourceSaleCode,
      purchase_code: purchaseCode,
      suggested_code: suggestion?.code ?? "",
      suggestion_reason: suggestionReason,
      description,
      old_stock: suggestion?.stock ?? null,
      new_stock: newStock,
      situation: "nao_encontrado",
    });
  }
  if (!items.length) throw new Error("A planilha não possui itens válidos a partir da linha informada.");
  return items;
}

async function centralSheetId(sheets: sheets_v4.Sheets) {
  const response = await sheets.spreadsheets.get({ spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId, fields: "sheets.properties" });
  const sheet = response.data.sheets?.find((item) => item.properties?.title === ROTATING_STOCK_CENTRAL.sheetName);
  if (sheet?.properties?.sheetId === undefined || sheet.properties.sheetId === null) throw new Error("Aba Produtos não encontrada na planilha central.");
  return sheet.properties.sheetId;
}

function rotatingStockFilterTitle(updateId: string, supplierName: string) {
  const shortId = updateId.replace(/-/g, "").slice(0, 8);
  const cleanSupplier = supplierName.replace(/[\r\n]+/g, " ").trim().slice(0, 45);
  return `Rotativo · ${cleanSupplier || "Atualização"} · ${shortId}`;
}

async function ensureRotatingStockFilterView(
  sheets: sheets_v4.Sheets,
  updateId: string,
  supplierName: string,
  targetRows: number[],
) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    fields: "sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),filterViews(filterViewId,title))",
  });
  const sheet = metadata.data.sheets?.find((item) => item.properties?.title === ROTATING_STOCK_CENTRAL.sheetName);
  const sheetId = sheet?.properties?.sheetId;
  const rowCount = sheet?.properties?.gridProperties?.rowCount || 6401;
  const columnCount = Math.min(sheet?.properties?.gridProperties?.columnCount || 5, 5);
  if (sheetId === undefined || sheetId === null) throw new Error("Aba Produtos não encontrada na planilha central.");

  const title = rotatingStockFilterTitle(updateId, supplierName);
  const existing = sheet?.filterViews?.find((filterView) => filterView.title === title);
  if (existing?.filterViewId) return existing.filterViewId;

  const selectedRows = new Set(targetRows.filter((row) => Number.isInteger(row) && row >= 2 && row <= rowCount));
  if (!selectedRows.size) throw new Error("Esta atualização não possui itens encontrados na planilha central.");

  const valuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    range: `${ROTATING_STOCK_CENTRAL.sheetName}!B2:C${rowCount}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (valuesResponse.data.values || []) as unknown[][];

  function filterSpec(valueOffset: number, sheetColumnIndex: number) {
    const selectedValues = new Set<string>();
    const occurrences = new Map<string, number[]>();

    for (let index = 0; index < values.length; index += 1) {
      const rowNumber = index + 2;
      const value = String(values[index]?.[valueOffset] ?? "").trim();
      const list = occurrences.get(value) || [];
      list.push(rowNumber);
      occurrences.set(value, list);
      if (selectedRows.has(rowNumber)) {
        if (!value) return null;
        selectedValues.add(value);
      }
    }

    for (const value of selectedValues) {
      const rows = occurrences.get(value) || [];
      if (rows.some((row) => !selectedRows.has(row))) return null;
    }

    const hiddenValues = new Set<string>();
    for (let index = 0; index < values.length; index += 1) {
      const rowNumber = index + 2;
      if (selectedRows.has(rowNumber)) continue;
      const value = String(values[index]?.[valueOffset] ?? "").trim();
      if (!selectedValues.has(value)) hiddenValues.add(value);
    }

    return {
      columnIndex: sheetColumnIndex,
      filterCriteria: { hiddenValues: Array.from(hiddenValues) },
    };
  }

  const spec = filterSpec(0, 1) || filterSpec(1, 2);
  if (!spec) throw new Error("Não foi possível criar um filtro exato para esta atualização.");

  const created = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    requestBody: {
      requests: [{
        addFilterView: {
          filter: {
            title,
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: rowCount,
              startColumnIndex: 0,
              endColumnIndex: columnCount,
            },
            filterSpecs: [spec],
          },
        },
      }],
    },
  });

  const filterViewId = created.data.replies?.[0]?.addFilterView?.filter?.filterViewId;
  if (!filterViewId) throw new Error("O filtro da atualização não foi criado.");
  return filterViewId;
}

async function ensurePendingStatuses(sheets: sheets_v4.Sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    range: `${ROTATING_STOCK_CENTRAL.sheetName}!A2:B`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (response.data.values || []) as unknown[][];
  const data: Array<{ range: string; values: string[][] }> = [];
  const validUpdated = /^atualizado em \d{2}\/\d{2}\/(?:\d{2}|\d{4})$/i;

  for (let index = 0; index < rows.length; index += 1) {
    const status = String(rows[index]?.[0] ?? "").trim();
    const code = String(rows[index]?.[1] ?? "").trim();
    if (!code) continue;
    if (status.toLocaleLowerCase("pt-BR") === "pendente" || validUpdated.test(status)) continue;
    data.push({
      range: `${ROTATING_STOCK_CENTRAL.sheetName}!A${index + 2}`,
      values: [["Pendente"]],
    });
  }

  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
  }
}

function rotatingStockStatusDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

async function clearExpiredHighlights(sheets: sheets_v4.Sheets) {
  const expired = await listExpiredHighlights();
  if (!expired.length) return;
  const sheetId = await centralSheetId(sheets);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    requestBody: {
      requests: expired.map((item) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: item.target_row - 1, endRowIndex: item.target_row, startColumnIndex: 3, endColumnIndex: 4 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.812, green: 0.886, blue: 0.953 } } },
          fields: "userEnteredFormat.backgroundColor",
        },
      })),
    },
  });
  await markHighlightsCleared(expired.map((item) => item.id));
}

function apiError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const permission = /insufficient|permission|forbidden|403/i.test(raw);
  const unauthorized = /não autorizado|não permite/i.test(raw);
  const message = permission ? "Sem acesso à planilha. Confirme o compartilhamento e entre novamente no Portal." : raw;
  return NextResponse.json({ ok: false, error: message }, { status: unauthorized || permission ? 403 : 400 });
}

export async function GET(request: Request) {
  try {
    const { email, sheets } = await context();
    await clearExpiredHighlights(sheets);
    const searchParams = new URL(request.url).searchParams;
    const openUpdateId = searchParams.get("openUpdateId")?.trim() || "";
    if (openUpdateId) {
      const update = await getRotatingStockUpdate(openUpdateId);
      if (!update || update.status !== "atualizado") throw new Error("Atualização concluída não encontrada.");
      const items = await listConferenceItems(openUpdateId);
      const targetRows = items
        .filter((item) => item.situation !== "nao_encontrado" && item.target_row)
        .map((item) => item.target_row!)
        .filter((row, index, rows) => rows.indexOf(row) === index)
        .sort((a, b) => a - b);
      const filterViewId = await ensureRotatingStockFilterView(sheets, openUpdateId, update.supplier_name, targetRows);
      const url = `https://docs.google.com/spreadsheets/d/${ROTATING_STOCK_CENTRAL.spreadsheetId}/edit#gid=${await centralSheetId(sheets)}&fvid=${filterViewId}`;
      return NextResponse.redirect(url);
    }
    const spreadsheetReference = searchParams.get("spreadsheetReference")?.trim() || "";
    if (spreadsheetReference) {
      const spreadsheetId = extractSpreadsheetId(spreadsheetReference);
      if (!spreadsheetId) throw new Error("Link da planilha inválido.");
      const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
      const sheetNames = (metadata.data.sheets || []).map((item) => item.properties?.title).filter((title): title is string => Boolean(title));
      return NextResponse.json({ ok: true, sheetNames, singleSheetName: sheetNames.length === 1 ? sheetNames[0] : null }, { headers: { "Cache-Control": "no-store" } });
    }
    const id = searchParams.get("id");
    const data = await listRotatingStockData();
    const supplierFiles = [...SUPPLIER_SPREADSHEETS]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true }));
    return NextResponse.json({
      ok: true,
      ...data,
      supplierFiles,
      items: id ? await listConferenceItems(id) : [],
      currentUpdate: id ? await getRotatingStockUpdate(id) : null,
      permissions: {
        canReport: MANAGEMENT_EMAILS.has(email) || email === ROTATING_STOCK_EMAILS.lucas,
        canConference: MANAGEMENT_EMAILS.has(email) || email === ROTATING_STOCK_EMAILS.carolina,
        canManage: MANAGEMENT_EMAILS.has(email),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { email, sheets } = await context();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "padronizar_proxima_planilha") {
      requireRole(email, "manage");
      const snapshot = await listRotatingStockData();
      const requestedSpreadsheetId = String(body.spreadsheetId || "").trim();
      const prepared = snapshot.supplierStandardizations.find(
        (item) => item.status === "preparada" && (!requestedSpreadsheetId || item.spreadsheet_id === requestedSpreadsheetId),
      );
      // Sem seleção explícita, mantém o fluxo atual e reabre a planilha já preparada.
      // Com fornecedor selecionado, executa novamente a padronização sobre a própria aba principal.
      if (prepared && !requestedSpreadsheetId) {
        return NextResponse.json({
          ok: true,
          awaitingReview: true,
          spreadsheetId: prepared.spreadsheet_id,
          supplierName: prepared.supplier_name,
          spreadsheetUrl: prepared.spreadsheet_url,
          sheetName: prepared.sheet_name,
        });
      }
      const updatedIds = new Set(
        snapshot.supplierStandardizations
          .filter((item) => item.status === "atualizada")
          .map((item) => item.spreadsheet_id),
      );
      const pendingFiles = [...SUPPLIER_SPREADSHEETS]
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true }))
        .filter((item) => !updatedIds.has(item.id));
      const next = requestedSpreadsheetId
        ? pendingFiles.find((item) => item.id === requestedSpreadsheetId)
        : pendingFiles[0];
      if (requestedSpreadsheetId && !next) throw new Error("Fornecedor selecionado não está pendente de padronização.");
      if (!next) return NextResponse.json({ ok: true, complete: true });

      const standardized = await standardizeSupplierSpreadsheet(sheets, next);
      await prepareSupplierStandardization({
        spreadsheetId: standardized.spreadsheetId,
        supplierName: standardized.supplierName,
        spreadsheetUrl: standardized.spreadsheetUrl,
        sheetName: standardized.sheetName,
        actor: email,
      });
      return NextResponse.json({ ok: true, awaitingReview: true, ...standardized });
    }

    if (action === "confirmar_planilha_fornecedor") {
      requireRole(email, "manage");
      const spreadsheetId = String(body.spreadsheetId || "").trim();
      if (!spreadsheetId) throw new Error("Planilha não identificada.");
      const snapshot = await listRotatingStockData();
      const prepared = snapshot.supplierStandardizations.find(
        (item) => item.spreadsheet_id === spreadsheetId && item.status === "preparada",
      );
      if (!prepared) throw new Error("Esta planilha não está aguardando conferência.");
      if (!(await confirmSupplierStandardization(spreadsheetId, email))) throw new Error("Não foi possível confirmar a planilha.");
      await clearSupplierReviewHighlight(sheets, spreadsheetId, prepared.sheet_name);

      const mappingId = await saveSupplierMapping({
        name: prepared.supplier_name,
        spreadsheetId,
        sheetName: prepared.sheet_name,
        dataRange: "B6:F100000",
        codeColumn: 0,
        descriptionColumn: 2,
        stockColumn: 4,
        actor: email,
      });
      await attachSupplierToWaitingUpdates(mappingId, spreadsheetId, prepared.supplier_name);
      return NextResponse.json({ ok: true, supplierName: prepared.supplier_name });
    }

    if (action === "excluir_fornecedor_padronizado") {
      requireRole(email, "manage");
      const spreadsheetId = String(body.spreadsheetId || "").trim();
      if (!spreadsheetId) throw new Error("Planilha não identificada.");
      if (!(await deleteSupplierStandardization(spreadsheetId))) {
        throw new Error("Fornecedor padronizado não encontrado.");
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "registrar") {
      requireRole(email, "report");
      const supplierName = String(body.supplierName || "").trim();
      const spreadsheetReference = String(body.spreadsheetReference || "").trim();
      const note = String(body.note || "").trim();
      const sourceSheetName = String(body.sourceSheetName || "").trim();
      const sourceCodeColumn = String(body.sourceCodeColumn || "").trim().toUpperCase();
      const sourcePurchaseCodeColumn = String(body.sourcePurchaseCodeColumn || "").trim().toUpperCase();
      const sourceDescriptionColumn = String(body.sourceDescriptionColumn || "").trim().toUpperCase();
      const sourceStockColumn = String(body.sourceStockColumn || "").trim().toUpperCase();
      const sourceStartRow = Number(body.sourceStartRow);
      const trelloCardId = String(body.trelloCardId || "").trim();
      if (supplierName.length < 2) throw new Error("Informe o fornecedor ou grupo.");
      if (!spreadsheetReference) throw new Error("Informe o link da planilha.");
      if (!extractSpreadsheetId(spreadsheetReference)) throw new Error("Link da planilha inválido.");
      if (!sourceSheetName) throw new Error("Informe a aba da planilha.");
      for (const column of [sourceCodeColumn, sourceDescriptionColumn, sourceStockColumn]) {
        if (!/^[A-Z]+$/.test(column)) throw new Error("Informe colunas válidas para COD-VENDA, descrição e estoque.");
      }
      if (sourcePurchaseCodeColumn && !/^[A-Z]+$/.test(sourcePurchaseCodeColumn)) throw new Error("Revise a coluna COD-COMPRA.");
      if (!Number.isInteger(sourceStartRow) || sourceStartRow < 1) throw new Error("Informe a linha inicial.");
      const id = randomUUID();
      await createRotatingStockUpdate({
        id,
        supplierId: null,
        supplierName,
        spreadsheetName: spreadsheetReference.startsWith("http") ? supplierName : spreadsheetReference,
        spreadsheetLink: spreadsheetReference.startsWith("http") ? spreadsheetReference : "",
        note,
        reportedBy: email,
        status: "aguardando_conferencia",
        sourceSheetName,
        sourceCodeColumn,
        sourcePurchaseCodeColumn,
        sourceDescriptionColumn,
        sourceStockColumn,
        sourceStartRow,
        trelloCardId,
      });
      const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
      const conversation = await ensureConversation(ROTATING_STOCK_EMAILS.lucas, ROTATING_STOCK_EMAILS.carolina);
      await createChatMessage(conversation.id, ROTATING_STOCK_EMAILS.lucas, ROTATING_STOCK_EMAILS.carolina,
        `[Mensagem automática] ESTOQUE ROTATIVO\n\nNova relação de produtos disponível para atualização.\n\nPlanilha: ${spreadsheetReference}\nFornecedor: ${supplierName}\nInformado por: Lucas\nData: ${date}\n\nStatus: Aguardando conferência.\n\nPor favor, verificar no módulo Estoque Rotativo.`);
      await recordModuleUpdateSafely("estoque-rotativo", email, `Nova relação: ${supplierName}.`, `estoque-rotativo:${id}`);
      return NextResponse.json({ ok: true, id, needsMapping: false });
    }

    if (action === "salvar_padrao_fornecedor") {
      requireRole(email, "manage");
      const name = String(body.name || "").trim();
      const spreadsheetId = extractSpreadsheetId(String(body.spreadsheetId || ""));
      const sheetName = String(body.sheetName || "").trim();
      const codeLetter = String(body.codeColumn || "").trim().toUpperCase();
      const descriptionLetter = String(body.descriptionColumn || "").trim().toUpperCase();
      const stockLetter = String(body.stockColumn || "").trim().toUpperCase();
      const startRow = Number(body.startRow);
      if (!name || !spreadsheetId || !sheetName) throw new Error("Revise fornecedor, planilha e aba.");
      if (![codeLetter, descriptionLetter, stockLetter].every((column) => /^[A-Z]+$/.test(column))) throw new Error("Revise as colunas.");
      if (!Number.isInteger(startRow) || startRow < 1) throw new Error("Revise a linha inicial.");
      const indexes = [codeLetter, descriptionLetter, stockLetter].map(columnIndex);
      if (new Set(indexes).size !== 3) throw new Error("Código, descrição e estoque devem usar colunas diferentes.");
      const maxIndex = Math.max(...indexes);
      const id = await saveSupplierMapping({
        name,
        spreadsheetId,
        sheetName,
        dataRange: `A${startRow}:${columnLetter(maxIndex)}100000`,
        codeColumn: indexes[0],
        descriptionColumn: indexes[1],
        stockColumn: indexes[2],
        actor: email,
      });
      await attachSupplierToWaitingUpdates(id, spreadsheetId, name);
      return NextResponse.json({ ok: true, id });
    }

    if (action === "salvar_padroes_fornecedores") {
      requireRole(email, "manage");
      const patterns = Array.isArray(body.patterns) ? body.patterns as Array<Record<string, unknown>> : [];
      let saved = 0;
      for (const pattern of patterns) {
        const name = String(pattern.name || "").trim();
        const spreadsheetId = extractSpreadsheetId(String(pattern.spreadsheetId || ""));
        const sheetName = String(pattern.sheetName || "").trim();
        const codeLetter = String(pattern.codeColumn || "").trim().toUpperCase();
        const descriptionLetter = String(pattern.descriptionColumn || "").trim().toUpperCase();
        const stockLetter = String(pattern.stockColumn || "").trim().toUpperCase();
        const startRow = Number(pattern.startRow);
        if (!name || !spreadsheetId || !sheetName || !Number.isInteger(startRow) || startRow < 1) continue;
        if (![codeLetter, descriptionLetter, stockLetter].every((column) => /^[A-Z]+$/.test(column))) continue;
        const indexes = [codeLetter, descriptionLetter, stockLetter].map(columnIndex);
        if (new Set(indexes).size !== 3) continue;
        const id = await saveSupplierMapping({
          name,
          spreadsheetId,
          sheetName,
          dataRange: `A${startRow}:${columnLetter(Math.max(...indexes))}100000`,
          codeColumn: indexes[0],
          descriptionColumn: indexes[1],
          stockColumn: indexes[2],
          actor: email,
        });
        await attachSupplierToWaitingUpdates(id, spreadsheetId, name);
        saved += 1;
      }
      return NextResponse.json({ ok: true, saved });
    }

    if (action === "salvar_mapeamento") {
      requireRole(email, "manage");
      const name = String(body.name || "").trim();
      const spreadsheetId = extractSpreadsheetId(String(body.spreadsheetId || ""));
      const sheetName = String(body.sheetName || "").trim();
      const dataRange = String(body.dataRange || "").trim().toUpperCase();
      const columns = [body.codeColumn, body.descriptionColumn, body.stockColumn].map((value) => Number(value));
      if (!name || !spreadsheetId || !sheetName || !/^[A-Z]+\d+:[A-Z]+\d+$/.test(dataRange)) throw new Error("Revise fornecedor, planilha, aba e intervalo.");
      if (columns.some((value) => !Number.isInteger(value) || value < 0)) throw new Error("As colunas devem ser índices inteiros iniciados em zero.");
      if (new Set(columns).size !== 3) throw new Error("Código, descrição e estoque devem usar colunas diferentes.");
      const id = await saveSupplierMapping({
        id: body.id ? String(body.id) : undefined,
        name, spreadsheetId, sheetName, dataRange,
        codeColumn: columns[0], descriptionColumn: columns[1], stockColumn: columns[2], actor: email,
      });
      await attachSupplierToWaitingUpdates(id, spreadsheetId, name);
      return NextResponse.json({ ok: true, id });
    }

    if (action === "editar_registro") {
      requireRole(email, "report");
      const id = String(body.id || "");
      const supplierName = String(body.supplierName || "").trim();
      const spreadsheetReference = String(body.spreadsheetReference || "").trim();
      const sourceSheetName = String(body.sourceSheetName || "").trim();
      const sourceCodeColumn = String(body.sourceCodeColumn || "").trim().toUpperCase();
      const sourcePurchaseCodeColumn = String(body.sourcePurchaseCodeColumn || "").trim().toUpperCase();
      const sourceDescriptionColumn = String(body.sourceDescriptionColumn || "").trim().toUpperCase();
      const sourceStockColumn = String(body.sourceStockColumn || "").trim().toUpperCase();
      const sourceStartRow = Number(body.sourceStartRow);
      const note = String(body.note || "").trim();
      const trelloCardId = String(body.trelloCardId || "").trim();
      if (!id || !supplierName || !extractSpreadsheetId(spreadsheetReference) || !sourceSheetName) throw new Error("Complete todos os campos obrigatórios.");
      if (![sourceCodeColumn, sourceDescriptionColumn, sourceStockColumn].every((column) => /^[A-Z]+$/.test(column))) throw new Error("Revise as colunas.");
      if (sourcePurchaseCodeColumn && !/^[A-Z]+$/.test(sourcePurchaseCodeColumn)) throw new Error("Revise a coluna COD-COMPRA.");
      if (!Number.isInteger(sourceStartRow) || sourceStartRow < 1) throw new Error("Revise a linha inicial.");
      await reopenRotatingStockUpdate({
        id, supplierName,
        spreadsheetName: supplierName,
        spreadsheetLink: spreadsheetReference,
        note, sourceSheetName, sourceCodeColumn, sourcePurchaseCodeColumn, sourceDescriptionColumn, sourceStockColumn, sourceStartRow, trelloCardId,
      });
      return NextResponse.json({ ok: true, id });
    }

    if (action === "resolver_nao_encontrado") {
      requireRole(email, "conference");
      const itemId = String(body.itemId || "");
      if (!itemId || !(await resolveNotFoundItem(itemId, email))) throw new Error("Pendência não encontrada ou já resolvida.");
      return NextResponse.json({ ok: true });
    }

    const id = String(body.id || "");
    if (!id) throw new Error("Atualização não identificada.");
    const update = await getRotatingStockUpdate(id);
    if (!update) throw new Error("Atualização não encontrada.");
    const sourceSpreadsheetId = extractSpreadsheetId(update.spreadsheet_link);
    if (!sourceSpreadsheetId || !update.source_sheet_name || !update.source_code_column || !update.source_description_column || !update.source_stock_column) {
      throw new Error("Reabra para editar e complete aba, colunas e linha inicial.");
    }
    const codeColumn = columnIndex(update.source_code_column);
    const purchaseCodeColumn = update.source_purchase_code_column ? columnIndex(update.source_purchase_code_column) : null;
    const descriptionColumn = columnIndex(update.source_description_column);
    const stockColumn = columnIndex(update.source_stock_column);
    const maxSourceColumn = Math.max(codeColumn, purchaseCodeColumn ?? 0, descriptionColumn, stockColumn);

    if (action === "conferir") {
      requireRole(email, "conference");
      if (update.status === "atualizado") throw new Error("Esta atualização já foi concluída.");
      await ensurePendingStatuses(sheets);
      if (!(await acquireRotatingStockLock(id, email))) throw new Error("Esta conferência está aberta por outro usuário. Tente novamente em alguns minutos.");
      const { sourceRows, targetRows } = await readComparedRows(sheets, sourceSpreadsheetId, update.source_sheet_name, update.source_start_row, maxSourceColumn);
      const savedLinks = await listSupplierCodeLinks(update.supplier_name);
      const codeLinks = new Map(savedLinks.map((link) => [cleanCode(link.purchase_code), cleanCode(link.sale_code)]));
      const items = buildComparison(sourceRows, targetRows, update.source_start_row, codeColumn, purchaseCodeColumn, descriptionColumn, stockColumn, codeLinks);
      await saveConference(id, email, fingerprint(sourceRows, targetRows), items);
      return NextResponse.json({ ok: true, items, fingerprint: fingerprint(sourceRows, targetRows) });
    }

    if (action === "corrigir_item_conferencia") {
      requireRole(email, "conference");
      if (update.status !== "em_conferencia" || update.locked_by !== email) throw new Error("Reabra a conferência antes de corrigir itens.");
      const itemId = String(body.itemId || "").trim();
      const saleCode = cleanCode(body.saleCode);
      const newStock = integerStock(body.newStock, "Estoque corrigido");
      if (!itemId || !saleCode) throw new Error("Informe o COD-VENDA correto.");

      const storedItems = await listConferenceItems(id);
      const item = storedItems.find((candidate) => candidate.id === itemId);
      if (!item) throw new Error("Item da conferência não encontrado.");

      const target = await sheets.spreadsheets.values.get({
        spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
        range: `${ROTATING_STOCK_CENTRAL.sheetName}!${ROTATING_STOCK_CENTRAL.range}`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      const targetRows = (target.data.values || []) as unknown[][];
      const targetIndex = targetRows.findIndex((row) => cleanCode(row?.[0]) === saleCode);
      if (targetIndex < 0) throw new Error(`COD-VENDA ${saleCode} não encontrado na planilha ESTOQUE ROTATIVO.`);
      const targetRow = targetIndex + 2;
      const oldStock = nullableStock(targetRows[targetIndex]?.[2], `Base central, linha ${targetRow}`);
      const situation = oldStock !== null && oldStock === newStock ? "sem_alteracao" : "encontrado";
      const corrected = await correctConferenceItem({
        itemId,
        saleCode,
        targetRow,
        oldStock,
        newStock,
        situation,
        actor: email,
      });
      if (!corrected) throw new Error("Não foi possível corrigir o item.");
      if (corrected.purchase_code) {
        await saveSupplierCodeLink({
          supplierName: update.supplier_name,
          purchaseCode: corrected.purchase_code,
          saleCode,
          description: corrected.description,
          actor: email,
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "atualizar") {
      requireRole(email, "conference");
      if (update.status !== "em_conferencia" || update.locked_by !== email) throw new Error("Reabra a conferência antes de atualizar.");
      const storedItems = await listConferenceItems(id);
      const unresolved = storedItems.filter((item) => item.situation === "nao_encontrado");
      if (unresolved.length) throw new Error(`Corrija os ${unresolved.length} item(ns) sem COD-VENDA confirmado antes de atualizar o Estoque Rotativo.`);
      const matched = storedItems.filter((item) => item.situation !== "nao_encontrado" && item.target_row);
      const selected = storedItems.filter((item) => item.situation === "encontrado" && item.target_row);
      const { sourceRows, targetRows } = await readComparedRows(sheets, sourceSpreadsheetId, update.source_sheet_name, update.source_start_row, maxSourceColumn);
      if (fingerprint(sourceRows, targetRows) !== update.fingerprint) throw new Error("A planilha mudou durante a conferência. Recarregue a comparação e confirme novamente.");

      const statusText = `Atualizado ${rotatingStockStatusDate()}`;
      const valueUpdates = [
        ...matched.map((item) => ({
          range: `${ROTATING_STOCK_CENTRAL.sheetName}!A${item.target_row}`,
          values: [[statusText]],
        })),
        ...selected.map((item) => ({
          range: `${ROTATING_STOCK_CENTRAL.sheetName}!D${item.target_row}`,
          values: [[item.new_stock]],
        })),
      ];

      if (valueUpdates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: valueUpdates,
          },
        });
      }

      if (matched.length) {
        const sheetId = await centralSheetId(sheets);
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
          requestBody: {
            requests: matched.map((item) => ({
              repeatCell: {
                range: { sheetId, startRowIndex: item.target_row! - 1, endRowIndex: item.target_row!, startColumnIndex: 3, endColumnIndex: 4 },
                cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.949, blue: 0.8 } } },
                fields: "userEnteredFormat.backgroundColor",
              },
            })),
          },
        });
      }

      await markSupplierRotatingStockUpdated(sheets, sourceSpreadsheetId, update.source_sheet_name);
      await concludeRotatingStockCard(update.trello_card_id || "", update.supplier_name);
      await finishConference(id, email, selected.map((item) => item.id), matched.map((item) => item.target_row!));
      await recordModuleUpdateSafely(
        "estoque-rotativo",
        email,
        `${matched.length} itens conferidos; ${selected.length} estoques alterados; card concluído: ${update.supplier_name}.`,
        `estoque-rotativo:done:${id}`,
      );
      return NextResponse.json({ ok: true, updated: selected.length, reviewed: matched.length, status: statusText });
    }

    if (action === "excluir_atualizacao") {
      requireRole(email, "manage");
      const id = String(body.id || "").trim();
      if (!id) throw new Error("Atualização não identificada.");
      const removed = await deleteCompletedRotatingStockUpdate(id);
      if (!removed) throw new Error("Somente rotativos concluídos podem ser excluídos.");
      await recordModuleUpdateSafely(
        "estoque-rotativo",
        email,
        "Rotativo concluído removido do histórico.",
        `estoque-rotativo:delete:${id}`,
      );
      return NextResponse.json({ ok: true });
    }

    throw new Error("Ação inválida.");
  } catch (error) {
    return apiError(error);
  }
}
