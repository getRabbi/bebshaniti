import {CashMemo} from "@/components/cash-memo";
export default async function PrintPage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <CashMemo saleId={id} autoPrint/>;}
