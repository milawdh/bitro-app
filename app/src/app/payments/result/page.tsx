import {InvoiceResult} from '@/features/learning/invoice-result';
export default async function PaymentResult({searchParams}:{searchParams:Promise<{invoiceId?:string}>}){
 const {invoiceId}=await searchParams;
 return <InvoiceResult invoiceId={invoiceId??''}/>;
}
