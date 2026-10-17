import { Suspense } from "react";
import { getPortalSession as auth } from "@/lib/portal-session";
import { listEventsInRange } from "@/lib/google-calendar";
import type { CalendarEventDTO } from "@/lib/types";
import ComunicadosFeed from "@/app/colaboradores/comunicados-feed";
import ComunicadosAdmin from "@/app/colaboradores/comunicados-admin";
import type { PortalUser } from "@/lib/access-control";
import type { ConfiguredCollaborator } from "@/lib/portal-config";
import { getEffectivePanelData } from "@/lib/portal-config";
import { listMeetings, type Meeting } from "@/lib/reunioes";
import ModuleArrivalSummary from "@/components/module-arrival-summary";

export const dynamic = "force-dynamic";

type PanelStore = "geral" | "rio claro" | "araras";
type Store = "rio claro" | "araras";
type FixedMeeting = { date: string; time: string; label: string; frequency: string };
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
function formatMeeting(m:FixedMeeting){return formatDate(m.date)}
function isBirthday(e:CalendarEventDTO){const t=normalizeText(e.summary);return t.includes("aniversario")||t.includes("aniversariante")||t.includes("birthday")}
function isVacation(e:CalendarEventDTO){return normalizeText(e.summary).includes("ferias")}
function panelItem(e:CalendarEventDTO):PanelDateItem{return{id:`${e.calendarKey}-${e.id}`,summary:e.summary,start:e.start,end:e.end}}
function cleanSummary(s:string){return s.replace(/^anivers[aá]rio\s*/i,"").replace(/\s*-\s*f[eé]rias\s*$/i,"").trim()}
function unique(items:PanelDateItem[]){const seen=new Set<string>();return items.sort((a,b)=>parseEventDate(a.start).getTime()-parseEventDate(b.start).getTime()).filter(i=>{const k=`${normalizeText(cleanSummary(i.summary))}-${formatDate(i.start)}`;if(seen.has(k))return false;seen.add(k);return true})}

function meetings(items:Meeting[],now:Date,unit:Store):FixedMeeting[]{
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:PANEL_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
 const today=`${parts.find(item=>item.type==="year")?.value}-${parts.find(item=>item.type==="month")?.value}-${parts.find(item=>item.type==="day")?.value}`;
 const expectedUnit=unit==="araras"?"Araras":"Rio Claro";
 return items.filter(item=>item.status==="agendada"&&item.unit===expectedUnit)
  .flatMap(item=>[{date:item.date,time:item.time,frequency:item.frequency},{date:item.secondDate,time:item.secondTime,frequency:item.frequency},...(item.additionalDates||[]).map(occurrence=>({...occurrence,frequency:item.frequency}))])
  .filter(item=>item.date&&item.date>=today)
  .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))
  .slice(0,2)
  .map((item,index)=>({date:item.date,time:item.time,label:index===0?"Próxima":"Seguinte",frequency:item.frequency||"Mensal"}));
}
function AnnouncementCard({store,isAdmin,canConfirmRead,collaborators}:{store:Store;isAdmin:boolean;canConfirmRead:boolean;collaborators:ConfiguredCollaborator[]}){const unit=store==="rio claro"?"Rio Claro":"Araras";const members=collaborators.filter(member=>member.active&&member.unit===unit);return <article className="h-full min-w-0 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">AVISOS</p><h2 className="mt-2 text-xl font-semibold text-slate-950">{unit}</h2><div className="mt-4 space-y-4"><ComunicadosFeed store={store} isAdmin={isAdmin} canConfirmRead={canConfirmRead} members={members}/></div></article>}
function MeetingSummaryCard({title,list}:{title:string;list:FixedMeeting[]}){const frequency=list[0]?.frequency;return <article className="h-full min-w-0 rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wider text-slate-500">PRÓXIMAS REUNIÕES</p><h3 className="mt-1 text-xl font-semibold text-slate-950">{title}</h3></div>{frequency&&<span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">{frequency}</span>}</div><div className="mt-5 grid gap-3 sm:grid-cols-2">{["PRÓXIMA","SEGUINTE"].map((label,index)=>{const meeting=list[index];return <div key={label} className="min-w-0 rounded-2xl bg-white/80 p-4"><p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{label}</p>{meeting?<><p className="mt-2 text-lg font-semibold text-slate-900">{formatMeeting(meeting)}</p>{meeting.time&&<p className="mt-1 text-base text-slate-500">{meeting.time}</p>}</>:<p className="mt-2 text-base text-slate-500">A definir</p>}</div>})}</div></article>}
function EventCard({title,tone,events}:{title:string;tone:"pink"|"amber";events:PanelDateItem[]}){const cls=tone==="pink"?"border-pink-200 bg-pink-50":"border-amber-200 bg-amber-50";return <article className={`h-full min-w-0 rounded-3xl border p-5 shadow-sm ${cls}`}><p className="text-xs font-semibold uppercase tracking-wider text-slate-700">{title}</p>{events.length?<ul className="mt-3 space-y-2">{events.map(e=><li key={e.id} className="rounded-xl bg-white/70 p-3"><p className="font-semibold text-slate-900">{cleanSummary(e.summary)}</p><p className="mt-1 text-sm text-slate-600">{title==="Férias"&&e.end?`${formatDate(e.start)} a ${formatDate(e.end)}`:formatDate(e.start)}</p></li>)}</ul>:<p className="mt-3 text-sm text-slate-500">Nenhum registro informado.</p>}</article>}

async function PanelContent(){
 const session=await auth();const email=session?.user?.email??"";const normalized=email.trim().toLowerCase();const now=new Date();const eventWindow=getPanelDateWindow(now);
 const eventsPromise=session?.accessToken&&session.error!=="RefreshAccessTokenError"
  ?listEventsInRange(session.accessToken,{timeMin:eventWindow.timeMin,timeMax:eventWindow.timeMax,maxResults:500},["timoni"]).catch(()=>[] as CalendarEventDTO[])
  :Promise.resolve([] as CalendarEventDTO[]);
 const meetingsPromise=session?.accessToken&&session.error!=="RefreshAccessTokenError"
  ?listMeetings(session.accessToken).catch(()=>[] as Meeting[])
  :Promise.resolve([] as Meeting[]);
 const panelData=await getEffectivePanelData(session?.accessToken,normalized);
 const effectiveUser=panelData.user;const collaborators=panelData.collaborators;const panelStore=getPanelStore(email,effectiveUser??session?.portalUser);const isCica=normalized==="mcrodini@gmail.com";const isManagement=["mcrodini@gmail.com","mrodini@gmail.com"].includes(normalized);const canConfirmRead=!isManagement&&Boolean(effectiveUser?.noticeRequired);
 return <>
 {isManagement&&<ModuleArrivalSummary module="avisos"/>}
 {panelStore==="geral"?<section className="grid portal-comms-grid grid-cols-2 items-stretch gap-2 sm:gap-4 lg:grid-cols-2"><AnnouncementCard store="rio claro" isAdmin={isCica} canConfirmRead={canConfirmRead} collaborators={collaborators}/><AnnouncementCard store="araras" isAdmin={isCica} canConfirmRead={canConfirmRead} collaborators={collaborators}/><Suspense fallback={<CardSkeleton label="PRÓXIMAS REUNIÕES" />}><MeetingsBlock items={meetingsPromise} now={now} store="rio claro" /></Suspense><Suspense fallback={<CardSkeleton label="PRÓXIMAS REUNIÕES" />}><MeetingsBlock items={meetingsPromise} now={now} store="araras" /></Suspense><Suspense fallback={<CardSkeleton label="Aniversários" tone="pink" />}><DatesBlock items={eventsPromise} window={eventWindow} kind="birthdays" /></Suspense><Suspense fallback={<CardSkeleton label="Férias" tone="amber" />}><DatesBlock items={eventsPromise} window={eventWindow} kind="vacations" /></Suspense></section>:<section className="grid portal-comms-grid grid-cols-2 items-stretch gap-2 sm:gap-4 lg:grid-cols-2"><AnnouncementCard store={panelStore} isAdmin={isCica} canConfirmRead={canConfirmRead} collaborators={collaborators}/><Suspense fallback={<CardSkeleton label="PRÓXIMAS REUNIÕES" />}><MeetingsBlock items={meetingsPromise} now={now} store={panelStore} /></Suspense><Suspense fallback={<CardSkeleton label="Aniversários" tone="pink" />}><DatesBlock items={eventsPromise} window={eventWindow} kind="birthdays" /></Suspense><Suspense fallback={<CardSkeleton label="Férias" tone="amber" />}><DatesBlock items={eventsPromise} window={eventWindow} kind="vacations" /></Suspense></section>}
 {isCica&&<ComunicadosAdmin/>}</>
}

function CardSkeleton({label,tone="blue"}:{label:string;tone?:"blue"|"pink"|"amber"}){
 const color=tone==="pink"?"border-pink-200 bg-pink-50":tone==="amber"?"border-amber-200 bg-amber-50":"border-blue-200 bg-blue-50";
 return <article aria-busy="true" aria-label={`Carregando ${label}`} className={`h-full min-w-0 rounded-3xl border p-5 shadow-sm ${color}`}><p className="text-xs font-semibold uppercase tracking-wider text-slate-700">{label}</p><div aria-hidden="true" className="mt-5 space-y-3 motion-safe:animate-pulse"><div className="h-5 w-2/3 rounded bg-white/80"/><div className="h-16 rounded-xl bg-white/70"/></div></article>;
}
async function MeetingsBlock({items,now,store}:{items:Promise<Meeting[]>;now:Date;store:Store}){
 return <MeetingSummaryCard title={store==="araras"?"Araras":"Rio Claro"} list={meetings(await items,now,store)}/>;
}
async function DatesBlock({items,window,kind}:{items:Promise<CalendarEventDTO[]>;window:PanelDateWindow;kind:"birthdays"|"vacations"}){
 const events=await items;
 return kind==="birthdays"
  ?<EventCard title="Aniversários" tone="pink" events={unique(events.filter(e=>isBirthday(e)&&eventStartsInPanelWindow(e,window)).map(panelItem))}/>
  :<EventCard title="Férias" tone="amber" events={unique(events.filter(e=>isVacation(e)&&eventOverlapsPanelWindow(e,window)).map(panelItem))}/>;
}
export default function ColaboradoresPage(){
 return <div className="pb-10"><header className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Comunicação interna</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Painel Timoni</h1></header><Suspense fallback={<section className="grid portal-comms-grid grid-cols-2 items-stretch gap-2 sm:gap-4 lg:grid-cols-2"><CardSkeleton label="AVISOS"/><CardSkeleton label="PRÓXIMAS REUNIÕES"/></section>}><PanelContent/></Suspense></div>;
}
