interface GuideSection {
  heading: string
  items: string[]
}

interface PestProtocol {
  /** Matched case-insensitively against pest_guides.pest_name. */
  match: string[]
  sections: GuideSection[]
}

// Pest-specific step-by-step protocols. Each pest gets only the chemistry that
// applies to it: isopropyl alcohol spray for scale insects, diluted hydrogen
// peroxide for springtails. (English translation of a user-supplied guide.)
const PROTOCOLS: PestProtocol[] = [
  {
    match: ['scale insects', 'scale insect', 'cocciniglia'],
    sections: [
      {
        heading: 'Preparation and materials',
        items: [
          'Wear nitrile or latex gloves and work in a well-ventilated area.',
          'Alcohol spray: in a mister bottle, mix 1 part isopropyl alcohol (99.9%), 5 parts water, and 2–3 drops of dish soap.',
          'Keep undiluted hydrogen peroxide (3%) and a paper towel or sponge on hand for wiping down the pot and saucer.',
        ],
      },
      {
        heading: 'Foliar treatment',
        items: [
          'Tilt the pot on its side over the sink or bathtub so gravity keeps the liquid out of the soil.',
          'Spray the alcohol mixture generously over the whole plant, focusing on the undersides of the leaves and the stem joints.',
          'Wait 10–15 minutes to let the insects dehydrate, keeping the plant tilted the whole time.',
          'Rinse the foliage thoroughly under running water (sink or shower) to wash off the alcohol, soap, and dead pests. Let the rinse water drain straight down the drain.',
        ],
      },
      {
        heading: 'Drying and maintenance',
        items: [
          'Set the plant in a ventilated spot to dry, strictly out of direct sunlight to avoid chemical burns.',
          'Repeat the whole cycle every 7–10 days until you see no more trace of the insects.',
        ],
      },
    ],
  },
  {
    match: ['springtails', 'springtail', 'collemboli'],
    sections: [
      {
        heading: 'Preparation and materials',
        items: [
          'Wear nitrile or latex gloves and work in a well-ventilated area.',
          'Peroxide solution: mix 1 part hydrogen peroxide (3%) with 4 parts water. Collected rainwater is fine for this mix.',
          'Keep undiluted hydrogen peroxide (3%) and a paper towel or sponge on hand for wiping down the pot and saucer.',
        ],
      },
      {
        heading: 'Soil and saucer treatment',
        items: [
          'With the pot upright, water the soil evenly with the diluted peroxide solution.',
          "Let all the excess liquid drain out of the pot's drainage holes (safe to pour down the sink).",
          'Pour the undiluted hydrogen peroxide (3%) onto the cloth and thoroughly wipe the outside of the pot and the entire saucer to kill any springtails that escaped or are hiding in the crevices. No need to rinse.',
        ],
      },
      {
        heading: 'Drying and maintenance',
        items: [
          'Set the plant in a ventilated spot to dry, out of direct sunlight.',
          'Repeat the whole cycle every 7–10 days until you see no more springtails.',
        ],
      },
    ],
  },
]

export function hasPestProtocol(pestName: string): boolean {
  const key = pestName.trim().toLowerCase()
  return PROTOCOLS.some((p) => p.match.includes(key))
}

export default function PestTreatmentGuide({ pestName }: { pestName: string }) {
  const key = pestName.trim().toLowerCase()
  const protocol = PROTOCOLS.find((p) => p.match.includes(key))
  if (!protocol) return null

  return (
    <div className="flex flex-col gap-4">
      {protocol.sections.map((section) => (
        <div key={section.heading}>
          <h4 className="mb-1.5 text-sm font-medium text-on-surface">
            {section.heading}
          </h4>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-on-surface-variant">
            {section.items.map((item, i) => (
              <li key={i} className="pl-1">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
