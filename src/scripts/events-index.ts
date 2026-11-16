import { matchesEvent, readEventsFilter, writeEventsFilter } from '../lib/events-filter.ts';
import { eventCountdown, eventPhase, eventPhaseNames, registrationCountdown, type EventTiming } from '../lib/events-time.ts';
export function mountEventsIndex(root:HTMLElement,{now=()=>new Date(),refreshMs=60000}={}) {
  const query=root.querySelector<HTMLInputElement>('#events-query'),view=root.querySelector<HTMLSelectElement>('#events-view'),phase=root.querySelector<HTMLSelectElement>('#events-phase');
  const records=[...root.querySelectorAll<HTMLElement>('[data-event-record]')];
  const count=root.querySelector<HTMLElement>('#events-count'),empty=root.querySelector<HTMLElement>('#events-empty'),reset=root.querySelector<HTMLButtonElement>('#events-reset');
  const timing=(record:HTMLElement):EventTiming=>JSON.parse(record.dataset.timing||'{}');
  function restore(){const filter=readEventsFilter(new URLSearchParams(location.search));if(query)query.value=filter.query;if(view)view.value=filter.view;if(phase)phase.value=filter.phase;}
  function render(write=true) {
    const filter={query:query?.value||'',view:view?.value||'all',phase:phase?.value||'all'},at=now();let visible=0;
    for(const card of records){
      const event=timing(card),state=eventPhase(event,at),label=card.querySelector<HTMLElement>('[data-event-phase]'),clock=card.querySelector<HTMLElement>('[data-event-countdown]'),deadline=card.querySelector<HTMLElement>('[data-registration-countdown]');
      card.dataset.phase=state;
      if(label)label.textContent=eventPhaseNames[state];if(clock)clock.textContent=eventCountdown(event,at);
      if(deadline)deadline.textContent=registrationCountdown(event,JSON.parse(card.dataset.registration||'{}'),at);
      card.hidden=!matchesEvent({...event,search:card.dataset.search||'',scope:card.dataset.scope||'',watchable:card.dataset.watchable==='true'},filter,at);if(!card.hidden)visible++;
    }
    if(count)count.textContent=`${visible} 个活动`;if(empty)empty.hidden=visible>0;
    if(reset)reset.hidden=filter.query.trim()===''&&filter.view==='all'&&filter.phase==='all';
    if(write)history.replaceState(null,'',writeEventsFilter(new URL(location.href),filter));
  }
  const change=()=>render(),restoreAndRender=()=>{restore();render(false);},submit=(event:Event)=>{event.preventDefault();render();};
  const clear=()=>{if(query)query.value='';if(view)view.value='all';if(phase)phase.value='all';render();query?.focus();};
  query?.addEventListener('input',change);view?.addEventListener('change',change);phase?.addEventListener('change',change);reset?.addEventListener('click',clear);root.querySelector('form')?.addEventListener('submit',submit);
  window.addEventListener('pageshow',restoreAndRender);window.addEventListener('popstate',restoreAndRender);
  const doc=typeof document==='undefined'?null:document;
  const onVisible=()=>{if(doc?.visibilityState==='visible')render(false);};
  doc?.addEventListener('visibilitychange',onVisible);
  const timer=refreshMs>0?setInterval(()=>render(false),refreshMs):null;
  restoreAndRender();
  return ()=>{if(timer!==null)clearInterval(timer);doc?.removeEventListener('visibilitychange',onVisible);query?.removeEventListener('input',change);view?.removeEventListener('change',change);phase?.removeEventListener('change',change);reset?.removeEventListener('click',clear);root.querySelector('form')?.removeEventListener('submit',submit);window.removeEventListener('pageshow',restoreAndRender);window.removeEventListener('popstate',restoreAndRender);};
}
