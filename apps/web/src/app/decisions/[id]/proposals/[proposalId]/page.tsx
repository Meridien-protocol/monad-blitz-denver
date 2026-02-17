import { redirect } from "next/navigation";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const { id, proposalId } = await params;
  redirect(`/decisions/${id}?proposal=${proposalId}`);
}
