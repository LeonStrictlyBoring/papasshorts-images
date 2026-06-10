import ModelEditClient from './ModelEditClient'

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function Page() {
  return <ModelEditClient />
}
