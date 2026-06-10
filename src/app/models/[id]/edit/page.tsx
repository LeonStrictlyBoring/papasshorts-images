import ModelEditClient from './ModelEditClient'

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ModelEditClient params={params} />
}
