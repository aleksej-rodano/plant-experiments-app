import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CoverImagePicker from '../components/CoverImagePicker'
import { useAuth } from '../lib/hooks/useAuth'
import { useExperimentPhases } from '../lib/hooks/useExperimentPhases'
import { supabase } from '../lib/supabase'
import { phase1Spare } from '../lib/utils/phases'
import {
  removeStoredImages,
  uploadImage,
  validateImage,
} from '../lib/utils/image'
import { plantsLabel } from '../lib/utils/potting'
import type { DateLog, Database, Pot } from '../types/database'

const inputClass =
  'rounded-lg border-outline bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary'

export default function EditPotPage() {
  const { id, potId } = useParams<{ id: string; potId: string }>()
  const { experiment, logs, pots, phaseInput, loading, error } =
    useExperimentPhases(id)
  const backTo = id ? `/experiments/${id}` : '/experiments'
  const pot = pots.find((p) => p.id === potId) ?? null

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !experiment || !pot) {
    return (
      <section className="mx-auto max-w-lg">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error ?? (experiment ? 'Pot not found.' : 'Experiment not found.')}
        </p>
      </section>
    )
  }

  // Plants in the pot can't drop below the deaths already logged for it, and can
  // only grow by taking plants out of Phase 1 (what phase1Spare says is left).
  const deaths = deathsForPot(logs, pot.id)
  const spare = phase1Spare(phaseInput)
  const maxPlants = spare == null ? null : pot.plant_count + spare

  return (
    <EditPotForm
      pot={pot}
      backTo={backTo}
      minPlants={Math.max(1, deaths)}
      maxPlants={maxPlants}
      deaths={deaths}
    />
  )
}

function deathsForPot(logs: DateLog[], potId: string): number {
  return logs
    .filter((l) => l.pot_id === potId)
    .reduce((sum, l) => sum + (l.deaths_count ?? 0), 0)
}

function EditPotForm({
  pot,
  backTo,
  minPlants,
  maxPlants,
  deaths,
}: {
  pot: Pot
  backTo: string
  minPlants: number
  maxPlants: number | null
  deaths: number
}) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [label, setLabel] = useState(pot.label)
  const [plants, setPlants] = useState(String(pot.plant_count))
  const [size, setSize] = useState(pot.pot_size ?? '')
  const [substrate, setSubstrate] = useState(pot.substrate ?? '')
  const [notes, setNotes] = useState(pot.notes ?? '')
  const [image, setImage] = useState<File | null>(null)
  const [currentUrl, setCurrentUrl] = useState(pot.image_url ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function pickImage(file: File | undefined) {
    if (!file) return
    const problem = validateImage(file)
    if (problem) {
      setErrors((e) => ({ ...e, image: problem }))
      return
    }
    setErrors((e) => ({ ...e, image: '' }))
    setImage(file)
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!label.trim()) next.label = 'Give the pot a label.'
    const n = Number(plants)
    if (!plants.trim() || !Number.isInteger(n) || n < 1) {
      next.plants = 'Enter a whole number of at least 1.'
    } else if (n < minPlants) {
      next.plants = `${plantsLabel(deaths)} already logged as dead in this pot, so it can't hold fewer than ${minPlants}.`
    } else if (maxPlants != null && n > maxPlants) {
      next.plants = `At most ${maxPlants} — more would need ${n - pot.plant_count} plants from Phase 1 and only ${maxPlants - pot.plant_count} are left there.`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!user) {
      setSubmitError('You must be signed in to edit a pot.')
      return
    }
    if (!validate()) return

    setBusy(true)
    let uploaded: string | null = null
    try {
      let imageUrl: string | null = currentUrl || null
      if (image) {
        uploaded = await uploadImage(image, user.id)
        imageUrl = uploaded
      }
      const payload: Database['public']['Tables']['pots']['Update'] = {
        label: label.trim(),
        plant_count: Number(plants),
        pot_size: size.trim() || null,
        substrate: substrate.trim() || null,
        notes: notes.trim() || null,
        image_url: imageUrl,
      }
      const { error } = await supabase
        .from('pots')
        .update(payload)
        .eq('id', pot.id)
      if (error) throw error
      // The old photo is only orphaned once the row no longer points at it.
      if (pot.image_url && pot.image_url !== imageUrl) {
        void removeStoredImages([pot.image_url])
      }
      navigate(backTo, { replace: true, state: { toast: 'Pot updated.' } })
    } catch (err) {
      if (uploaded) void removeStoredImages([uploaded])
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save changes.',
      )
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={backTo}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-on-surface-variant hover:bg-surface-variant"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <h1 className="text-xl font-medium text-on-surface">Edit pot</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Label *
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputClass}
          />
          {errors.label && (
            <span className="text-xs text-error">{errors.label}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Plants in pot *
          <input
            type="number"
            min={minPlants}
            max={maxPlants ?? undefined}
            step={1}
            inputMode="numeric"
            value={plants}
            onChange={(e) => setPlants(e.target.value)}
            className={inputClass}
          />
          <span className="text-xs">
            {deaths > 0 && `${plantsLabel(deaths)} logged dead here. `}
            Raising this takes plants from Phase 1
            {maxPlants != null && ` (up to ${maxPlants})`}.
          </span>
          {errors.plants && (
            <span className="text-xs text-error">{errors.plants}</span>
          )}
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Pot size
            <input
              type="text"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="e.g. 10 cm"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
            Substrate
            <input
              type="text"
              value={substrate}
              onChange={(e) => setSubstrate(e.target.value)}
              placeholder="e.g. peat + perlite"
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-on-surface-variant">
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </label>

        <CoverImagePicker
          image={image}
          onPick={pickImage}
          onClear={() => {
            setImage(null)
            setCurrentUrl('')
          }}
          existingUrl={currentUrl}
          label="Pot photo"
          error={errors.image}
        />

        {submitError && (
          <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
            {submitError}
          </p>
        )}

        <div className="flex gap-3">
          <Link
            to={backTo}
            className="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-on-surface-variant ring-1 ring-outline hover:bg-surface-variant"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? (image ? 'Uploading photo…' : 'Saving…') : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  )
}
