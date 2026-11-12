export const faNumber=(value:number)=>value.toLocaleString('fa-IR');
export const nowISO=()=>new Date().toISOString();
export const createId=(prefix='item')=>`${prefix}-${crypto.randomUUID()}`;
export const formatDate=(value:string)=>new Intl.DateTimeFormat('fa-IR',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Tehran'}).format(new Date(value));
export function downloadCsv(filename:string,headers:string[],rows:(string|number)[][]){
 const cell=(value:string|number)=>`"${String(value).replaceAll('"','""')}"`;
 const content='\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
