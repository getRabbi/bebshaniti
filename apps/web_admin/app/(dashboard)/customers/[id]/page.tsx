import { CustomerStatement } from "@/components/customer-statement";
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CustomerStatement customerId={id} />;
}
