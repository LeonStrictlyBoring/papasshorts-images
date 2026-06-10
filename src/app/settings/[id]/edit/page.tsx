import SettingEditClient from './SettingEditClient'

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SettingEditClient params={params} />
}
