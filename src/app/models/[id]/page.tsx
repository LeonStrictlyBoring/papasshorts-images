export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <h1 className="text-3xl font-bold text-navy">Model Detail: {id}</h1>;
}
