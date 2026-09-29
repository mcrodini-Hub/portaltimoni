import { auth } from "@/lib/auth";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";
import ComunicadosFeed from "@/app/colaboradores/comunicados-feed";
import ComunicadosAdmin from "@/app/colaboradores/comunicados-admin";
import type { PortalUser } from "@/lib/access-control";
import type { ConfiguredCollaborator } from "@/lib/portal-config";
import { getEffectivePanelData } from "@/lib/portal-config";
import ModuleArrivalSummary from "@/components/module-arrival-summary";

export const dynamic = "force-dynamic";

type PanelStore = "geral" | "rio claro" | "araras";
type Store = "rio claro" | "araras";
type FixedMeeting = { summary: string; start: string; label: string };
type PanelDateItem = { id: string; summary: string; start: string; end?: string };

function normalizeText(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function getPanelStore(email:string,portalUser?:PortalUser|null):PanelStore{const e=email.trim().toLowerCase();if(["mcrodini@gmail.com","mrodini@gmail.com"].includes(e))return "geral";if(portalUser?.unit==="Geral")return "geral";if(portalUser?.unit==="Araras")return "araras";if(portalUser?.unit==="Rio Claro")return "rio claro";if(["estoqueararascasatimoni@gmail.com","comercialara@casatimoni.com.br","fotoscasatimoni@gmail.com","reginaldo@casatimoni.com.br","casatimoniararas@gmail.com"].includes(e))return "araras";return "rio claro"}
function parseEventDate(value:string){return new Date(value.includes("T")?value:`${value}T12:00:00-03:00`)}
const PANEL_TIME_ZONE="America/Sao_Paulo";
const PANEL_UTC_OFFSET="-03:00";
const PANEL_WINDOW_DAYS_AHEAD=60;
type PanelDateWindow={start:Date;endExclusive:Date;timeMin:string;timeMax:string};
function getPanelDateWindow(now:Date):PanelDateWindow{
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:PANEL_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const part=(type:Intl.DateTimeFormatPartTypes)=>parts.find(item=>item.type===type)?.value??"";
 const today=`${part("year")}-${part("month")}-${part("day")}`;
 const lastDayExclusive=new Date(`${today}T00:00:00Z`);
 lastDayExclusive.setUTCDate(lastDayExclusive.getUTCDate()+PANEL_WINDOW_DAYS_AHEAD+1);
 const timeMin=`${today}T00:00:00${PANEL_UTC_OFFSET}`;
 const timeMax=`${lastDayExclusive.toISOString().slice(0,10)}T00:00:00${PANEL_UTC_OFFSET}`;
 return {start:new Date(timeMin),endExclusive:new Date(timeMax),timeMin,timeMax};
}
function eventStartsInPanelWindow(event:CalendarEventDTO,window:PanelDateWindow){
 const start=parseEventDate(event.start);
 return start>=window.start&&start<window.endExclusive;
}
function eventOverlapsPanelWindow(event:CalendarEventDTO,window:PanelDateWindow){
 const start=parseEventDate(event.start),end=parseEventDate(event.end);
 return start<window.endExclusive&&end>window.start;
}
function formatDate(value:string|Date){const d=typeof value==="string"?parseEventDate(value):value;return new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric"}).format(d)}
function formatMeeting(m:FixedMeeting){const d=parseEventDate(m.start);const time=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"}).format(d);return `${formatDate(d)} · ${time}`}
function isBirthday(e:CalendarEventDTO){const t=normalizeText(e.summary);return t.includes("aniversario")||t.includes("aniversariante")||t.includes("birthday")}
function isVacation(e:CalendarEventDTO){return normalizeText(e.summary).includes("ferias")}
function panelItem(e:CalendarEventDTO):PanelDateItem{return{id:`${e.calendarKey}-${e.id}`,summary:e.summary,start:e.start,end:e.end}}
function cleanSummary(s:string){return s.replace(/^anivers[aá]rio\s*/i,"").replace(/\s*-\s*f[eé]rias\s*$/i,"").trim()}
function unique(items:PanelDateItem[]){const seen=new Set<string>();return items.sort((a,b)=>parseEventDate(a.start).getTime()-parseEventDate(b.start).getTime()).filter(i=>{const k=`${normalizeText(cleanSummary(i.summary))}-${formatDate(i.start)}`;if(seen.has(k))return false;seen.add(k);return true})}

const fixedMeetingSchedule:Record<Store,FixedMeeting[]>={
 araras:[{summary:"Reunião Araras",start:"2026-09-08T07:40:00-03:00",label:"Próxima"},{summary:"Reunião Araras",start:"2026-10-09T07:40:00-03:00",label:"Seguinte"}],
 "rio claro":[{summary:"Reunião Rio Claro",start:"2026-09-03T07:30:00-03:00",label:"Próxima"},{summary:"Reunião Rio Claro",start:"2026-10-03T07:30:00-03:00",label:"Seguinte"}]
};
function meetings(now:Date,unit:Store){return fixedMeetingSchedule[unit].filter(m=>new Date(parseEventDate(m.start).getTime()+3600000)>now).slice(0,2)}
function AnnouncementCard({store,isAdmin,canConfirmRead,collaborators}:{store:Store;isAdmin:boolean;canConfirmRead:boolean;collaborators:ConfiguredCollaborator[]}){const unit=store==="rio claro"?"Rio Claro":"Araras";const members=collaborators.filter(member=>member.active&&member.unit===unit);return <article className="h-full min-w-0 rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow-sm sm:rounded-3xl sm:p-5"><p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 sm:text-xs">AVISOS</p><h2 className="mt-1 text-lg font-semibold text-slate-950 sm:mt-2 sm:text-xl">{unit}</h2><div className="mt-2 space-y-2 sm:mt-4 sm:space-y-4"><ComunicadosFeed store={store} isAdmin={isAdmin} canConfirmRead={canConfirmRead} members={members}/></div></article>}
function MeetingSummaryCard({title,list}:{title:string;list:FixedMeeting[]}){return <article className="h-full min-w-0 rounded-2xl border border-violet-200 bg-violet-50 p-3 shadow-sm sm:rounded-3xl sm:p-5"><p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 sm:text-xs">Reuniões</p><h3 className="mt-1 font-semibold text-slate-950 sm:mt-3">{title}</h3>{list.length?<div className="mt-1.5 space-y-1.5 sm:mt-2 sm:space-y-2">{list.map((m,i)=><div key={m.start} className="rounded-lg bg-white/70 p-2 sm:rounded-xl sm:p-3"><p className="text-[11px] font-semibold uppercase text-violet-700 sm:text-xs">{i===0?"Próxima":"Seguinte"}</p><p className="mt-0.5 text-sm font-semibold text-slate-800 sm:mt-1">{formatMeeting(m)}</p></div>)}</div>:<p className="mt-2 text-sm text-slate-500">Nenhuma reunião programada.</p>}</article>}
function EventCard({title,tone,events}:{title:string;tone:"pink"|"amber";events:PanelDateItem[]}){const cls=tone==="pink"?"border-pink-200 bg-pink-50":"border-amber-200 bg-amber-50";return <article className={`h-full min-w-0 rounded-2xl border p-3 shadow-sm sm:rounded-3xl sm:p-5 ${cls}`}><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 sm:text-xs">{title}</p>{events.length?<ul className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">{events.map(e=><li key={e.id} className="rounded-lg bg-white/70 p-2 sm:rounded-xl sm:p-3"><p className="text-sm font-semibold text-slate-900 sm:text-base">{cleanSummary(e.summary)}</p><p className="mt-0.5 text-xs text-slate-600 sm:mt-1 sm:text-sm">{title==="Férias"&&e.end?`${formatDate(e.start)} a ${formatDate(e.end)}`:formatDate(e.start)}</p></li>)}</ul>:<p className="mt-2 text-sm text-slate-500 sm:mt-3">Nenhum registro informado.</p>}</article>}

export default async function ColaboradoresPage(){
 const session=await auth();const email=session?.user?.email??"";const normalized=email.trim().toLowerCase();const now=new Date();const eventWindow=getPanelDateWindow(now);
 const [panelData,events]=await Promise.all([
  getEffectivePanelData(session?.accessToken,normalized),
  session?.accessToken&&session.error!=="RefreshAccessTokenError"
   ?listEventsInRange(session.accessToken,{timeMin:eventWindow.timeMin,timeMax:eventWindow.timeMax,maxResults:500},["timoni"]).catch(()=>[] as CalendarEventDTO[])
   :Promise.resolve([] as CalendarEventDTO[])
 ]);
 const effectiveUser=panelData.user;const collaborators=panelData.collaborators;const panelStore=getPanelStore(email,effectiveUser??session?.portalUser);const isCica=normalized==="mcrodini@gmail.com";const isManagement=["mcrodini@gmail.com","mrodini@gmail.com"].includes(normalized);const canConfirmRead=!isManagement&&Boolean(effectiveUser?.noticeRequired);
 const araras=meetings(now,"araras"),rioClaro=meetings(now,"rio claro");
 const birthdays=unique(events.filter(e=>isBirthday(e)&&eventStartsInPanelWindow(e,eventWindow)).map(panelItem));
 const vacations=unique(events.filter(e=>isVacation(e)&&eventOverlapsPanelWindow(e,eventWindow)).map(panelItem));
 return <div className="pb-8 sm:pb-10"><header className="mb-4 sm:mb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 sm:text-xs sm:tracking-[0.2em]">Comunicação interna</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:mt-2 sm:text-3xl">Painel Timoni</h1></header>
 {isManagement&&<ModuleArrivalSummary module="avisos"/>}
 {panelStore==="geral"?<section className="grid portal-comms-grid grid-cols-2 items-stretch gap-2 sm:gap-4 lg:grid-cols-2"><AnnouncementCard store="rio claro" isAdmin={isCica} canConfirmRead={canConfirmRead} collaborators={collaborators}/><AnnouncementCard store="araras" isAdmin={isCica} canConfirmRead={canConfirmRead} collaborators={collaborators}/><MeetingSummaryCard title="Rio Claro" list={rioClaro}/><MeetingSummaryCard title="Araras" list={araras}/><EventCard title="Aniversários" tone="pink" events={birthdays}/><EventCard title="Férias" tone="amber" events={vacations}/></section>:<section className="grid portal-comms-grid grid-cols-2 items-stretch gap-2 sm:gap-4 lg:grid-cols-2"><AnnouncementCard store={panelStore} isAdmin={isCica} canConfirmRead={canConfirmRead} collaborators={collaborators}/><MeetingSummaryCard title={panelStore==="araras"?"Araras":"Rio Claro"} list={panelStore==="araras"?araras:rioClaro}/><EventCard title="Aniversários" tone="pink" events={birthdays}/><EventCard title="Férias" tone="amber" events={vacations}/></section>}
 {isCica&&<ComunicadosAdmin/>}</div>
}
