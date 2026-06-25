export type ChatKeyLike={key:string;repeat?:boolean;isComposing?:boolean;keyCode?:number};

export function isCompositionKey(event:ChatKeyLike,composing:boolean){
  return composing||event.isComposing===true||event.keyCode===229;
}

export function shouldSubmitChatKey(event:ChatKeyLike,composing:boolean){
  return event.key==='Enter'&&!event.repeat&&!isCompositionKey(event,composing);
}

export function normalizeChatText(value:unknown,maxLength=80){
  if(typeof value!=='string')return '';
  return value.trim().slice(0,maxLength);
}
