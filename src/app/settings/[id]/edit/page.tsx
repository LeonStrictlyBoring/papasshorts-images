import SettingEditClient from './SettingEditClient'

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function Page() {
  return <SettingEditClient />
}
