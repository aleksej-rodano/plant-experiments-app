interface GuideSection {
  heading: string
  items: string[]
}

// Shared step-by-step protocol shown under every pest guide.
const SECTIONS: GuideSection[] = [
  {
    heading: 'Preparation and materials',
    items: [
      'Wear nitrile or latex gloves and work in a well-ventilated area.',
      'Scale insect spray: in a spray bottle, mix 1 part isopropyl alcohol (99.9%), 5 parts water, and 2–3 drops of dish soap.',
      'Springtail solution: mix 1 part hydrogen peroxide (3%) with 4 parts water. You can safely use the rainwater you collect for your houseplants to make this mixture.',
      'Plastic cleaning: keep undiluted hydrogen peroxide (3%) and a paper towel or sponge within reach.',
    ],
  },
  {
    heading: 'Step 1 — Foliar treatment (scale insects)',
    items: [
      'Tilt the pot on its side over the sink or bathtub so gravity keeps the liquids from running into the soil.',
      'Spray the alcohol mixture generously over the whole plant, focusing on the undersides of the leaves and the stem joints.',
      'Wait 10–15 minutes to let the insects dehydrate, keeping the plant tilted the whole time.',
      'Rinse the foliage thoroughly under running water (sink or shower) to wash off the alcohol, soap, and dead pests. Let the rinse water drain straight down the drain.',
    ],
  },
  {
    heading: 'Step 2 — Soil and saucer treatment (springtails)',
    items: [
      'Return the pot upright and water the soil evenly with the diluted hydrogen peroxide solution.',
      "Let all the excess liquid drain out of the pot's drainage holes (you can safely pour it down the sink).",
      'Pour the undiluted hydrogen peroxide (3%) onto the cloth and thoroughly wipe the outside of the pot and the entire saucer to remove any springtails that escaped or are hiding in the crevices. No need to rinse.',
    ],
  },
  {
    heading: 'Step 3 — Drying and maintenance',
    items: [
      'Place the plant in a ventilated area to dry, strictly out of direct sunlight to avoid chemical burns.',
      'Repeat the entire treatment cycle every 7–10 days until you no longer see any trace of insects.',
    ],
  },
]

export default function PestTreatmentGuide() {
  return (
    <div className="flex flex-col gap-4">
      {SECTIONS.map((section) => (
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
