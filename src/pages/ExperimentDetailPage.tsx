import { Sprout } from 'lucide-react'
import { useParams } from 'react-router-dom'
import PagePlaceholder from '../components/PagePlaceholder'

export default function ExperimentDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PagePlaceholder
      title="Experiment Detail"
      icon={Sprout}
      note={`Detail view and date-log timeline for experiment ${id ?? '?'} arrive in Task 4.`}
    />
  )
}
