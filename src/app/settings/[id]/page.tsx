export default async function SettingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <h1 className="text-3xl font-bold text-navy">Setting Details: {id}</h1>;
}
