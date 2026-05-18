export default async function ShootingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <h1 className="text-3xl font-bold text-navy">Shooting Details: {id}</h1>;
}
