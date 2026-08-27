import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  icon: LucideIcon
  note: string
}

export default function PagePlaceholder({ title, icon: Icon, note }: Props) {
  return (
    <section>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-medium text-on-surface">
        <Icon className="size-6 text-primary" />
        {title}
      </h1>
      <p className="rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
        {note}
      </p>
    </section>
  )
}
